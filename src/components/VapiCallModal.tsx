import React, { useState, useEffect, useRef } from 'react';
import { 
  PhoneOff, Mic, MicOff, Volume2, Sparkles, Building2, 
  MapPin, Briefcase, AlertCircle, RefreshCw, X, ShieldAlert,
  Bot, User, CheckCircle2, Radio, Key, ArrowRight, ExternalLink,
  WifiOff, HelpCircle
} from 'lucide-react';
import { Candidate, CallRecord, ChatMessage, CandidateRemark } from '../types';
import { 
  vapiService, 
  DEFAULT_VAPI_ASSISTANT_ID, 
  VapiCallStatus, 
  VapiTranscriptMessage,
  VapiErrorInfo,
  classifyVoiceError,
  isNormalMeetingEnd,
  buildVapiAssistantConfig
} from '../utils/vapiService';

interface VapiCallModalProps {
  isOpen: boolean;
  candidate: Candidate | null;
  onClose: () => void;
  onCallEnded?: (updatedCandidate: Candidate) => void;
  onSwitchToInteractive?: (candidate: Candidate) => void;
  assistantId?: string;
}

export const VapiCallModal: React.FC<VapiCallModalProps> = ({
  isOpen,
  candidate,
  onClose,
  onCallEnded,
  onSwitchToInteractive,
  assistantId = DEFAULT_VAPI_ASSISTANT_ID,
}) => {
  const [vapiCallStatus, setVapiCallStatus] = useState<VapiCallStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<VapiErrorInfo | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState<VapiTranscriptMessage[]>([]);
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [isConnectingKey, setIsConnectingKey] = useState<boolean>(false);

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const durationTimerRef = useRef<any>(null);
  const hasFinalizedRef = useRef<boolean>(false);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Duration timer
  useEffect(() => {
    if (vapiCallStatus === 'active') {
      durationTimerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    }
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    };
  }, [vapiCallStatus]);

  // Bind vapiService event listeners and initialize state
  useEffect(() => {
    if (!isOpen) {
      vapiService.resetToIdle();
      setVapiCallStatus('idle');
      return;
    }

    setErrorMessage(null);
    setVoiceError(null);
    setTranscript([]);
    setDuration(0);
    setIsMuted(false);
    hasFinalizedRef.current = false;

    // Register event listeners using vapiService.onStatusChange
    const unsubStatus = vapiService.onStatusChange((status, err) => {
      setVapiCallStatus(status);
      if (status === 'error' && err) {
        const info = classifyVoiceError(err);
        setVoiceError(info);
        setErrorMessage(info.message);
      } else if (status === 'active' || status === 'idle' || status === 'connecting' || status === 'ended') {
        setVoiceError(null);
        setErrorMessage(null);
      }
      if (status === 'ended' && candidate) {
        finalizeCallRecord();
      }
    });

    const unsubTranscript = vapiService.onTranscript((msg) => {
      setTranscript((prev) => {
        if (prev.some((item) => item.id === msg.id)) {
          return prev;
        }
        return [...prev, msg];
      });
    });

    const unsubVolume = vapiService.onVolume((vol) => {
      setVolumeLevel(vol);
    });

    const unsubSpeaking = vapiService.onSpeaking((speaking) => {
      setIsAgentSpeaking(speaking);
    });

    // Check if key is available, else set key_required
    vapiService.isKeyConfigured().then((hasKey) => {
      if (!hasKey && !vapiService.getStoredPublicKey()) {
        setVapiCallStatus('key_required');
      } else {
        setVapiCallStatus('idle');
      }
    });

    return () => {
      unsubStatus();
      unsubTranscript();
      unsubVolume();
      unsubSpeaking();
    };
  }, [isOpen, candidate, assistantId]);

  // Method to start call using vapiService.startCall
  const handleStartCall = async (explicitKey?: string) => {
    try {
      setErrorMessage(null);
      setVoiceError(null);

      // 1. Ensure microphone is enabled before starting
      try {
        await vapiService.verifyMicrophonePermission();
      } catch (micErr: any) {
        console.warn('Microphone pre-flight verification failed:', micErr);
        const classifiedMic = classifyVoiceError(micErr);
        setVoiceError(classifiedMic);
        setErrorMessage(classifiedMic.message);
        setVapiCallStatus('error');
        return;
      }

      // 2. Smoothly transition to connecting status
      setVapiCallStatus('connecting');
      setTranscript([]);
      setDuration(0);
      setIsMuted(false);

      // 3. Pre-check if public key is available
      let key = explicitKey;
      if (!key) {
        try {
          key = await vapiService.resolvePublicKey();
        } catch {
          setVapiCallStatus('key_required');
          return;
        }
      }

      // 4. Build assistant configuration with strict 30s silence timeout & anti-repetition directives
      const overrides = buildVapiAssistantConfig(candidate);

      // 5. Start call via vapiService
      await vapiService.startCall(assistantId, overrides, key);
    } catch (err: any) {
      if (isNormalMeetingEnd(err)) {
        setVapiCallStatus('ended');
        return;
      }
      console.error('Failed to initiate Vapi call:', err);
      const classified = classifyVoiceError(err);
      setVoiceError(classified);
      setErrorMessage(classified.message);
      if (classified.type === 'auth') {
        setVapiCallStatus('key_required');
      } else {
        setVapiCallStatus('error');
      }
    }
  };

  // Method to end call using vapiService.stopCall
  const handleEndCall = () => {
    vapiService.stopCall();
    setVapiCallStatus('ended');
    finalizeCallRecord();
  };

  const handleCloseModal = () => {
    if (vapiCallStatus === 'active' || vapiCallStatus === 'connecting') {
      vapiService.stopCall();
    }
    vapiService.resetToIdle();
    setVapiCallStatus('idle');
    onClose();
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    vapiService.setMuted(nextMuted);
  };

  const handleRetry = () => {
    handleStartCall();
  };

  const handleSaveAndConnectKey = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!apiKeyInput.trim()) return;
    setIsConnectingKey(true);
    setErrorMessage(null);
    try {
      const cleanKey = apiKeyInput.trim();
      vapiService.setStoredPublicKey(cleanKey);
      await handleStartCall(cleanKey);
    } catch (err: any) {
      console.error('Error connecting with entered key:', err);
      setErrorMessage(err.message || 'Unable to connect using provided Vapi key.');
      setVapiCallStatus('error');
    } finally {
      setIsConnectingKey(false);
    }
  };

  const handleSwitchToInteractive = () => {
    handleCloseModal();
    if (candidate && onSwitchToInteractive) {
      onSwitchToInteractive(candidate);
    }
  };

  const finalizeCallRecord = async () => {
    if (!candidate || hasFinalizedRef.current) return;
    hasFinalizedRef.current = true;

    const chatMessages: ChatMessage[] = transcript.map((m) => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      timestamp: m.timestamp,
    }));

    const callId = `vapi-call-${Date.now()}`;
    let postCallResult: any = null;
    let summary = `Live voice screening conducted via Vapi AI Assistant. Duration: ${Math.floor(duration / 60)}m ${duration % 60}s with ${chatMessages.length} spoken exchanges.`;
    let scorecard = candidate.scorecard;

    try {
      const res = await fetch('/api/call/process-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate,
          transcript: chatMessages,
          callScenario: 'screening',
          callDuration: duration,
          callId,
        }),
      });
      postCallResult = await res.json();
      if (postCallResult?.summary) summary = postCallResult.summary;
      if (postCallResult?.scorecard) scorecard = postCallResult.scorecard;
    } catch (err) {
      console.warn('Vapi post-call processing fallback:', err);
    }

    const mergedScreening = {
      ...candidate.screening,
      ...(postCallResult?.extractedFields || {}),
    };

    const analyzedStatus = postCallResult?.statusAnalysis?.candidateStatus ||
      (duration > 15 ? 'Screened - Ready for Interview' : candidate.status);
    const analyzedInterviewStatus = postCallResult?.statusAnalysis?.interviewStatus || candidate.interviewStatus;
    const analyzedOutcome = postCallResult?.statusAnalysis?.hrDecisionOutcome || candidate.hrDecisionOutcome || 'SCREENING_COMPLETED';

    const finalRemarkObj = postCallResult?.factBasedRemark || {
      text: `Vapi screening finished for ${candidate.appliedRole}. Total ${chatMessages.length} exchanges recorded.`,
      priority: 'High',
      category: 'Interview Scheduled',
      actionDueDate: 'Tomorrow',
    };

    const newRemark: CandidateRemark = {
      id: `rem-${Date.now()}`,
      text: finalRemarkObj.text,
      priority: (finalRemarkObj.priority as any) || 'High',
      category: (finalRemarkObj.category as any) || 'Screening Follow-up',
      createdAt: new Date().toISOString(),
      actionDueDate: finalRemarkObj.actionDueDate || 'Tomorrow',
      author: 'Arjun (Virtual AI HR - Vapi Live)',
    };

    const callRecord: CallRecord = {
      id: callId,
      candidateId: candidate.id,
      candidateName: candidate.name,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      scenario: 'screening',
      durationSeconds: duration,
      transcript: chatMessages,
      summary,
      outcome: analyzedStatus,
      extractedFields: mergedScreening,
      conversationMemory: postCallResult?.conversationMemory || candidate.conversationMemory,
      hrDecisionOutcome: analyzedOutcome,
      afterCallAction: postCallResult?.afterCallAction || candidate.afterCallAction,
    };

    const updatedCandidate: Candidate = {
      ...candidate,
      status: analyzedStatus as any,
      interviewStatus: analyzedInterviewStatus as any,
      screening: mergedScreening,
      callCount: candidate.callCount + 1,
      lastCallDate: new Date().toISOString().split('T')[0],
      scorecard: scorecard || candidate.scorecard,
      conversationMemory: postCallResult?.conversationMemory || candidate.conversationMemory,
      hrDecisionOutcome: analyzedOutcome,
      afterCallAction: postCallResult?.afterCallAction || candidate.afterCallAction,
      latestRemark: newRemark,
      remarksHistory: [newRemark, ...(candidate.remarksHistory || [])],
      alertDueDate: newRemark.actionDueDate === 'Tomorrow' ? 'Tomorrow' : 'Today',
      alertReason: `${newRemark.priority} Priority: ${newRemark.category} - ${newRemark.text.substring(0, 75)}...`,
      callHistory: [callRecord, ...(candidate.callHistory || [])],
    };

    onCallEnded?.(updatedCandidate);
  };

  if (!isOpen) return null;

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[#0d1526] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-[#101a30] to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-amber-500/20 shrink-0">
              <Sparkles className="w-5 h-5 text-slate-950" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white truncate font-['Space_Grotesk']">
                  {candidate?.name || 'Screening Candidate'}
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                  Vapi Voice Assistant
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 truncate">
                <span>{candidate?.appliedRole || 'Real Estate Consultant'}</span>
                {candidate?.screening?.currentCompany && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="truncate">{candidate.screening.currentCompany}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Status Badge */}
            {vapiCallStatus === 'idle' && (
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                <Radio className="w-3 h-3 text-slate-400" />
                <span>Idle</span>
              </span>
            )}
            {vapiCallStatus === 'connecting' && (
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Connecting...</span>
              </span>
            )}
            {vapiCallStatus === 'active' && (
              <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 flex items-center gap-1.5 shadow-xs shadow-emerald-950/40">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                <span>Call Active</span>
                <span className="font-mono text-emerald-200 ml-1">({formatTime(duration)})</span>
              </span>
            )}
            {vapiCallStatus === 'ended' && (
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-slate-400" />
                <span>Call Ended</span>
              </span>
            )}
            {vapiCallStatus === 'key_required' && (
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                <Key className="w-3 h-3 text-amber-400" />
                <span>Key Required</span>
              </span>
            )}
            {vapiCallStatus === 'error' && (
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-rose-400" />
                <span>Error</span>
              </span>
            )}

            <button
              onClick={handleCloseModal}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Assistant / Audio Visualizer Box */}
        <div className="p-6 bg-slate-950/60 border-b border-slate-800 flex flex-col items-center justify-center text-center relative overflow-hidden">
          {/* Ambient Glow */}
          <div className={`absolute inset-0 transition-opacity duration-700 pointer-events-none ${
            vapiCallStatus === 'active' 
              ? isAgentSpeaking 
                ? 'bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent opacity-100' 
                : 'bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-transparent opacity-100'
              : 'opacity-0'
          }`} />

          {/* Avatar Ring */}
          <div className="relative mb-3.5 z-10">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center border transition-all duration-300 ${
              vapiCallStatus === 'active'
                ? isAgentSpeaking
                  ? 'bg-gradient-to-br from-amber-500/30 to-amber-600/20 border-amber-400/60 shadow-lg shadow-amber-500/30 scale-105'
                  : 'bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border-emerald-400/50 shadow-lg shadow-emerald-500/20'
                : vapiCallStatus === 'connecting'
                ? 'bg-amber-500/10 border-amber-500/30 animate-pulse'
                : 'bg-slate-800 border-slate-700'
            }`}>
              <Bot className={`w-10 h-10 ${
                vapiCallStatus === 'active' 
                  ? isAgentSpeaking ? 'text-amber-400' : 'text-emerald-400'
                  : 'text-slate-400'
              }`} />
            </div>

            {/* Radar ring when active */}
            {vapiCallStatus === 'active' && (
              <span className="absolute -inset-2 rounded-2xl border border-amber-400/30 animate-ping pointer-events-none opacity-40" />
            )}
          </div>

          {/* Voice State Title */}
          <div className="z-10">
            <h4 className="text-sm font-bold text-white flex items-center justify-center gap-2">
              <span>Agent Arjun (HR Recruiter)</span>
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Vapi WebRTC
              </span>
            </h4>

            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {vapiCallStatus === 'idle' && (
                <span className="text-slate-300">Ready to initiate live voice screening with Arjun. Click below to begin.</span>
              )}
              {vapiCallStatus === 'connecting' && (
                <span className="text-amber-300">Connecting WebRTC audio stream to assistant ({assistantId.substring(0, 8)}...)...</span>
              )}
              {vapiCallStatus === 'active' && (
                isAgentSpeaking ? (
                  <span className="text-amber-400 font-medium">Arjun is speaking...</span>
                ) : (
                  <span className="text-emerald-400 font-medium">Listening to candidate (Full Duplex Mic Live)...</span>
                )
              )}
              {vapiCallStatus === 'ended' && (
                <span className="text-slate-400">Call concluded. Total duration: {formatTime(duration)}.</span>
              )}
              {vapiCallStatus === 'key_required' && (
                <span className="text-amber-300">Vapi Public API Key required to establish live WebRTC audio link.</span>
              )}
              {vapiCallStatus === 'error' && (
                <span className="text-rose-400">Call failed to connect.</span>
              )}
            </p>

            {/* In-visualizer Start Voice Screening Action when Idle */}
            {vapiCallStatus === 'idle' && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  id="btn-start-voice-screening-hero"
                  type="button"
                  onClick={() => handleStartCall()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 transition active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span>Start Voice Screening</span>
                </button>
              </div>
            )}
          </div>

          {/* Dynamic Voice Bars (Google / Alexa equalizer) */}
          {vapiCallStatus === 'active' && (
            <div className="flex items-center gap-1.5 mt-4 h-6 z-10">
              {[40, 75, 55, 90, 60, 85, 45].map((baseHeight, idx) => {
                const dynamicHeight = isAgentSpeaking
                  ? Math.max(15, (baseHeight * (volumeLevel || 0.4)))
                  : 12;
                return (
                  <div
                    key={idx}
                    className={`w-1 rounded-full transition-all duration-150 ${
                      isAgentSpeaking ? 'bg-amber-400' : 'bg-emerald-400/60'
                    }`}
                    style={{ height: `${dynamicHeight}px` }}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Key Configuration / Setup Panel when key is required */}
        {vapiCallStatus === 'key_required' && (
          <div className="m-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/30 text-xs shadow-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Key className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="font-bold text-white text-sm">Vapi Public API Key Configuration</h5>
                <p className="text-slate-300 mt-1 leading-relaxed">
                  To connect with the live WebRTC assistant (<code className="text-amber-300 font-mono text-[11px]">{assistantId.substring(0, 8)}...</code>), enter your Vapi Public Key below or continue with the built-in Interactive Voice Recruiter.
                </p>

                <form onSubmit={handleSaveAndConnectKey} className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Paste Vapi Public Key (e.g. 4b87c09e-...)"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={!apiKeyInput.trim() || isConnectingKey}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
                  >
                    {isConnectingKey ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>Start Voice Screening</span>
                  </button>
                </form>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px]">
                  <span className="text-slate-400">
                    Saved keys persist in browser storage.
                  </span>

                  {onSwitchToInteractive && (
                    <button
                      type="button"
                      onClick={handleSwitchToInteractive}
                      className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-bold transition underline underline-offset-4"
                    >
                      <span>Switch to Interactive AI Recruiter (No Key Required)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Error Alert Card for specific voice call errors */}
        {errorMessage && vapiCallStatus === 'error' && (
          <div
            className={`m-4 p-4.5 rounded-2xl border flex flex-col sm:flex-row items-start justify-between gap-4 text-xs shadow-lg transition-all ${
              voiceError?.type === 'mic_permission'
                ? 'bg-gradient-to-r from-rose-950/60 via-amber-950/30 to-slate-900 border-rose-500/50 text-rose-100'
                : voiceError?.type === 'network_timeout'
                ? 'bg-gradient-to-r from-amber-950/50 via-slate-900 to-slate-950 border-amber-500/50 text-amber-100'
                : voiceError?.type === 'mic_missing'
                ? 'bg-gradient-to-r from-rose-950/60 via-slate-900 to-slate-950 border-rose-500/50 text-rose-100'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-md ${
                  voiceError?.type === 'mic_permission' || voiceError?.type === 'mic_missing'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    : voiceError?.type === 'network_timeout'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {voiceError?.type === 'mic_permission' || voiceError?.type === 'mic_missing' ? (
                  <MicOff className="w-5 h-5" />
                ) : voiceError?.type === 'network_timeout' ? (
                  <Radio className="w-5 h-5 animate-pulse" />
                ) : (
                  <ShieldAlert className="w-5 h-5" />
                )}
              </div>

              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <h5 className="font-bold text-sm text-white">
                    {voiceError?.title || (errorMessage.includes('Microphone') ? 'Microphone Permission Required' : 'Voice Screening Notice')}
                  </h5>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      voiceError?.type === 'mic_permission'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : voiceError?.type === 'network_timeout'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {voiceError?.type ? voiceError.type.replace('_', ' ') : 'Voice Alert'}
                  </span>
                </div>

                <p className="text-slate-300 leading-relaxed text-xs">
                  {errorMessage}
                </p>

                {/* Specific Action Guidance */}
                {voiceError?.actionHint ? (
                  <p className="text-[11px] text-amber-300/90 font-medium pt-0.5">
                    💡 {voiceError.actionHint}
                  </p>
                ) : errorMessage.includes('Microphone') ? (
                  <div className="bg-slate-950/50 rounded-xl p-2.5 border border-slate-800/80 text-[11px] text-slate-300 space-y-1 mt-1">
                    <p className="font-semibold text-rose-300">How to allow microphone access:</p>
                    <ol className="list-decimal list-inside space-y-0.5 text-slate-400">
                      <li>Click the lock or camera icon in your browser URL address bar</li>
                      <li>Switch <strong>Microphone</strong> permission from Blocked to <strong>Allow</strong></li>
                      <li>Click <strong>Allow Mic &amp; Retry</strong> below</li>
                    </ol>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0 self-end sm:self-center w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
              <button
                type="button"
                onClick={handleRetry}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{voiceError?.type === 'mic_permission' ? 'Allow Mic & Retry' : 'Retry Call'}</span>
              </button>

              {onSwitchToInteractive && (
                <button
                  type="button"
                  onClick={handleSwitchToInteractive}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border border-slate-700 transition cursor-pointer"
                >
                  <span>AI Recruiter</span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Live Conversation Transcript Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[160px] max-h-72 bg-[#090e1a]">
          <div className="text-center">
            <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-500 bg-slate-900/80 px-2.5 py-1 rounded-full border border-slate-800">
              Live WebRTC Transcript Feed
            </span>
          </div>

          {transcript.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              {vapiCallStatus === 'idle' ? (
                <span>Click &apos;Start Voice Screening&apos; to begin the conversation with Arjun.</span>
              ) : vapiCallStatus === 'connecting' ? (
                <span>Establishing audio link... speak when connected.</span>
              ) : vapiCallStatus === 'active' ? (
                <span>Assistant is preparing opening greeting...</span>
              ) : (
                <span>No conversation logged yet.</span>
              )}
            </div>
          ) : (
            transcript.map((msg, index) => (
              <div
                key={`${msg.id || 'msg'}-${index}`}
                className={`flex items-start gap-2.5 ${
                  msg.sender === 'agent' ? 'justify-start' : 'justify-end'
                }`}
              >
                {msg.sender === 'agent' && (
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-xl p-3 text-xs leading-relaxed shadow-sm ${
                    msg.sender === 'agent'
                      ? 'bg-slate-900 border border-slate-800 text-slate-200'
                      : 'bg-amber-600 text-slate-950 font-medium'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] opacity-70 mb-1">
                    <span className="font-bold">
                      {msg.sender === 'agent' ? 'Arjun (Virtual HR)' : (candidate?.name || 'Candidate')}
                    </span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <div>{msg.text}</div>
                </div>

                {msg.sender === 'candidate' && (
                  <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 shrink-0 mt-0.5 font-bold text-xs">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={transcriptEndRef} />
        </div>

        {/* Footer Action Bar */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {vapiCallStatus === 'active' && (
              <button
                type="button"
                onClick={handleToggleMute}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition border ${
                  isMuted
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                }`}
              >
                {isMuted ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{isMuted ? 'Muted' : 'Mic Live'}</span>
              </button>
            )}

            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Assistant ID: <code className="text-slate-400 font-mono text-[10px]">{assistantId.substring(0, 16)}...</code>
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Start Voice Screening button when idle, ended, error, or key_required */}
            {(vapiCallStatus === 'idle' || vapiCallStatus === 'ended' || vapiCallStatus === 'error') && (
              <button
                id="btn-start-voice-screening"
                type="button"
                onClick={() => handleStartCall()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>Start Voice Screening</span>
              </button>
            )}

            {/* Connecting State */}
            {vapiCallStatus === 'connecting' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-wait"
                >
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Connecting...</span>
                </button>
                <button
                  id="btn-vapi-end-connecting"
                  type="button"
                  onClick={handleEndCall}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition active:scale-95 cursor-pointer shadow-md shadow-rose-950/40"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  <span>End Call</span>
                </button>
              </div>
            )}

            {/* Active State: End Call button */}
            {vapiCallStatus === 'active' && (
              <button
                id="btn-vapi-end-call"
                type="button"
                onClick={handleEndCall}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/40 transition active:scale-95 cursor-pointer"
              >
                <PhoneOff className="w-4 h-4" />
                <span>End Call</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
