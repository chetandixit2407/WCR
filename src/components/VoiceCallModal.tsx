import React, { useState, useEffect, useRef } from 'react';
import { 
  PhoneOff, Mic, MicOff, Volume2, VolumeX, Sparkles, Send, 
  Calendar, CheckCircle, Clock, Building2, Globe, AlertCircle, 
  Bot, User, UserX, RefreshCw, Mail, MessageSquare, Waves, Radio, Activity,
  ShieldCheck, Layers, Lock, CheckSquare, HelpCircle, AlertTriangle, Brain, Eye, Award
} from 'lucide-react';
import { 
  Candidate, ChatMessage, CallScenario, ScreeningData, InterviewSlot,
  CandidateRemark, RemarkPriority, RemarkCategory,
  ConversationMemory, HrDecisionOutcome, AfterCallAction,
  QuestionStateEngine, QuestionTopic, RealTimeBehaviorState
} from '../types';
import { WHITE_COLLAR_JOB_DESCRIPTIONS } from '../data/jobDescriptions';
import { voiceAudio } from '../utils/audioSpeech';
import { GeminiLiveClient } from '../utils/geminiLiveClient';
import {
  createInitialQuestionStateEngine,
  recordQuestionSpoken,
  recordAnswerReceived,
  evaluateQuestionGate,
  detectQuestionTopic
} from '../utils/questionStateEngine';


interface VoiceCallModalProps {
  candidate: Candidate;
  scenario: CallScenario;
  availableSlots: InterviewSlot[];
  onClose: () => void;
  onCallEnded: (updatedCandidate: Candidate, bookedSlotId?: string) => void;
  onOpenWhatsApp?: (candidate: Candidate, template?: 'unanswered' | 'interview_reminder' | 'missed_followup') => void;
  onOpenConfirmationMail?: (candidate: Candidate) => void;
}

export const VoiceCallModal: React.FC<VoiceCallModalProps> = ({
  candidate,
  scenario,
  availableSlots,
  onClose,
  onCallEnded,
  onOpenWhatsApp,
  onOpenConfirmationMail,
}) => {
  const [callStatus, setCallStatus] = useState<'ringing' | 'connected' | 'ended' | 'error'>('ringing');
  const [callDuration, setCallDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState<boolean>(false);
  const [isInterrupted, setIsInterrupted] = useState<boolean>(false);
  const [candidateVolume, setCandidateVolume] = useState<number>(0);
  const [agentVolume, setAgentVolume] = useState<number>(0);
  const [languageMode, setLanguageMode] = useState<'Auto' | 'English' | 'Hindi'>('Auto');
  const [inputMessage, setInputMessage] = useState<string>('');
  const [transcript, setTranscript] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live extracted screening state during call
  const [extracted, setExtracted] = useState<Partial<ScreeningData>>(candidate.screening || {});
  const [detectedIntent, setDetectedIntent] = useState<string>('');
  const [bookedSlotId, setBookedSlotId] = useState<string | undefined>(candidate.interviewSlotId);
  const [callbackTime, setCallbackTime] = useState<string | undefined>(candidate.callbackTime);
  const [declineReason, setDeclineReason] = useState<string | undefined>(candidate.declineReason);
  const [statusRec, setStatusRec] = useState<string>(candidate.status);
  const [latestGeneratedRemark, setLatestGeneratedRemark] = useState<{
    text: string;
    priority: RemarkPriority;
    category: RemarkCategory;
    actionDueDate?: string;
  } | null>(candidate.latestRemark ? {
    text: candidate.latestRemark.text,
    priority: candidate.latestRemark.priority,
    category: candidate.latestRemark.category,
    actionDueDate: candidate.latestRemark.actionDueDate,
  } : null);

  const [conversationMemory, setConversationMemory] = useState<Partial<ConversationMemory>>(
    candidate.conversationMemory || {
      candidate_name: candidate.name,
      target_role: candidate.appliedRole,
      current_company: candidate.screening?.currentCompany || '',
      designation: candidate.screening?.currentDesignation || '',
      total_experience: candidate.screening?.totalExperienceYears ? `${candidate.screening.totalExperienceYears} years` : '',
      real_estate_experience: candidate.screening?.realEstateExperienceYears ? `${candidate.screening.realEstateExperienceYears} years` : '',
      gurgaon_experience: candidate.screening?.gurgaonDubaiExperience?.gurgaon ? 'Yes' : 'Unconfirmed',
      dubai_experience: candidate.screening?.gurgaonDubaiExperience?.dubai ? 'Yes' : 'No',
      current_salary: candidate.screening?.currentSalaryLPA || '',
      expected_salary: candidate.screening?.expectedSalaryLPA || '',
      salary_not_disclosed: false,
      current_location: candidate.screening?.currentLocation || '',
      notice_period: candidate.screening?.noticePeriodDays !== undefined ? `${candidate.screening.noticePeriodDays} days` : '',
      earliest_joining_date: candidate.screening?.earliestJoiningDate || '',
      interested: 'Yes',
      interview_date: candidate.interviewDate || '',
      interview_time: candidate.interviewTime || '',
      conversation_status: 'IN_PROGRESS',
      missing_information: [],
      next_action: 'Conduct initial screening',
    }
  );

  const [hrDecisionOutcome, setHrDecisionOutcome] = useState<HrDecisionOutcome | undefined>(candidate.hrDecisionOutcome);
  const [afterCallAction, setAfterCallAction] = useState<AfterCallAction | null>(candidate.afterCallAction || null);
  const [rightPanelTab, setRightPanelTab] = useState<'checklist' | 'questions' | 'behavior' | 'memory' | 'action'>('checklist');
  const [realTimeBehavior, setRealTimeBehavior] = useState<RealTimeBehaviorState | null>(null);
  const [questionEngineState, setQuestionEngineState] = useState<QuestionStateEngine>(() =>
    createInitialQuestionStateEngine(candidate)
  );

  const analyzeCandidateTurnLive = async (turnText: string) => {
    try {
      const res = await fetch('/api/brain/behavior/analyze-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turnText,
          previousAgentText: transcript.filter((t) => t.sender === 'agent').slice(-1)[0]?.text,
          turnIndex: transcript.length + 1,
          callStage: rightPanelTab === 'questions' ? 'QUESTIONING' : 'SCREENING',
          candidateName: candidate.name,
          callId: `call_${Date.now()}_${candidate.id}`,
          existingState: realTimeBehavior,
        }),
      });
      if (res.ok) {
        const updatedState = await res.json();
        setRealTimeBehavior(updatedState);
      }
    } catch (e) {
      console.warn('Real-time behavior turn analysis non-blocking error:', e);
    }
  };

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const liveClientRef = useRef<GeminiLiveClient | null>(null);
  const interruptTimeoutRef = useRef<any>(null);
  const stopRingRef = useRef<(() => void) | null>(null);
  const isCallEndedRef = useRef<boolean>(false);

  // Synchronous, idempotent cleanup helper for call termination
  const terminateAudioPipeline = () => {
    isCallEndedRef.current = true;
    fetch(`/api/candidate/${candidate.id}/unlock`, { method: 'POST' }).catch(() => {});
    if (stopRingRef.current) {
      try {
        stopRingRef.current();
      } catch {}
      stopRingRef.current = null;
    }
    if (interruptTimeoutRef.current) {
      clearTimeout(interruptTimeoutRef.current);
      interruptTimeoutRef.current = null;
    }
    if (liveClientRef.current) {
      try {
        liveClientRef.current.stop();
      } catch {}
      liveClientRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  };

  // Initialize Gemini Live Client
  useEffect(() => {
    let isMounted = true;
    isCallEndedRef.current = false;

    // Acquire Calling Lock (Rule 16)
    fetch(`/api/candidate/${candidate.id}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId: `live-${Date.now()}` }),
    }).catch(() => {});

    // Discard any lingering SpeechSynthesis speech
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    const stopRing = voiceAudio.playRingTone();
    stopRingRef.current = stopRing;

    const sessionId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const client = new GeminiLiveClient(
      {
        onStatusChange: (status) => {
          if (!isMounted || isCallEndedRef.current) return;
          if (status === 'connected') {
            if (stopRingRef.current) {
              stopRingRef.current();
              stopRingRef.current = null;
            }
            voiceAudio.playConnectChime();
            setCallStatus('connected');
            setErrorMessage(null);
          } else if (status === 'ended') {
            if (stopRingRef.current) {
              stopRingRef.current();
              stopRingRef.current = null;
            }
            setCallStatus('ended');
          } else if (status === 'error') {
            if (stopRingRef.current) {
              stopRingRef.current();
              stopRingRef.current = null;
            }
            setCallStatus('error');
          }
        },
        onAgentTranscript: (chunk) => {
          if (!isMounted || isCallEndedRef.current) return;
          setTranscript((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.sender === 'agent') {
              return [
                ...prev.slice(0, -1),
                { ...last, text: last.text + chunk }
              ];
            }
            return [
              ...prev,
              {
                id: `msg-${Date.now()}-${Math.random()}`,
                sender: 'agent',
                text: chunk,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              }
            ];
          });
        },
        onUserTranscript: (text, isFinal) => {
          if (!isMounted || isCallEndedRef.current) return;
          setTranscript((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.sender === 'candidate') {
              return [
                ...prev.slice(0, -1),
                { ...last, text: text }
              ];
            }
            return [
              ...prev,
              {
                id: `msg-${Date.now()}-${Math.random()}`,
                sender: 'candidate',
                text: text,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              }
            ];
          });
        },
        onAgentSpeakingChange: (isSpeaking) => {
          if (!isMounted || isCallEndedRef.current) return;
          setIsAgentSpeaking(isSpeaking);
        },
        onInterrupted: () => {
          if (!isMounted || isCallEndedRef.current) return;
          setIsInterrupted(true);
          if (interruptTimeoutRef.current) clearTimeout(interruptTimeoutRef.current);
          interruptTimeoutRef.current = setTimeout(() => {
            if (isMounted && !isCallEndedRef.current) {
              setIsInterrupted(false);
            }
          }, 1800);
        },
        onToolCall: (name, args) => {
          if (!isMounted || isCallEndedRef.current) return;
          handleToolCall(name, args);
        },
        onTurnComplete: () => {
          if (!isMounted || isCallEndedRef.current) return;
          setIsProcessing(false);
        },
        onVolumeChange: (uVol, aVol) => {
          if (!isMounted || isCallEndedRef.current) return;
          setCandidateVolume(uVol);
          setAgentVolume(aVol);
        },
        onError: (msg) => {
          if (!isMounted || isCallEndedRef.current) return;
          setErrorMessage(msg);
        },
      },
      { sessionId }
    );

    liveClientRef.current = client;

    // Start Live voice session
    client.start(candidate, scenario, availableSlots, languageMode);

    return () => {
      isMounted = false;
      terminateAudioPipeline();
    };
  }, []);

  // Duration timer
  useEffect(() => {
    let interval: any = null;
    if (callStatus === 'connected') {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, isAgentSpeaking]);

  const handleToolCall = (name: string, args: any) => {
    console.log('[VoiceCallModal] Processing tool call:', name, args);

    if (name === 'updateCandidateScreening') {
      setExtracted((prev) => {
        const next = { ...prev };
        if (args.currentCompany) next.currentCompany = args.currentCompany;
        if (args.currentDesignation) next.currentDesignation = args.currentDesignation;
        if (args.totalExperienceYears !== undefined) next.totalExperienceYears = args.totalExperienceYears;
        if (args.realEstateExperienceYears !== undefined) next.realEstateExperienceYears = args.realEstateExperienceYears;
        if (args.currentSalaryLPA) next.currentSalaryLPA = args.currentSalaryLPA;
        if (args.expectedSalaryLPA) next.expectedSalaryLPA = args.expectedSalaryLPA;
        if (args.noticePeriodDays !== undefined) next.noticePeriodDays = args.noticePeriodDays;
        if (args.currentLocation) next.currentLocation = args.currentLocation;
        if (args.earliestJoiningDate) next.earliestJoiningDate = args.earliestJoiningDate;
        if (args.hasGurgaonExperience !== undefined || args.hasDubaiExperience !== undefined) {
          next.gurgaonDubaiExperience = {
            gurgaon: args.hasGurgaonExperience ?? next.gurgaonDubaiExperience?.gurgaon ?? false,
            dubai: args.hasDubaiExperience ?? next.gurgaonDubaiExperience?.dubai ?? false,
            details: args.gurgaonDubaiDetails || next.gurgaonDubaiExperience?.details || '',
          };
        }
        return next;
      });

      setConversationMemory((prev) => ({
        ...prev,
        current_company: args.currentCompany || prev.current_company,
        designation: args.currentDesignation || prev.designation,
        total_experience: args.totalExperienceYears ? `${args.totalExperienceYears} years` : prev.total_experience,
        real_estate_experience: args.realEstateExperienceYears ? `${args.realEstateExperienceYears} years` : prev.real_estate_experience,
        gurgaon_experience: args.hasGurgaonExperience ? 'Yes' : prev.gurgaon_experience,
        dubai_experience: args.hasDubaiExperience ? 'Yes' : prev.dubai_experience,
        current_salary: args.currentSalaryLPA || prev.current_salary,
        expected_salary: args.expectedSalaryLPA || prev.expected_salary,
        current_location: args.currentLocation || prev.current_location,
        notice_period: args.noticePeriodDays !== undefined ? `${args.noticePeriodDays} days` : prev.notice_period,
        earliest_joining_date: args.earliestJoiningDate || prev.earliest_joining_date,
      }));
    } else if (name === 'scheduleFaceToFaceInterview') {
      if (args.selectedSlotId) {
        setBookedSlotId(args.selectedSlotId);
      }
      setConversationMemory((prev) => ({
        ...prev,
        interview_date: args.interviewDate || prev.interview_date,
        interview_time: args.interviewTime || prev.interview_time,
        next_action: 'Face-to-face interview scheduled at Sector 67 Gurugram HQ',
      }));
      setStatusRec('Interview Scheduled');
      setDetectedIntent('confirm_interview');
    } else if (name === 'recordCallDisposition') {
      if (args.callbackTime) {
        setCallbackTime(args.callbackTime);
        setStatusRec('Callback Needed');
        setDetectedIntent('request_callback');
      }
      if (args.declineReason) {
        setDeclineReason(args.declineReason);
        setStatusRec('Declined - Do Not Call');
        setDetectedIntent('cancel_decline');
      }
      if (args.outcome) {
        setHrDecisionOutcome(args.outcome as HrDecisionOutcome);
      }
    }
  };

  const handleToggleMute = () => {
    if (!liveClientRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    liveClientRef.current.setMuted(nextMuted);
  };

  const handleInterruptAgent = () => {
    if (!liveClientRef.current) return;
    liveClientRef.current.stopAgentPlayback();
    setIsInterrupted(true);
    setTimeout(() => setIsInterrupted(false), 1200);
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || !liveClientRef.current) return;

    liveClientRef.current.sendText(text);

    // Add candidate turn immediately to transcript
    setTranscript((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        sender: 'candidate',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    setInputMessage('');
    setIsProcessing(true);

    // Continuous Real-Time Behavior Intelligence Signal Extraction
    analyzeCandidateTurnLive(text);
  };

  const handleSimulateSilence = () => {
    if (!liveClientRef.current) return;
    liveClientRef.current.sendText('[Candidate remains silent on the phone]');
  };

  // End Call & Commit Changes
  const handleEndCall = async () => {
    terminateAudioPipeline();
    voiceAudio.playDisconnectTone();
    setCallStatus('ended');

    const callId = `call_${Date.now()}_${candidate.id}`;
    let summary = `Voice screening call completed (${Math.floor(callDuration / 60)}m ${callDuration % 60}s).`;
    let scorecard = candidate.scorecard;
    let postCallResult: any = null;

    try {
      const completionRes = await fetch('/api/call/process-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate,
          transcript,
          callScenario: scenario,
          callDuration,
          availableSlots,
          bookedSlotId,
          callId,
        }),
      });
      postCallResult = await completionRes.json();
      if (postCallResult?.summary) summary = postCallResult.summary;
      if (postCallResult?.scorecard) scorecard = postCallResult.scorecard;
      if (postCallResult?.factBasedRemark) {
        setLatestGeneratedRemark(postCallResult.factBasedRemark);
      }
      if (postCallResult?.afterCallAction) {
        setAfterCallAction(postCallResult.afterCallAction);
      }
      if (postCallResult?.conversationMemory) {
        setConversationMemory(postCallResult.conversationMemory);
      }
    } catch (e) {
      console.warn('Post-call completion pipeline fallback:', e);
    }

    // Extract analyzed statuses and fields
    const analyzedStatus = postCallResult?.statusAnalysis?.candidateStatus || statusRec;
    const analyzedInterviewStatus = postCallResult?.statusAnalysis?.interviewStatus || candidate.interviewStatus;
    const analyzedOutcome = postCallResult?.statusAnalysis?.hrDecisionOutcome || hrDecisionOutcome;
    const resolvedCallback = postCallResult?.statusAnalysis?.callbackTime || callbackTime;
    const resolvedDecline = postCallResult?.statusAnalysis?.declineReason || declineReason;
    const finalSlotId = postCallResult?.statusAnalysis?.bookedSlotId || bookedSlotId;
    const chosenSlot = availableSlots.find((s) => s.id === finalSlotId);

    // Merge extracted fields
    const mergedScreening = {
      ...candidate.screening,
      ...extracted,
      ...(postCallResult?.extractedFields || {}),
    };

    const finalRemarkObj = postCallResult?.factBasedRemark || latestGeneratedRemark || {
      text: chosenSlot
        ? `F2F Interview confirmed for ${chosenSlot.displayLabel || chosenSlot.date} at Sector 67 Gurugram HQ.`
        : `Screening completed for ${candidate.appliedRole}. Profile updated for White Collar Realty hiring.`,
      priority: 'High',
      category: 'Interview Scheduled',
      actionDueDate: 'Tomorrow',
    };

    const rawActionDue = finalRemarkObj.actionDueDate || 'Today';
    const alertDueDate: 'Overdue' | 'Today' | 'Tomorrow' | 'Upcoming' =
      rawActionDue === 'Tomorrow' ? 'Tomorrow' : rawActionDue === 'Overdue' ? 'Overdue' : 'Today';

    const newRemark: CandidateRemark = {
      id: `rem-${Date.now()}`,
      text: finalRemarkObj.text,
      priority: (finalRemarkObj.priority as RemarkPriority) || 'High',
      category: (finalRemarkObj.category as RemarkCategory) || 'Interview Scheduled',
      createdAt: new Date().toISOString(),
      actionDueDate: rawActionDue,
      author: 'Arjun (Virtual AI HR - White Collar Brain)',
    };

    const updatedCandidate: Candidate = {
      ...candidate,
      status: analyzedStatus as any,
      interviewStatus: analyzedInterviewStatus as any,
      screening: mergedScreening,
      interviewSlotId: finalSlotId || candidate.interviewSlotId,
      interviewDate: chosenSlot ? chosenSlot.date : candidate.interviewDate,
      interviewTime: chosenSlot ? chosenSlot.time : candidate.interviewTime,
      interviewVenue: chosenSlot ? chosenSlot.venue : candidate.interviewVenue,
      lastCallDate: new Date().toISOString().replace('T', ' ').substring(0, 16),
      callCount: candidate.callCount + 1,
      callbackTime: resolvedCallback || candidate.callbackTime,
      declineReason: resolvedDecline || candidate.declineReason,
      notes: summary,
      scorecard: scorecard || candidate.scorecard,
      conversationMemory: (postCallResult?.conversationMemory || conversationMemory) as ConversationMemory,
      hrDecisionOutcome: analyzedOutcome as HrDecisionOutcome,
      afterCallAction: postCallResult?.afterCallAction || afterCallAction || undefined,
      latestBehaviorReport: postCallResult?.behaviorReport || candidate.latestBehaviorReport,
      latestRemark: newRemark,
      remarksHistory: [newRemark, ...(candidate.remarksHistory || [])],
      alertDueDate: alertDueDate,
      alertReason: `${newRemark.priority} Priority: ${newRemark.category} - ${newRemark.text.substring(0, 75)}...`,
      callHistory: [
        {
          id: callId,
          candidateId: candidate.id,
          candidateName: candidate.name,
          timestamp: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
          scenario,
          durationSeconds: callDuration,
          transcript,
          summary,
          outcome: analyzedStatus,
          extractedFields: mergedScreening,
          detectedIntent,
          callbackTime: resolvedCallback,
          declineReason: resolvedDecline,
          conversationMemory: (postCallResult?.conversationMemory || conversationMemory) as ConversationMemory,
          hrDecisionOutcome: analyzedOutcome as HrDecisionOutcome,
          afterCallAction: postCallResult?.afterCallAction || afterCallAction || undefined,
          behaviorReport: postCallResult?.behaviorReport,
        },
        ...candidate.callHistory,
      ],
    };

    onCallEnded(updatedCandidate, finalSlotId);
  };

  const handleSimulateUnanswered = () => {
    terminateAudioPipeline();
    voiceAudio.playDisconnectTone();
    setCallStatus('ended');

    const unansweredRemark: CandidateRemark = {
      id: `rem-${Date.now()}`,
      text: `Call attempt ${candidate.unansweredAttempts + 1} went unanswered. Scheduled automated retry follow-up.`,
      priority: 'Medium',
      category: 'Unanswered Retry',
      createdAt: new Date().toISOString(),
      actionDueDate: 'Today',
      author: 'Arjun (Virtual AI HR - Gemini Live)',
    };

    const updatedCandidate: Candidate = {
      ...candidate,
      unansweredAttempts: candidate.unansweredAttempts + 1,
      lastCallDate: new Date().toISOString().replace('T', ' ').substring(0, 16),
      callCount: candidate.callCount + 1,
      notes: `Call unanswered (Attempt ${candidate.unansweredAttempts + 1}). Next retry queued in follow-up system.`,
      latestRemark: unansweredRemark,
      remarksHistory: [unansweredRemark, ...(candidate.remarksHistory || [])],
      alertDueDate: 'Today',
      alertReason: `Medium Priority: Unanswered Retry (Attempt ${candidate.unansweredAttempts + 1})`,
      callHistory: [
        {
          id: `call-${Date.now()}`,
          candidateId: candidate.id,
          candidateName: candidate.name,
          timestamp: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
          scenario,
          durationSeconds: 15,
          transcript: [{ id: 'm0', sender: 'system', text: 'Call rang for 25 seconds. Unanswered by candidate.', timestamp: '12:00' }],
          summary: `Call attempt ${candidate.unansweredAttempts + 1} went unanswered. Automated retry timer scheduled.`,
          outcome: 'Unanswered Call',
          extractedFields: {},
        },
        ...candidate.callHistory,
      ],
    };

    onCallEnded(updatedCandidate);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Quick testing response chips
  const getQuickResponseChips = () => {
    if (scenario === 'reminder') {
      return [
        { label: 'Yes, Attendance Confirmed', text: 'Haanji, I will definitely attend tomorrow at 11:00 AM at your Sector 67 M3M Urbana office.' },
        { label: 'Need to Reschedule', text: 'Actually I have an urgent client visit tomorrow. Can we reschedule to day after tomorrow 3:30 PM?' },
        { label: 'Accepted Another Offer (Decline)', text: 'I have already accepted an offer with another real estate firm, so please cancel.' },
      ];
    }

    if (scenario === 'missed_followup') {
      return [
        { label: 'Apologies, Reschedule', text: 'Extremely sorry, I was held up in emergency travel. Can we reschedule for tomorrow at 2:30 PM?' },
        { label: 'Not Interested Any More', text: 'I am no longer exploring real estate job opportunities. Please close my file.' },
      ];
    }

    const turns = transcript.filter((m) => m.sender === 'candidate').length;
    const commonChips = [
      { label: '🌟 Dubai Exp (3 Years)', text: "I've worked in Dubai luxury real estate for three years." },
      { label: '🌟 DLF + Gurgaon (4 Years)', text: "I'm currently working with DLF Homes in Gurgaon for four years." },
      { label: '🌟 Office Location?', text: 'Where exactly is your office located in Gurgaon?' },
      { label: '🌟 Hinglish Reply', text: 'Haanji main Gurgaon luxury projects mein hi work kar raha hoon.' },
    ];

    if (turns === 0) {
      return [
        { label: 'Yes, speaking', text: 'Yes, speaking.' },
        { label: 'Haanji, main bol raha hu', text: 'Haanji, main bol raha hoon.' },
        { label: 'Wrong number', text: 'No, this is wrong number.' },
        ...commonChips,
      ];
    } else if (turns === 1) {
      return [
        { label: 'Yes, have 2 mins', text: 'Yes, I can speak for two minutes.' },
        { label: 'Haanji, boliye', text: 'Haanji bilkul, kahiye.' },
        { label: 'Salary Range First?', text: 'Could you share the salary range for this position?' },
        { label: 'Driving / Call back at 5:30', text: 'I am driving right now. Please call me back today at 5:30 PM.' },
        ...commonChips,
      ];
    } else if (turns === 2) {
      return [
        { label: 'Square Yards, 4 Yrs Gurgaon', text: 'I am working with Square Yards as Senior Consultant with 4 years experience in Gurgaon luxury residential sales.' },
        { label: 'DLF Consultant, Dubai + Gurgaon', text: 'Currently with DLF Homes with 5 years real estate experience across Gurgaon and Dubai.' },
        ...commonChips,
      ];
    } else if (turns === 3) {
      return [
        { label: 'CTC: 10 LPA Present, 14 Expected', text: 'My current fixed salary is 10 LPA and I am expecting around 14 LPA.' },
        { label: 'Prefer Not To Disclose', text: 'I would prefer not to disclose my current salary, but I am expecting around 13 to 14 LPA.' },
        ...commonChips,
      ];
    } else if (turns === 4) {
      return [
        { label: 'Gurgaon, 15 Days Notice', text: 'I stay in Sector 54 Gurgaon, and my notice period is 15 days.' },
        { label: 'Immediate Joiner, DLF Phase 2', text: 'I stay in DLF Phase 2 Gurugram, ready to join immediately as I have served my notice.' },
        ...commonChips,
      ];
    } else {
      return [
        { label: 'Confirm Tomorrow 02:30 PM', text: 'Tomorrow at 2:30 PM works great for me at your Sector 67 office.' },
        { label: 'Confirm Tomorrow 04:30 PM', text: 'Tomorrow at 4:30 PM fits my schedule best.' },
        { label: 'Reschedule Friday 12 PM', text: 'Can we reschedule to Friday at 12:00 PM instead?' },
        ...commonChips,
      ];
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl bg-[#0b1322] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[92vh] max-h-[850px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Call Header */}
        <div className="bg-[#0e172a] border-b border-slate-800 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center font-bold text-white text-lg shadow-lg shadow-amber-500/20 border border-amber-400/40">
                {candidate.name.substring(0, 2).toUpperCase()}
              </div>
              {callStatus === 'connected' && (
                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0e172a]" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white font-['Space_Grotesk']">
                  {candidate.name}
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {scenario === 'screening' ? 'Screening Call' : scenario === 'reminder' ? 'Reconfirmation Call' : scenario === 'missed_followup' ? 'Missed Follow-up' : 'Callback Follow-up'}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span>{candidate.appliedRole}</span>
                <span>•</span>
                <span className="font-mono text-slate-300">{candidate.phone}</span>
              </p>
            </div>
          </div>

          {/* Call Status & Timer Badge */}
          <div className="flex items-center gap-3">
            {callStatus === 'ringing' ? (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-3.5 py-1.5 rounded-lg text-xs font-semibold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Ringing Candidate...</span>
              </div>
            ) : callStatus === 'connected' ? (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3.5 py-1.5 rounded-lg text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-mono">{formatTime(callDuration)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 px-3.5 py-1.5 rounded-lg text-xs font-semibold">
                <span>Call Ended</span>
              </div>
            )}

            <button
              onClick={handleEndCall}
              className="bg-rose-600 hover:bg-rose-700 text-white p-2 rounded-xl transition shadow-md shadow-rose-600/20 cursor-pointer"
              title="Hang up call"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Gemini Live API Status Bar */}
        <div className="bg-slate-950/80 border-b border-slate-800/80 px-5 py-2 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Live Recruiter Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-300">
              <Bot className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold">Arjun: Virtual AI HR</span>
              <span className="text-slate-400">•</span>
              <span className="text-emerald-300 font-mono text-[10px]">Gemini Live API</span>
            </div>

            {/* Audio Wave / Speaking State Indicator */}
            {isAgentSpeaking ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-amber-500/15 px-2.5 py-1 rounded-lg border border-amber-500/30 text-[11px] text-amber-300 animate-pulse">
                  <div className="flex items-end gap-0.5 h-3.5 px-0.5">
                    <span className="w-1 bg-amber-400 rounded-full transition-all duration-75" style={{ height: `${Math.max(4, agentVolume * 0.16)}px` }} />
                    <span className="w-1 bg-amber-300 rounded-full transition-all duration-75" style={{ height: `${Math.max(6, agentVolume * 0.22)}px` }} />
                    <span className="w-1 bg-amber-400 rounded-full transition-all duration-75" style={{ height: `${Math.max(4, agentVolume * 0.14)}px` }} />
                  </div>
                  <span className="font-bold tracking-tight">Arjun Speaking (24kHz Native Voice)</span>
                </div>
                <button
                  type="button"
                  onClick={handleInterruptAgent}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/25 hover:bg-rose-500/35 text-rose-200 border border-rose-500/50 text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Interrupt Arjun speaking (Instant Barge-In)"
                >
                  <VolumeX className="w-3.5 h-3.5" />
                  <span>⚡ Interrupt</span>
                </button>
              </div>
            ) : isInterrupted ? (
              <div className="flex items-center gap-1.5 bg-rose-950/70 px-2.5 py-1 rounded-lg border border-rose-500/40 text-[11px] text-rose-200">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                <span className="font-bold">⚡ Barge-In: Floor yielded to candidate</span>
              </div>
            ) : callStatus === 'connected' ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-emerald-950/70 px-2.5 py-1 rounded-lg border border-emerald-500/40 text-[11px] text-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-semibold">Live Mic Listening (16kHz Stream)</span>
                </div>
                {candidateVolume > 10 && (
                  <div className="flex items-center gap-1 text-[11px] text-cyan-300 bg-cyan-950/40 px-2 py-1 rounded border border-cyan-500/30">
                    <Activity className="w-3 h-3 text-cyan-400 animate-pulse" />
                    <span>Candidate Speaking</span>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Quick Simulation: Unanswered */}
          {callStatus === 'ringing' && (
            <button
              onClick={handleSimulateUnanswered}
              className="text-slate-400 hover:text-amber-300 underline text-[11px] transition cursor-pointer"
            >
              Simulate: &quot;Candidate Didn&apos;t Answer&quot;
            </button>
          )}

          {/* Right Controls: Mic Mute & Languages */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleMute}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                isMuted
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-slate-800 text-slate-300 border border-slate-700 hover:text-white'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{isMuted ? 'Muted' : 'Mic Live'}</span>
            </button>

            {/* Language Pill */}
            <div className="flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800/80 px-2 py-1 rounded border border-slate-700/60">
              <Globe className="w-3 h-3 text-amber-400" />
              <span>Hinglish / English</span>
            </div>
          </div>
        </div>

        {/* Error Banner if any */}
        {errorMessage && (
          <div className="bg-rose-950/80 border-b border-rose-800 px-5 py-2 text-xs text-rose-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-white text-xs underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Grid: Left Transcript & Visualizer | Right Live Screening Data */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left 7 cols: Real-Time Audio Chat Transcript & Controls */}
          <div className="lg:col-span-7 flex flex-col min-h-0 border-r border-slate-800 bg-[#080e1a]">
            {/* Transcript Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              {transcript.length === 0 && callStatus === 'ringing' && (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center animate-bounce">
                    <PhoneOff className="w-8 h-8 text-amber-400 rotate-135" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm">Connecting with {candidate.name}...</h4>
                    <p className="text-slate-400 text-xs mt-1 max-w-xs">
                      Establishing real-time bidirectional audio connection with Gemini Live API.
                    </p>
                  </div>
                </div>
              )}

              {transcript.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 max-w-[85%] ${
                    msg.sender === 'agent'
                      ? 'mr-auto'
                      : msg.sender === 'candidate'
                      ? 'ml-auto flex-row-reverse'
                      : 'mx-auto text-center'
                  }`}
                >
                  {msg.sender !== 'system' && (
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold shadow-xs ${
                        msg.sender === 'agent'
                          ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-white'
                          : 'bg-cyan-600 text-white'
                      }`}
                    >
                      {msg.sender === 'agent' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>
                  )}

                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-xs shadow-sm ${
                      msg.sender === 'agent'
                        ? 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-sm'
                        : msg.sender === 'candidate'
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-medium rounded-tr-sm'
                        : 'bg-slate-800/80 text-slate-300 text-[11px] rounded-lg'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className={`text-[10px] font-bold ${
                          msg.sender === 'agent'
                            ? 'text-amber-400'
                            : msg.sender === 'candidate'
                            ? 'text-slate-900'
                            : 'text-slate-400'
                        }`}
                      >
                        {msg.sender === 'agent' ? 'Arjun (Virtual HR)' : msg.sender === 'candidate' ? candidate.name : 'System'}
                      </span>
                      <span
                        className={`text-[9px] ${
                          msg.sender === 'candidate' ? 'text-slate-800' : 'text-slate-400'
                        }`}
                      >
                        {msg.timestamp}
                      </span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))}

              {isProcessing && (
                <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 max-w-[200px]">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span>Arjun processing...</span>
                </div>
              )}

              <div ref={transcriptEndRef} />
            </div>

            {/* Quick Candidate Response Chips */}
            <div className="bg-slate-950 border-t border-slate-800/80 p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Interactive Quick Responses</span>
                </span>
                <span className="text-[10px] text-slate-400">Click to send or speak into mic</span>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {getQuickResponseChips().map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(chip.text)}
                    className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-amber-300 text-[11px] font-medium transition cursor-pointer shrink-0 shadow-xs active:scale-95"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Text Input Bar */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                  placeholder="Or type candidate reply (sends to live voice session)..."
                  className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500/80"
                />
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim()}
                  className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 p-2 rounded-xl transition cursor-pointer shrink-0 shadow-sm"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Right 5 cols: Live Screening Dashboard & Real-Time Tool Actions */}
          <div className="lg:col-span-5 flex flex-col min-h-0 bg-[#0c1424] p-4 overflow-y-auto space-y-4">
            {/* Tabs */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setRightPanelTab('checklist')}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition cursor-pointer text-center ${
                  rightPanelTab === 'checklist'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Screening Checklist
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab('questions')}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition cursor-pointer text-center relative ${
                  rightPanelTab === 'questions'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Zero-Duplicate Engine
                {questionEngineState.activeQuestion && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1.5 animate-pulse" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab('memory')}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition cursor-pointer text-center ${
                  rightPanelTab === 'memory'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Live Memory
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab('behavior')}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition cursor-pointer text-center relative ${
                  rightPanelTab === 'behavior'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Behavior & Tone
                {realTimeBehavior && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 ml-1.5 animate-pulse" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab('action')}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition cursor-pointer text-center ${
                  rightPanelTab === 'action'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Action Record
              </button>
            </div>

            {/* TAB: Zero-Duplicate Engine Inspector */}
            {rightPanelTab === 'questions' && (
              <div className="space-y-3 text-xs">
                {/* Active Question Lock Card */}
                <div className={`p-3 rounded-xl border transition ${
                  questionEngineState.activeQuestion
                    ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                    : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                }`}>
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800">
                    <span className="font-bold flex items-center gap-1.5 text-[11px]">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Active Question Lock</span>
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                      questionEngineState.activeQuestion
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {questionEngineState.activeQuestion ? 'ACTIVE_LOCKED' : 'READY_NEXT'}
                    </span>
                  </div>
                  {questionEngineState.activeQuestion ? (
                    <div className="space-y-1">
                      <div className="text-[10px] text-amber-300/80 font-mono">
                        TOPIC: {questionEngineState.activeQuestion.topic.toUpperCase()} • ID: {questionEngineState.activeQuestion.id}
                      </div>
                      <p className="font-semibold text-white text-[11px] leading-snug">
                        "{questionEngineState.activeQuestion.questionText}"
                      </p>
                      <div className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        <span>Waiting for candidate response before any new question can be generated.</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-emerald-300 font-medium flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>No active question lock. Next question may be evaluated via 7-check gate.</span>
                    </div>
                  )}
                </div>

                {/* 7-Gate Anti-Duplicate Verification */}
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="font-bold text-slate-300 text-[11px] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>7-Check Question Generation Gate</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Zero-Duplicate Enforced
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <div className="p-1.5 rounded bg-slate-950/80 border border-slate-800 flex items-center gap-1 text-emerald-400">
                      <CheckCircle className="w-3 h-3" />
                      <span>1. Single Question Lock</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-950/80 border border-slate-800 flex items-center gap-1 text-emerald-400">
                      <CheckCircle className="w-3 h-3" />
                      <span>2. Candidate Finished Check</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-950/80 border border-slate-800 flex items-center gap-1 text-emerald-400">
                      <CheckCircle className="w-3 h-3" />
                      <span>3. Exact Duplicate Ban</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-950/80 border border-slate-800 flex items-center gap-1 text-emerald-400">
                      <CheckCircle className="w-3 h-3" />
                      <span>4. Semantic Duplication Ban</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-950/80 border border-slate-800 flex items-center gap-1 text-emerald-400">
                      <CheckCircle className="w-3 h-3" />
                      <span>5. Voluntary Info Protection</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-950/80 border border-slate-800 flex items-center gap-1 text-emerald-400">
                      <CheckCircle className="w-3 h-3" />
                      <span>6. Genuinely New Info Only</span>
                    </div>
                  </div>
                </div>

                {/* Question Topics & Completion Status */}
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="font-bold text-slate-300 text-[11px] flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      <span>Recruiter Screening Topics</span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {questionEngineState.answeredTopics.length} / {questionEngineState.openTopics.length + questionEngineState.answeredTopics.length} Complete
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {/* Answered / Completed Topics */}
                    {questionEngineState.answeredTopics.map((topic) => (
                      <div
                        key={`ans-${topic}`}
                        className="p-1.5 rounded-lg bg-emerald-950/30 border border-emerald-500/20 flex items-center justify-between text-[11px]"
                      >
                        <span className="text-emerald-300 font-medium flex items-center gap-1.5">
                          <CheckCircle className="w-3 h-3 text-emerald-400" />
                          <span className="capitalize">{topic.replace(/_/g, ' ')}</span>
                        </span>
                        <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded font-bold">
                          CLOSED
                        </span>
                      </div>
                    ))}

                    {/* Open Topics */}
                    {questionEngineState.openTopics.map((topic) => (
                      <div
                        key={`open-${topic}`}
                        className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-[11px]"
                      >
                        <span className="text-slate-300 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                          <span className="capitalize">{topic.replace(/_/g, ' ')}</span>
                        </span>
                        <span className="text-[9px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                          PENDING
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Asked Questions Audit Trail */}
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="font-bold text-slate-300 text-[11px]">
                      Spoken Questions Audit Log ({questionEngineState.askedQuestions.length})
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono">Zero Duplicates</span>
                  </div>
                  {questionEngineState.askedQuestions.length === 0 ? (
                    <p className="text-slate-500 text-[10px] py-1 text-center italic">
                      No questions asked yet in this conversation turn.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {questionEngineState.askedQuestions.map((q, idx) => (
                        <div
                          key={q.id || idx}
                          className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-[10px] space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-amber-400 font-bold uppercase text-[9px] font-mono">
                              #{idx + 1} {q.topic.replace(/_/g, ' ')}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              q.status === 'QUESTION_CLOSED'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}>
                              {q.status}
                            </span>
                          </div>
                          <p className="text-white font-medium">"{q.questionText}"</p>
                          {q.extractedAnswer && (
                            <div className="text-slate-400 bg-slate-900/90 p-1 rounded text-[9px]">
                              <span className="text-emerald-400 font-semibold">Answer: </span>
                              {q.extractedAnswer}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 1: Real-Time Checklist */}
            {rightPanelTab === 'checklist' && (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                    Extracted Criteria
                  </span>
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-mono">
                    Live Tool Updates
                  </span>
                </div>

                <div className="space-y-2">

                  {/* Current Company */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400">Current Employer:</span>
                    <span className="font-semibold text-white">
                      {extracted.currentCompany || 'Pending response'}
                    </span>
                  </div>

                  {/* Designation */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400">Designation:</span>
                    <span className="font-semibold text-white">
                      {extracted.currentDesignation || 'Pending response'}
                    </span>
                  </div>

                  {/* Real Estate Exp */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400">Real Estate Sales Exp:</span>
                    <span className="font-semibold text-emerald-400">
                      {extracted.realEstateExperienceYears !== undefined ? `${extracted.realEstateExperienceYears} Years` : 'Pending'}
                    </span>
                  </div>

                  {/* Gurgaon / Dubai Exp */}
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Target Markets:</span>
                      <div className="flex gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${extracted.gurgaonDubaiExperience?.gurgaon ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                          Gurgaon: {extracted.gurgaonDubaiExperience?.gurgaon ? '✓ Yes' : 'Pending'}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${extracted.gurgaonDubaiExperience?.dubai ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-slate-800 text-slate-400'}`}>
                          Dubai: {extracted.gurgaonDubaiExperience?.dubai ? '✓ Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Salary Fixed & Expected */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400">Fixed / Expected CTC:</span>
                    <span className="font-semibold text-amber-300">
                      {extracted.currentSalaryLPA ? `${extracted.currentSalaryLPA} / ${extracted.expectedSalaryLPA || 'TBD'}` : 'Pending disclosure'}
                    </span>
                  </div>

                  {/* Notice Period */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400">Notice Period:</span>
                    <span className="font-semibold text-white">
                      {extracted.noticePeriodDays !== undefined ? `${extracted.noticePeriodDays} Days` : 'Pending'}
                    </span>
                  </div>

                  {/* Location */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400">Current Location:</span>
                    <span className="font-semibold text-white">
                      {extracted.currentLocation || candidate.location}
                    </span>
                  </div>
                </div>

                {/* Available Face-to-Face Slots */}
                <div className="mt-3 pt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-300 font-bold text-[11px] flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      <span>Gurgaon HQ Slots (Sector 67)</span>
                    </span>
                    {bookedSlotId && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                        Slot Booked
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => {
                          setBookedSlotId(slot.id);
                          setStatusRec('Interview Scheduled');
                          setDetectedIntent('confirm_interview');
                          if (liveClientRef.current) {
                            liveClientRef.current.sendText(`Candidate selected slot: ${slot.displayLabel}`);
                          }
                        }}
                        className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between transition border cursor-pointer ${
                          bookedSlotId === slot.id
                            ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                            : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-white">{slot.displayLabel}</div>
                          <div className="text-[10px] text-slate-400">{slot.time} • Room 6B</div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${bookedSlotId === slot.id ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                          {bookedSlotId === slot.id ? 'Selected' : 'Select'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Live Memory Inspector */}
            {rightPanelTab === 'memory' && (
              <div className="space-y-2 text-[11px]">
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="font-bold text-amber-400 text-xs border-b border-slate-800 pb-1">
                    Active Recruiter Memory State
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block">Candidate</span>
                      <span className="font-bold text-white">{conversationMemory.candidate_name}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block">Target Role</span>
                      <span className="font-bold text-white">{conversationMemory.target_role}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block">Current Company</span>
                      <span className="font-bold text-white">{conversationMemory.current_company || '—'}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block">Designation</span>
                      <span className="font-bold text-white">{conversationMemory.designation || '—'}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block">Real Estate Exp</span>
                      <span className="font-bold text-emerald-400">{conversationMemory.real_estate_experience || '—'}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block">Expected CTC</span>
                      <span className="font-bold text-emerald-300">{conversationMemory.expected_salary || '—'}</span>
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800 mt-2">
                    <span className="text-slate-400 text-[10px] block">Next Action:</span>
                    <span className="font-bold text-amber-400">{conversationMemory.next_action || 'Screening in progress'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Live Behavior & Communication Intelligence */}
            {rightPanelTab === 'behavior' && (
              <div className="space-y-3 text-xs">
                {/* Real-Time Communication Tone Header */}
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-1.5">
                      <Brain className="w-4 h-4 text-amber-400" />
                      <span className="font-bold text-white text-[11px]">Real-Time Tone & Signal Analysis</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      LIVE
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Current Tone:</span>
                      <span className="font-bold text-white capitalize">
                        {realTimeBehavior?.currentTone || 'Neutral / Cooperative'}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Impatience Level:</span>
                      <span className={`font-bold capitalize ${
                        realTimeBehavior?.impatienceLevel === 'high'
                          ? 'text-rose-400'
                          : realTimeBehavior?.impatienceLevel === 'moderate'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}>
                        {realTimeBehavior?.impatienceLevel || 'Low'}
                      </span>
                    </div>
                  </div>

                  {/* Active Recruiter Directive */}
                  {realTimeBehavior?.activeDirectives && realTimeBehavior.activeDirectives.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-1">
                      <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Adaptive Conversation Guidance (Rule 32):</span>
                      </span>
                      <ul className="text-slate-200 text-[11px] space-y-1 list-disc list-inside">
                        {realTimeBehavior.activeDirectives.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Detected Verbal Signals Log */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="font-bold text-slate-300 text-[11px] flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-blue-400" />
                      <span>Extracted Verbal Signals ({realTimeBehavior?.detectedSignals?.length || 0})</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Observable facts only</span>
                  </div>

                  {realTimeBehavior?.detectedSignals && realTimeBehavior.detectedSignals.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {realTimeBehavior.detectedSignals.map((sig, idx) => (
                        <div key={idx} className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 space-y-0.5">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-bold text-amber-400 capitalize">{sig.dimension}</span>
                            <span className="text-slate-500 font-mono">{sig.timestamp}</span>
                          </div>
                          <p className="text-slate-300 text-[11px]">{sig.observation}</p>
                          {sig.evidence && (
                            <p className="text-slate-400 text-[10px] italic font-mono">"{sig.evidence}"</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-[11px] italic py-2 text-center">
                      Listening to candidate utterances... Signals will appear as conversation unfolds.
                    </p>
                  )}
                </div>

                {/* Prior Call Behavioral Memory if available */}
                {candidate.latestBehaviorReport && (
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5 text-[11px]">
                    <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider block">
                      Prior Call Communication Profile:
                    </span>
                    <p className="text-slate-300">
                      {candidate.latestBehaviorReport.behaviorSummary}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] text-slate-400">Patience:</span>
                      <span className="text-emerald-400 font-semibold capitalize">{candidate.latestBehaviorReport.patience}</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-[10px] text-slate-400">Cooperation:</span>
                      <span className="text-blue-400 font-semibold capitalize">{candidate.latestBehaviorReport.cooperation}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Action Record */}
            {rightPanelTab === 'action' && (
              <div className="space-y-3 text-xs">
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2.5 text-[11px]">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-slate-400">Target Role:</span>
                    <span className="font-bold text-white">{afterCallAction?.target_role || candidate.appliedRole}</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-slate-400">Interview Status:</span>
                    <span className="font-semibold text-amber-300">
                      {bookedSlotId ? 'SCHEDULED' : 'PENDING_SLOT'}
                    </span>
                  </div>
                  <div className="pb-2 border-b border-slate-800">
                    <span className="text-slate-400 block mb-0.5">Corporate HQ:</span>
                    <span className="text-white text-[10px] leading-tight block">
                      6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">HR Remarks:</span>
                    <p className="text-slate-200 text-[11px] bg-slate-950/80 p-2 rounded border border-slate-800 leading-relaxed">
                      {latestGeneratedRemark?.text || 'Screening evaluated by Arjun Virtual AI HR Recruiter.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Complete Call Actions */}
            <div className="pt-3 border-t border-slate-800 space-y-2 mt-auto">
              {bookedSlotId && onOpenConfirmationMail && (
                <button
                  type="button"
                  onClick={() => onOpenConfirmationMail(candidate)}
                  className="w-full py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Send Confirmation Interview Mail</span>
                </button>
              )}

              {onOpenWhatsApp && (
                <button
                  type="button"
                  onClick={() => onOpenWhatsApp(candidate, candidate.status === 'Missed Interview - Followup' ? 'missed_followup' : bookedSlotId ? 'interview_reminder' : 'unanswered')}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Send WhatsApp Reminder</span>
                </button>
              )}

              <button
                id="btn-end-call-update"
                onClick={handleEndCall}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Save Call & Update Candidate</span>
              </button>

              <button
                onClick={handleEndCall}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[11px] transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <PhoneOff className="w-3.5 h-3.5 text-rose-400" />
                <span>Hang Up Immediately</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
