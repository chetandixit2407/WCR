import React from 'react';
import { PhoneCall, PhoneOff, Building2, Globe, Plus, RefreshCw, Brain } from 'lucide-react';
import { Candidate } from '../types';
import { VapiCallStatus } from '../utils/vapiService';

interface HeaderProps {
  onNewCandidate: () => void;
  onQuickStartCall: () => void;
  onStartInteractiveCall?: () => void;
  onEndCall?: () => void;
  onOpenBrainModal?: () => void;
  vapiCallStatus?: VapiCallStatus;
  activeCandidateCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onNewCandidate,
  onQuickStartCall,
  onStartInteractiveCall,
  onEndCall,
  onOpenBrainModal,
  vapiCallStatus = 'idle',
  activeCandidateCount,
}) => {
  return (
    <header className="bg-[#0f172a] border-b border-slate-800 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Brand & Identity */}
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 border border-amber-400/30">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white font-['Space_Grotesk']">
                  WHITE COLLAR <span className="text-amber-400 font-normal">REALTY</span>
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Virtual HR AI
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span>Gurgaon & Dubai Luxury Real Estate Advisory</span>
                <span className="text-slate-600">•</span>
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Agent Arjun (Vapi Voice) Online
                </span>
              </p>
            </div>
          </div>

          {/* Quick Actions & Meta */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="hidden md:flex items-center text-xs text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60">
              <Globe className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
              <span>Languages: <strong className="text-slate-200">Hindi, English, Hinglish</strong></span>
            </div>

            {onOpenBrainModal && (
              <button
                id="btn-open-ai-brain"
                onClick={onOpenBrainModal}
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 px-3 py-2 rounded-lg transition shadow-xs"
                title="Open Central AI HR Brain - 6 Memory Layers & Self-Learning System"
              >
                <Brain className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>AI HR Brain</span>
              </button>
            )}

            <button
              id="btn-add-dummy-candidate"
              onClick={onNewCandidate}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-lg border border-slate-700 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Candidate</span>
            </button>

            {/* Vapi Call State Button Group */}
            {vapiCallStatus === 'connecting' && (
              <button
                id="btn-quick-call-start"
                disabled
                className="inline-flex items-center gap-2 text-xs font-semibold bg-amber-500/80 text-slate-950 px-4 py-2 rounded-lg shadow-md transition cursor-wait animate-pulse"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Connecting...</span>
              </button>
            )}

            {vapiCallStatus === 'active' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onQuickStartCall}
                  className="inline-flex items-center gap-2 text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 px-3.5 py-2 rounded-lg shadow-xs shadow-emerald-950/40 animate-pulse transition"
                  title="View active call"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  <span>Call Active</span>
                </button>
                <button
                  id="btn-quick-call-end"
                  onClick={onEndCall}
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-2 rounded-lg shadow-md shadow-rose-900/30 transition active:scale-95 cursor-pointer"
                  title="End Active Vapi Voice Call"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  <span>End Call</span>
                </button>
              </div>
            )}

            {(vapiCallStatus === 'idle' || vapiCallStatus === 'ended' || vapiCallStatus === 'error' || vapiCallStatus === 'key_required') && (
              <div className="flex items-center gap-2">
                {onStartInteractiveCall && (
                  <button
                    id="btn-interactive-call-start"
                    onClick={onStartInteractiveCall}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 px-3 py-2 rounded-lg transition active:scale-95 shadow-xs"
                    title="Start Voice Screening with AI Recruiter Arjun"
                  >
                    <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
                    <span>AI Voice Recruiter</span>
                  </button>
                )}
                <button
                  id="btn-quick-call-start"
                  onClick={onQuickStartCall}
                  className="inline-flex items-center gap-2 text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 px-4 py-2 rounded-lg shadow-md shadow-amber-500/20 transition active:scale-95"
                  title="Connect via Vapi WebRTC"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Vapi Live Call</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
