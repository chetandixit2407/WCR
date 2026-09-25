import React from 'react';
import { 
  PhoneCall, AlertTriangle, Clock, UserX, PhoneMissed, 
  CalendarClock, CheckCircle, ShieldAlert, ChevronRight, RefreshCw, MessageSquare,
  Bell, Tag, Sparkles, Building2, Calendar, BellRing
} from 'lucide-react';
import { Candidate } from '../types';

interface FollowupQueueTabProps {
  candidates: Candidate[];
  onTriggerCall: (candidate: Candidate, scenario: string) => void;
  onSelectCandidate: (candidate: Candidate) => void;
  onOpenWhatsApp?: (candidate: Candidate, template?: 'unanswered' | 'interview_reminder' | 'missed_followup') => void;
  onOpenScheduleCall?: (candidate: Candidate) => void;
}

export const FollowupQueueTab: React.FC<FollowupQueueTabProps> = ({
  candidates,
  onTriggerCall,
  onSelectCandidate,
  onOpenWhatsApp,
  onOpenScheduleCall,
}) => {
  // Category 0: Scheduled AI Auto-Trigger Calls
  const scheduledCandidates = candidates.filter(
    (c) => c.scheduledCall && c.scheduledCall.status === 'pending'
  );

  // Category 1: Unanswered calls
  const unansweredCandidates = candidates.filter((c) => c.unansweredAttempts > 0 && c.status !== 'Declined - Do Not Call');

  // Category 2: Missed interviews
  const missedCandidates = candidates.filter((c) => c.status === 'Missed Interview - Followup');

  // Category 3: Callback requests
  const callbackCandidates = candidates.filter((c) => c.status === 'Callback Needed' || c.callbackTime);

  // Category 4: Declined (Follow-ups stopped)
  const declinedCandidates = candidates.filter((c) => c.status === 'Declined - Do Not Call');

  // Category 5: Talent Pipeline (Already Joined another firm / 90-day review)
  const pipelineCandidates = candidates.filter(
    (c) =>
      c.latestRemark?.category?.includes('Already Joined') ||
      c.status.toLowerCase().includes('joined') ||
      c.alertDueDate === 'Upcoming' ||
      c.latestRemark?.actionDueDate?.includes('90')
  );

  return (
    <div className="space-y-8">
      {/* 0. Scheduled AI Calls Section (Featured Auto-Trigger Queue) */}
      <div className="bg-[#0f182c] border border-amber-500/30 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shadow-xs">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Scheduled AI Auto-Trigger Calls ({scheduledCandidates.length})
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wide">
                  Live Queue
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Calls queued for Arjun to place automatically at the designated date & time
              </p>
            </div>
          </div>
        </div>

        {scheduledCandidates.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-500">
            No scheduled AI calls in queue. You can schedule a call from any candidate card or drawer.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {scheduledCandidates.map((cand) => {
              const sched = cand.scheduledCall!;
              return (
                <div
                  key={cand.id}
                  className="p-4 rounded-xl bg-slate-900 border border-amber-500/40 flex flex-col justify-between shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <span>{cand.name}</span>
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
                        </h4>
                        <p className="text-xs text-amber-400">{cand.appliedRole}</p>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">{cand.phone}</p>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 rounded border border-amber-500/40">
                        {sched.scenario.toUpperCase()}
                      </span>
                    </div>

                    <div className="mt-3 p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Auto-Trigger Time: {sched.date} at {sched.time}</span>
                      </div>
                      {sched.notes && (
                        <div className="text-[11px] text-slate-300 mt-1 italic">
                          "{sched.notes}"
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                    <button
                      onClick={() => onSelectCandidate(cand)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      View Dossier
                    </button>
                    <div className="flex items-center gap-2">
                      {onOpenScheduleCall && (
                        <button
                          onClick={() => onOpenScheduleCall(cand)}
                          className="text-xs text-amber-400 hover:text-amber-300 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 font-medium transition"
                        >
                          Reschedule
                        </button>
                      )}
                      <button
                        onClick={() => onTriggerCall(cand, sched.scenario)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 rounded-lg transition shadow-md shadow-amber-500/20 font-bold"
                        title="Trigger now without waiting for timer"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>Trigger Now</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* 1. Callback Requests Section */}
      <div className="bg-[#0f182c] border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Candidate Callback Requests ({callbackCandidates.length})
              </h3>
              <p className="text-xs text-slate-400">
                Candidates who requested a call later (e.g. driving, in meeting, after office hours)
              </p>
            </div>
          </div>
        </div>

        {callbackCandidates.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-500">
            No pending callback requests. When candidates tell Arjun they are driving or busy, callbacks are automatically recorded here.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {callbackCandidates.map((cand) => (
              <div
                key={cand.id}
                className="p-4 rounded-xl bg-slate-900 border border-purple-500/30 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{cand.name}</h4>
                      <p className="text-xs text-amber-400">{cand.appliedRole}</p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">{cand.phone}</p>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-500/20 text-purple-300 rounded border border-purple-500/30">
                      Callback Needed
                    </span>
                  </div>

                  <div className="mt-3 p-2.5 rounded-lg bg-purple-950/20 border border-purple-500/20 text-xs text-purple-200">
                    <strong className="text-purple-300">Requested Time:</strong> {cand.callbackTime || 'Later today'}
                    {cand.notes && <div className="text-[11px] text-slate-300 mt-1">{cand.notes}</div>}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onSelectCandidate(cand)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => onTriggerCall(cand, 'callback_followup')}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white px-3.5 py-1.5 rounded-lg transition shadow-md shadow-purple-600/20"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Call Back Now</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Missed Interviews Follow-up Section */}
      <div className="bg-[#0f182c] border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
              <CalendarClock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Missed Interview Follow-ups ({missedCandidates.length})
              </h3>
              <p className="text-xs text-slate-400">
                Candidates who did not attend their scheduled face-to-face round at Sector 67 Gurugram HQ (M3M Urbana)
              </p>
            </div>
          </div>
        </div>

        {missedCandidates.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-500">
            No missed interviews requiring follow-up at present.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {missedCandidates.map((cand) => (
              <div
                key={cand.id}
                className="p-4 rounded-xl bg-slate-900 border border-rose-500/30 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{cand.name}</h4>
                      <p className="text-xs text-amber-400">{cand.appliedRole}</p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">{cand.phone}</p>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-rose-500/20 text-rose-300 rounded border border-rose-500/30">
                      Missed F2F
                    </span>
                  </div>

                  <div className="mt-3 p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/20 text-xs text-rose-200">
                    <strong className="text-rose-300">Missed Slot:</strong> {cand.screening?.preferredInterviewSlot || 'Yesterday'}
                    <div className="text-[11px] text-slate-300 mt-1">
                      {cand.notes || 'Automated follow-up required to check availability and propose open slots.'}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                  <button
                    onClick={() => onSelectCandidate(cand)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    View Details
                  </button>
                  <div className="flex items-center gap-2">
                    {onOpenWhatsApp && (
                      <button
                        onClick={() => onOpenWhatsApp(cand, 'missed_followup')}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg transition"
                        title="Send WhatsApp reschedule message"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Send WhatsApp</span>
                      </button>
                    )}
                    <button
                      onClick={() => onTriggerCall(cand, 'missed_followup')}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-1.5 rounded-lg transition shadow-md shadow-rose-600/20"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>Reschedule Follow-up Call</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Unanswered Calls Queue */}
      <div className="bg-[#0f182c] border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <PhoneMissed className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Unanswered Calls & Retries ({unansweredCandidates.length})
              </h3>
              <p className="text-xs text-slate-400">
                Calls where the candidate did not answer (Max 3 automated attempts before manual review)
              </p>
            </div>
          </div>
        </div>

        {unansweredCandidates.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-500">
            No unanswered calls pending retry.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {unansweredCandidates.map((cand) => (
              <div
                key={cand.id}
                className="p-4 rounded-xl bg-slate-900 border border-amber-500/30 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{cand.name}</h4>
                      <p className="text-xs text-amber-400">{cand.appliedRole}</p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">{cand.phone}</p>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                      Attempt {cand.unansweredAttempts}/3
                    </span>
                  </div>

                  <div className="mt-3 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
                    <div>Last call attempt: <span className="text-slate-200 font-mono">{cand.lastCallDate || 'Today'}</span></div>
                    <div className="text-[11px] text-slate-400 mt-1">{cand.notes}</div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                  <button
                    onClick={() => onSelectCandidate(cand)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Profile
                  </button>
                  <div className="flex items-center gap-2">
                    {onOpenWhatsApp && (
                      <button
                        onClick={() => onOpenWhatsApp(cand, 'unanswered')}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg transition"
                        title="Send WhatsApp message regarding missed call"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Send WhatsApp Msg</span>
                      </button>
                    )}
                    <button
                      onClick={() => onTriggerCall(cand, 'screening')}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 px-3.5 py-1.5 rounded-lg transition shadow-md shadow-amber-500/20"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry Call (Attempt {cand.unansweredAttempts + 1})</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Declined / Stop Follow-ups Section */}
      <div className="bg-[#0f182c] border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-700/40 text-slate-400 border border-slate-600 flex items-center justify-center">
              <UserX className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Declined by Candidate • Automated Follow-ups Stopped ({declinedCandidates.length})
              </h3>
              <p className="text-xs text-slate-400">
                System rule strictly enforces: When candidate declines or expresses no interest, all outreach is permanently stopped.
              </p>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700 font-medium">
            Compliance Enforced
          </span>
        </div>

        {declinedCandidates.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-500">
            No candidates have declined so far.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {declinedCandidates.map((cand) => (
              <div
                key={cand.id}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-300">{cand.name}</h4>
                      <p className="text-xs text-slate-400">{cand.appliedRole}</p>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">{cand.phone}</p>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-800 text-slate-400 rounded border border-slate-700">
                      Do Not Call
                    </span>
                  </div>

                  <div className="mt-3 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400">
                    <strong className="text-slate-300">Decline Reason:</strong> {cand.declineReason || 'Candidate is not looking for opportunities.'}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                  <span>Follow-up Status: <strong className="text-rose-400">Halted</strong></span>
                  <button
                    onClick={() => onSelectCandidate(cand)}
                    className="text-amber-400 hover:text-amber-300 text-xs"
                  >
                    View Audit Log
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Talent Pipeline & Joined Other Firm Nurturing Queue */}
      <div className="bg-[#0f182c] border border-emerald-500/30 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Talent Pipeline • Joined Other Firm ({pipelineCandidates.length})</span>
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                  90-Day Nurturing
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Candidates who recently joined another company. The AI has categorized them, logged their current package, and scheduled strategic re-engagement alerts.
              </p>
            </div>
          </div>
        </div>

        {pipelineCandidates.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-500">
            No candidates currently in the pipeline queue. When a candidate informs Arjun they have joined another company, the system logs their package and queues them here.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {pipelineCandidates.map((cand) => (
              <div
                key={cand.id}
                className="p-4 rounded-xl bg-slate-900 border border-emerald-500/30 flex flex-col justify-between hover:border-emerald-500/50 transition"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{cand.name}</h4>
                      <p className="text-xs text-amber-400">{cand.appliedRole}</p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">{cand.phone}</p>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                      {cand.latestRemark?.category || 'Talent Pipeline'}
                    </span>
                  </div>

                  {/* Priority Remark */}
                  {cand.latestRemark && (
                    <div className="mt-3 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-slate-300">
                      <div className="flex items-center justify-between text-[10px] text-emerald-400 font-semibold mb-1">
                        <span className="flex items-center gap-1">
                          <Bell className="w-3 h-3" />
                          <span>Action Due: {cand.latestRemark.actionDueDate || cand.alertDueDate || '90 Days'}</span>
                        </span>
                        <span className="text-slate-400">{cand.latestRemark.priority} Priority</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {cand.latestRemark.text}
                      </p>
                    </div>
                  )}

                  {cand.alertReason && (
                    <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{cand.alertReason}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onSelectCandidate(cand)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    View CRM Profile
                  </button>
                  <button
                    onClick={() => onTriggerCall(cand, 'screening')}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg transition shadow-md shadow-emerald-600/20"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Check-in Call</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
