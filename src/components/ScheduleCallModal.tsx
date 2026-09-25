import React, { useState } from 'react';
import { 
  X, Calendar, Clock, PhoneCall, Bot, Sparkles, AlertCircle, 
  CheckCircle2, BellRing 
} from 'lucide-react';
import { Candidate, CallScenario } from '../types';

interface ScheduleCallModalProps {
  candidate: Candidate;
  onClose: () => void;
  onSaveSchedule: (
    candidateId: string, 
    schedule: {
      scheduledAt: string;
      date: string;
      time: string;
      scenario: CallScenario;
      notes?: string;
    }
  ) => void;
  onCancelSchedule?: (candidateId: string) => void;
}

export const ScheduleCallModal: React.FC<ScheduleCallModalProps> = ({
  candidate,
  onClose,
  onSaveSchedule,
  onCancelSchedule,
}) => {
  // Compute default values: 30 minutes from now or tomorrow 11:00 AM
  const now = new Date();
  const defaultDate = now.toISOString().split('T')[0];
  const hours = String((now.getHours() + 1) % 24).padStart(2, '0');
  const minutes = '00';
  const defaultTime = `${hours}:${minutes}`;

  const [date, setDate] = useState<string>(
    candidate.scheduledCall?.date || defaultDate
  );
  const [time, setTime] = useState<string>(
    candidate.scheduledCall?.time || defaultTime
  );
  const [scenario, setScenario] = useState<CallScenario>(
    candidate.scheduledCall?.scenario || 
    (candidate.status === 'Missed Interview - Followup' ? 'missed_followup' :
     candidate.status === 'Callback Needed' ? 'callback_followup' :
     candidate.interviewSlotId ? 'reminder' : 'screening')
  );
  const [notes, setNotes] = useState<string>(
    candidate.scheduledCall?.notes || ''
  );
  const [isSaved, setIsSaved] = useState(false);

  // Quick preset shortcuts
  const handleSetQuickPreset = (minutesFromNow: number) => {
    const target = new Date(Date.now() + minutesFromNow * 60 * 1000);
    const yyyyMmDd = target.toISOString().split('T')[0];
    const hh = String(target.getHours()).padStart(2, '0');
    const mm = String(target.getMinutes()).padStart(2, '0');
    setDate(yyyyMmDd);
    setTime(`${hh}:${mm}`);
  };

  const handleSetTomorrowMorning = () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const yyyyMmDd = tomorrow.toISOString().split('T')[0];
    setDate(yyyyMmDd);
    setTime('11:00');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time) return;

    // Combine date and time to ISO
    const scheduledDateTime = new Date(`${date}T${time}:00`);

    onSaveSchedule(candidate.id, {
      scheduledAt: scheduledDateTime.toISOString(),
      date,
      time,
      scenario,
      notes: notes.trim() || undefined,
    });

    setIsSaved(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-amber-500/30 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base font-['Space_Grotesk']">
                  Schedule AI Follow-up Call
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wide">
                  Agent Arjun
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Auto-trigger Gemini Live / Vapi call to <span className="text-amber-300 font-semibold">{candidate.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Existing Schedule Warning/Badge if already set */}
        {candidate.scheduledCall && candidate.scheduledCall.status === 'pending' && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-2.5 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>
                Existing Call Scheduled: <strong>{candidate.scheduledCall.date} at {candidate.scheduledCall.time}</strong> ({candidate.scheduledCall.scenario})
              </span>
            </div>
            {onCancelSchedule && (
              <button
                type="button"
                onClick={() => {
                  onCancelSchedule(candidate.id);
                  onClose();
                }}
                className="text-xs text-rose-400 hover:text-rose-300 underline font-semibold cursor-pointer"
              >
                Cancel Call
              </button>
            )}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Quick presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Quick Timers
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSetQuickPreset(15)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition"
              >
                ⏱️ In 15 Mins
              </button>
              <button
                type="button"
                onClick={() => handleSetQuickPreset(60)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition"
              >
                ⏱️ In 1 Hour
              </button>
              <button
                type="button"
                onClick={handleSetTomorrowMorning}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition"
              >
                🌅 Tomorrow 11 AM
              </button>
            </div>
          </div>

          {/* Date & Time Picker */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Call Date</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Call Time</span>
              </label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          {/* Call Scenario */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-amber-400" />
              <span>AI Conversation Scenario</span>
            </label>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value as CallScenario)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
            >
              <option value="screening">Initial Screening (Real Estate Fit & Luxury Exp)</option>
              <option value="callback_followup">Callback Follow-up (Candidate was busy/driving earlier)</option>
              <option value="reminder">Interview Attendance Reconfirmation (Sector 67 HQ)</option>
              <option value="missed_followup">Missed Interview Follow-up (Reschedule missed round)</option>
            </select>
          </div>

          {/* Recruiter Notes for Agent */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Special Instructions for Arjun (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Candidate asked to discuss salary hike directly; emphasize DLF luxury sales incentives..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-amber-500 resize-none"
            />
          </div>

          {/* Automated dispatch note */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-slate-200 font-semibold">Auto-Trigger System:</span> At the scheduled time, the AI HR agent will automatically prompt and place the call to <strong className="text-slate-200">{candidate.phone}</strong> with the selected dialogue context and persistent memory.
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaved}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-md shadow-amber-500/20 transition active:scale-95 disabled:opacity-50"
            >
              {isSaved ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-slate-950" />
                  <span>Call Scheduled!</span>
                </>
              ) : (
                <>
                  <PhoneCall className="w-4 h-4" />
                  <span>Confirm Schedule</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
