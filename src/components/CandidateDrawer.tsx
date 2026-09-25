import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Phone, Mail, Building, Briefcase, Award, DollarSign, 
  MapPin, Clock, Calendar, CheckCircle2, AlertTriangle, 
  ChevronRight, MessageSquare, Play, Sparkles, UserCheck,
  Bell, ShieldAlert, History, Tag, Brain, ShieldCheck, Target,
  Check, FileText, Bold, Italic, List, CheckSquare, Save, Undo,
  CornerDownLeft, Loader2
} from 'lucide-react';
import { Candidate, CallRecord, CandidateLongTermMemory, NextCallBrief } from '../types';
import { CandidateBehaviorCard } from './CandidateBehaviorCard';

interface CandidateDrawerProps {
  candidate: Candidate | null;
  onClose: () => void;
  onStartCall: (candidate: Candidate, scenario?: string) => void;
  onStartVapiCall?: (candidate: Candidate) => void;
  onOpenConfirmationMail?: (candidate: Candidate) => void;
  onOpenWhatsApp?: (candidate: Candidate, template?: 'unanswered' | 'interview_reminder' | 'missed_followup') => void;
  onOpenScheduleCall?: (candidate: Candidate) => void;
  onUpdateCandidate?: (updated: Candidate) => void;
}

export const CandidateDrawer: React.FC<CandidateDrawerProps> = ({
  candidate,
  onClose,
  onStartCall,
  onStartVapiCall,
  onOpenConfirmationMail,
  onOpenWhatsApp,
  onOpenScheduleCall,
  onUpdateCandidate,
}) => {
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [candidateMemory, setCandidateMemory] = useState<CandidateLongTermMemory | null>(null);
  const [showBrainMemory, setShowBrainMemory] = useState<boolean>(true);

  // Manual Rich-Text HR Call Notes State
  const [hrNotes, setHrNotes] = useState<string>(candidate?.notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<string | null>(null);
  const notesTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Sync state whenever selected candidate changes
  useEffect(() => {
    setHrNotes(candidate?.notes || '');
  }, [candidate?.id]);

  // Save notes directly and update candidate state
  const handlePersistNotes = async (newNotesText: string) => {
    if (!candidate) return;
    setIsSavingNotes(true);
    const updatedCandidate: Candidate = {
      ...candidate,
      notes: newNotesText,
    };

    try {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSavedTimestamp(timeStr);
      if (onUpdateCandidate) {
        onUpdateCandidate(updatedCandidate);
      }
    } catch (e) {
      console.warn('Failed to save HR notes:', e);
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Text formatting insertion helpers
  const handleApplyFormatting = (type: 'bold' | 'italic' | 'bullet' | 'check' | 'timestamp') => {
    const textarea = notesTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = hrNotes;
    const selected = current.substring(start, end);

    let replacement = '';
    let cursorOffset = 0;

    switch (type) {
      case 'bold':
        replacement = selected ? `**${selected}**` : '**bold text**';
        cursorOffset = selected ? replacement.length : 2;
        break;
      case 'italic':
        replacement = selected ? `*${selected}*` : '*italic text*';
        cursorOffset = selected ? replacement.length : 1;
        break;
      case 'bullet':
        replacement = `\n• ${selected || 'Observation: '}`;
        cursorOffset = replacement.length;
        break;
      case 'check':
        replacement = `\n[✓] ${selected || 'Verified requirement: '}`;
        cursorOffset = replacement.length;
        break;
      case 'timestamp': {
        const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        replacement = `\n[${timeNow} HR Note]: `;
        cursorOffset = replacement.length;
        break;
      }
    }

    const updatedText = current.substring(0, start) + replacement + current.substring(end);
    setHrNotes(updatedText);
    handlePersistNotes(updatedText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
    }, 50);
  };

  useEffect(() => {
    if (candidate?.id) {
      fetch(`/api/brain/candidate-memory/${candidate.id}`)
        .then((r) => {
          if (r.ok) return r.json();
          return null;
        })
        .then((mem) => {
          if (mem) setCandidateMemory(mem);
        })
        .catch(() => {});
    }
  }, [candidate?.id]);

  if (!candidate) return null;

  const s = candidate.screening || {};

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Attendance Confirmed':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'Interview Scheduled':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'Screened - Ready for Interview':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'Missed Interview - Followup':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'Callback Needed':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'Declined - Do Not Call':
        return 'bg-slate-700/40 text-slate-400 border-slate-600';
      default:
        return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[#0d1526] border-l border-slate-800 h-full flex flex-col shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-800 bg-[#0f172a] sticky top-0 z-10">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-white font-['Space_Grotesk']">
                  {candidate.name}
                </h2>
                {candidate.status === 'Missed Interview - Followup' && (
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/50 flex items-center gap-1 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    High Priority
                  </span>
                )}
                {(candidate.status === 'Interview Scheduled' || candidate.status === 'Attendance Confirmed' || candidate.interviewSlotId) && (
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/50 flex items-center gap-1 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Upcoming Slot
                  </span>
                )}
                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getStatusBadge(candidate.status)}`}>
                  {candidate.status}
                </span>
              </div>
              <p className="text-sm text-amber-400 font-medium mt-1">
                {candidate.appliedRole}
              </p>
              <div className="flex items-center gap-4 text-xs text-slate-400 mt-2 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  {candidate.phone}
                </span>
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  {candidate.email}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Call Action Bar */}
          <div className="mt-5 flex items-center gap-2.5 flex-wrap">
            {onStartVapiCall && (
              <button
                id="btn-drawer-vapi-call"
                onClick={() => onStartVapiCall(candidate)}
                className="flex-1 min-w-[150px] flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-slate-950 px-4 py-2 rounded-lg text-xs font-bold transition shadow-md shadow-amber-500/20 active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                <span>Vapi Voice Screening</span>
              </button>
            )}

            <button
              onClick={() => onStartCall(candidate, 'screening')}
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-lg text-xs font-semibold transition"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Simulate Call</span>
            </button>

            {candidate.interviewSlotId && (
              <button
                onClick={() => onStartCall(candidate, 'reminder')}
                className="flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 px-3.5 py-2 rounded-lg text-xs font-semibold transition"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Reconfirm Attendance</span>
              </button>
            )}

            {candidate.status === 'Missed Interview - Followup' && (
              <button
                onClick={() => onStartCall(candidate, 'missed_followup')}
                className="flex items-center gap-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 px-3.5 py-2 rounded-lg text-xs font-semibold transition"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Follow-up Missed</span>
              </button>
            )}

            {candidate.status === 'Callback Needed' && (
              <button
                onClick={() => onStartCall(candidate, 'callback_followup')}
                className="flex items-center gap-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 px-3.5 py-2 rounded-lg text-xs font-semibold transition"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Take Callback</span>
              </button>
            )}

            {onOpenScheduleCall && (
              <button
                id="btn-drawer-schedule-call"
                onClick={() => onOpenScheduleCall(candidate)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition shadow-xs ${
                  candidate.scheduledCall?.status === 'pending'
                    ? 'bg-amber-500/25 hover:bg-amber-500/35 text-amber-300 border border-amber-500/50'
                    : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30'
                }`}
                title="Schedule automated AI follow-up call with date and time picker"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {candidate.scheduledCall?.status === 'pending'
                    ? `Call Scheduled (${candidate.scheduledCall.time})`
                    : 'Schedule AI Call'}
                </span>
                {candidate.scheduledCall?.status === 'pending' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block" />
                )}
              </button>
            )}

            {onOpenConfirmationMail && (candidate.interviewSlotId || candidate.status === 'Interview Scheduled' || candidate.status === 'Attendance Confirmed') && (
              <button
                onClick={() => onOpenConfirmationMail(candidate)}
                className="flex items-center gap-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 px-3 py-2 rounded-lg text-xs font-semibold transition shadow-xs"
                title="Send official interview confirmation letter with Sector 67 venue details"
              >
                <Mail className="w-3.5 h-3.5 text-amber-400" />
                <span>Send Confirmation Mail</span>
                {candidate.lastEmailSentAt && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Email dispatched" />
                )}
              </button>
            )}

            {onOpenWhatsApp && (
              <button
                onClick={() => onOpenWhatsApp(
                  candidate, 
                  candidate.status === 'Missed Interview - Followup' 
                    ? 'missed_followup' 
                    : candidate.interviewSlotId 
                    ? 'interview_reminder' 
                    : 'unanswered'
                )}
                className="flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-3 py-2 rounded-lg text-xs font-semibold transition shadow-xs"
                title="Send WhatsApp message to candidate who did not answer call or needs interview reminder"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>Send WhatsApp Reminder</span>
                {candidate.lastWhatsAppSentAt && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="WhatsApp dispatched" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Drawer Content */}
        <div className="p-6 space-y-6">
          {/* Priority Remarks & Day-by-Day Alert Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-[#0d1629] border border-slate-800 shadow-md">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl border ${
                  candidate.alertDueDate === 'Overdue'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : candidate.alertDueDate === 'Today'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : candidate.alertDueDate === 'Tomorrow'
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                    <span>Priority Remark & Day-by-Day Alert</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {candidate.alertDueDate ? `Alert Action Due: ${candidate.alertDueDate}` : 'No active due alert'}
                  </span>
                </div>
              </div>

              {/* Priority & Category Badges */}
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {candidate.latestRemark?.priority && (
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                    candidate.latestRemark.priority === 'Urgent'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse'
                      : candidate.latestRemark.priority === 'High'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : candidate.latestRemark.priority === 'Medium'
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {candidate.latestRemark.priority} Priority
                  </span>
                )}
                {candidate.latestRemark?.category && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-amber-300 border border-slate-700 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-amber-400" />
                    <span>{candidate.latestRemark.category}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Active Remark Text */}
            <div className="mt-3 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 leading-relaxed">
              <div className="text-[11px] font-bold text-amber-400 mb-1 flex items-center justify-between">
                <span>Latest Autonomous HR Remark:</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  {candidate.latestRemark?.createdAt || candidate.lastCallDate || 'Recent'}
                </span>
              </div>
              <p className="text-slate-300">
                {candidate.latestRemark?.text || candidate.notes || 'Screening pending. Profile awaiting initial AI voice outreach.'}
              </p>
            </div>

            {/* Scheduled AI Call Banner */}
            {candidate.scheduledCall && candidate.scheduledCall.status === 'pending' && (
              <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-amber-300 flex items-center gap-1.5">
                      <span>AI Follow-up Call Scheduled</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block" />
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      {candidate.scheduledCall.date} at {candidate.scheduledCall.time} ({candidate.scheduledCall.scenario})
                      {candidate.scheduledCall.notes && ` • "${candidate.scheduledCall.notes}"`}
                    </p>
                  </div>
                </div>
                {onOpenScheduleCall && (
                  <button
                    onClick={() => onOpenScheduleCall(candidate)}
                    className="text-[11px] text-amber-400 hover:text-amber-300 underline font-semibold shrink-0"
                  >
                    Edit
                  </button>
                )}
              </div>
            )}

            {/* Alert Detail Line */}
            {candidate.alertReason && (
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400 px-1">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">{candidate.alertReason}</span>
              </div>
            )}

            {/* Past Remarks History Accordion */}
            {candidate.remarksHistory && candidate.remarksHistory.length > 1 && (
              <div className="mt-3 pt-3 border-t border-slate-800/80">
                <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 mb-2">
                  <History className="w-3.5 h-3.5 text-slate-500" />
                  <span>Previous Remarks History ({candidate.remarksHistory.length})</span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 text-xs">
                  {candidate.remarksHistory.slice(1).map((rem) => (
                    <div key={rem.id} className="p-2 rounded-lg bg-slate-950/40 border border-slate-800 text-[11px] text-slate-400">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                        <span className="font-semibold text-slate-300">{rem.category} ({rem.priority})</span>
                        <span>{rem.createdAt}</span>
                      </div>
                      <p className="text-slate-300 line-clamp-2">{rem.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 7 Mandatory Screening Items Grid */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
              <span>White Collar Realty Screening Checklist (7 Data Points)</span>
              <span className="text-[11px] text-amber-400 font-normal">Automated Voice Extraction</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Item 1: Current Company & Designation */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <Building className="w-3.5 h-3.5 text-amber-400" />
                  <span>1. Company & Designation</span>
                </div>
                <div className="text-sm font-semibold text-white">
                  {s.currentCompany || 'Pending collection'}
                </div>
                <div className="text-xs text-slate-400">
                  {s.currentDesignation || 'Designation not stated yet'}
                </div>
              </div>

              {/* Item 2: Total & Real Estate Experience */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                  <span>2. Total & RE Experience</span>
                </div>
                <div className="text-sm font-semibold text-white">
                  {s.realEstateExperienceYears 
                    ? `${s.realEstateExperienceYears} Yrs Real Estate` 
                    : 'RE Exp: Not specified'}
                </div>
                <div className="text-xs text-slate-400">
                  {s.totalExperienceYears ? `${s.totalExperienceYears} Yrs Total Career` : 'Total Exp pending'}
                </div>
              </div>

              {/* Item 3: Gurgaon & Dubai Property Experience */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 sm:col-span-2">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
                  <div className="flex items-center gap-2">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    <span>3. Gurgaon & Dubai Property Experience</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      s.gurgaonDubaiExperience?.gurgaon ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'
                    }`}>
                      Gurgaon: {s.gurgaonDubaiExperience?.gurgaon ? 'Yes' : 'No'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      s.gurgaonDubaiExperience?.dubai ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-500'
                    }`}>
                      Dubai: {s.gurgaonDubaiExperience?.dubai ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-300">
                  {s.gurgaonDubaiExperience?.details || 'Candidate has not shared specific territory or developer details yet.'}
                </p>
              </div>

              {/* Item 4: Current & Expected CTC */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                  <span>4. Present & Expected CTC</span>
                </div>
                <div className="text-sm font-semibold text-emerald-400">
                  {s.expectedSalaryLPA ? `Exp: ${s.expectedSalaryLPA}` : 'Expected: Pending'}
                </div>
                <div className="text-xs text-slate-400">
                  {s.currentSalaryLPA ? `Current: ${s.currentSalaryLPA}` : 'Current: Pending'}
                </div>
              </div>

              {/* Item 5: Location */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span>5. Current Location</span>
                </div>
                <div className="text-sm font-semibold text-white">
                  {s.currentLocation || 'Location not recorded'}
                </div>
                <div className="text-xs text-slate-400">
                  Commute to Sector 67, Gurugram
                </div>
              </div>

              {/* Item 6: Notice Period & Earliest Joining */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>6. Notice Period & Joining</span>
                </div>
                <div className="text-sm font-semibold text-white">
                  {s.noticePeriodDays !== undefined ? `${s.noticePeriodDays} Days Notice` : 'Notice: Pending'}
                </div>
                <div className="text-xs text-slate-400">
                  {s.earliestJoiningDate ? `Earliest: ${s.earliestJoiningDate}` : 'Immediate / negotiable'}
                </div>
              </div>

              {/* Item 7: Interview Availability */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span>7. F2F Interview Availability</span>
                </div>
                <div className="text-sm font-semibold text-amber-400">
                  {candidate.interviewTime 
                    ? `${candidate.interviewDate} (${candidate.interviewTime})`
                    : s.preferredInterviewSlot || 'Slot not selected'}
                </div>
                <div className="text-xs text-slate-400">
                  {candidate.interviewVenue ? 'Venue: Sector 67 HQ Confirmed' : 'Venue: Pending candidate agreement'}
                </div>
              </div>
            </div>
          </div>

          {/* Interview Booking Confirmation Card */}
          {candidate.interviewSlotId && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-900 border border-amber-500/30">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Confirmed Face-to-Face Interview
                    </h4>
                    <p className="text-xs text-amber-300 font-medium">
                      {candidate.interviewDate} • {candidate.interviewTime}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                  candidate.interviewStatus === 'Confirmed' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {candidate.interviewStatus}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-300">
                <strong className="text-slate-200">Office Location:</strong> {candidate.interviewVenue}
              </div>
            </div>
          )}

          {/* AI Scorecard & Fit Assessment */}
          {candidate.scorecard && (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>AI Screening Scorecard</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-lg bg-slate-800/60">
                  <div className="text-slate-400 text-[10px]">Gurgaon/Dubai Exp</div>
                  <div className="font-bold text-amber-400 mt-1">{candidate.scorecard.gurgaonDubaiScore}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-800/60">
                  <div className="text-slate-400 text-[10px]">Experience Level</div>
                  <div className="font-bold text-white mt-1">{candidate.scorecard.experienceFit}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-800/60">
                  <div className="text-slate-400 text-[10px]">Budget Alignment</div>
                  <div className="font-bold text-emerald-400 mt-1">{candidate.scorecard.budgetAlignment}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-800/60">
                  <div className="text-slate-400 text-[10px]">Recommendation</div>
                  <div className="font-bold text-amber-400 mt-1">{candidate.scorecard.recommendation}</div>
                </div>
              </div>
            </div>
          )}

          {/* AI HR Brain Persistent Memory Card (Rule 1, 4, 5, 9) */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#0c1424] via-slate-900 to-[#0b1220] border border-amber-500/25 shadow-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <Brain className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span>Central AI HR Brain Memory</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-300 font-normal">
                      Persistent
                    </span>
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Source provenance & zero-repetition verified attributes
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBrainMemory(!showBrainMemory)}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold"
              >
                {showBrainMemory ? 'Hide Details' : 'Show Details'}
              </button>
            </div>

            {showBrainMemory && (
              <div className="mt-3 space-y-3 text-xs">
                {/* Verified Attributes Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <div className="text-slate-400 text-[10px]">Total Real Estate Exp</div>
                    <div className="text-white font-semibold mt-0.5 flex items-center justify-between">
                      <span>{candidateMemory?.experience?.totalYears?.value || candidate.screening?.totalExperienceYears || 'Pending'} Yrs</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {candidateMemory?.experience?.totalYears?.source || 'verified'}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <div className="text-slate-400 text-[10px]">Highest Personal Closure</div>
                    <div className="text-amber-300 font-semibold mt-0.5 flex items-center justify-between">
                      <span>{candidateMemory?.salesPerformance?.highestPersonalClosure?.value || 'Pending call'}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {candidateMemory?.salesPerformance?.highestPersonalClosure?.source || 'candidate'}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <div className="text-slate-400 text-[10px]">Current & Expected CTC</div>
                    <div className="text-white font-semibold mt-0.5">
                      {candidateMemory?.compensation?.currentSalary?.value || candidate.screening?.currentSalaryLPA || 'Undisclosed'} → {candidateMemory?.compensation?.expectedSalary?.value || candidate.screening?.expectedSalaryLPA || 'TBD'}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <div className="text-slate-400 text-[10px]">Notice Period</div>
                    <div className="text-white font-semibold mt-0.5">
                      {candidateMemory?.noticePeriod?.days?.value !== undefined ? `${candidateMemory.noticePeriod.days.value} Days` : candidate.screening?.noticePeriodDays !== undefined ? `${candidate.screening.noticePeriodDays} Days` : '15-30 Days'}
                    </div>
                  </div>
                </div>

                {/* Candidate Specific Learnings */}
                {candidateMemory?.candidateSpecificLearnings && candidateMemory.candidateSpecificLearnings.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-purple-950/20 border border-purple-500/20 text-[11px] text-purple-200">
                    <div className="font-bold text-purple-300 mb-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span>Learned Candidate Preferences & Context:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                      {candidateMemory.candidateSpecificLearnings.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Contradictions & Corrections Banner */}
                {candidateMemory?.contradictions && candidateMemory.contradictions.filter(c => c.status === 'PENDING_CLARIFICATION').length > 0 && (
                  <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/40 text-[11px] text-rose-200">
                    <div className="font-bold text-rose-300 mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-400" />
                      <span>Pending Memory Contradiction (Rule 5):</span>
                    </div>
                    {candidateMemory.contradictions.filter(c => c.status === 'PENDING_CLARIFICATION').map((c, i) => (
                      <div key={i} className="text-slate-300 mt-1">
                        • {c.topic}: Previously reported <span className="text-amber-300 font-semibold">{c.previousValue}</span> vs new statement <span className="text-rose-300 font-semibold">{c.newValue}</span>. Requires gentle clarification.
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Candidate Behavior & Conversation Intelligence Section (Rules 1-43) */}
          <div>
            <CandidateBehaviorCard
              candidateId={candidate.id}
              initialReport={candidate.latestBehaviorReport}
            />
          </div>

          {/* HR Manual Notes & Live Call Log Section (Persisted to Firestore immediately) */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#0d1627] via-slate-900 to-[#0b1220] border border-amber-500/30 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <span>HR Manual Notes & Call Observations</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Live Firestore Sync
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Log observations, candidate counter-offers, or post-call verification details
                  </p>
                </div>
              </div>

              {/* Real-time Save Status Indicator */}
              <div className="flex items-center gap-2 text-xs">
                {isSavingNotes ? (
                  <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </span>
                ) : lastSavedTimestamp ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Saved to Firestore ({lastSavedTimestamp})</span>
                  </span>
                ) : (
                  <span className="text-slate-500 text-[11px]">Auto-saved on change</span>
                )}
              </div>
            </div>

            {/* Rich-Text Formatting Toolbar */}
            <div className="mt-3 flex items-center gap-1.5 p-1.5 bg-slate-950/80 rounded-lg border border-slate-800 flex-wrap">
              <button
                type="button"
                onClick={() => handleApplyFormatting('bold')}
                className="px-2 py-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1 transition"
                title="Bold (**text**)"
              >
                <Bold className="w-3.5 h-3.5" />
                <span className="text-[11px]">Bold</span>
              </button>

              <button
                type="button"
                onClick={() => handleApplyFormatting('italic')}
                className="px-2 py-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white text-xs italic flex items-center gap-1 transition"
                title="Italic (*text*)"
              >
                <Italic className="w-3.5 h-3.5" />
                <span className="text-[11px]">Italic</span>
              </button>

              <div className="h-4 w-[1px] bg-slate-800 mx-1" />

              <button
                type="button"
                onClick={() => handleApplyFormatting('bullet')}
                className="px-2 py-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white text-xs flex items-center gap-1 transition"
                title="Insert Bullet Point"
              >
                <List className="w-3.5 h-3.5" />
                <span className="text-[11px]">Bullet</span>
              </button>

              <button
                type="button"
                onClick={() => handleApplyFormatting('check')}
                className="px-2 py-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white text-xs flex items-center gap-1 transition"
                title="Insert Requirement Checkpoint"
              >
                <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px]">Requirement Check</span>
              </button>

              <button
                type="button"
                onClick={() => handleApplyFormatting('timestamp')}
                className="px-2 py-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white text-xs flex items-center gap-1 transition"
                title="Insert Current Time Stamp"
              >
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px]">Stamp Time</span>
              </button>

              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePersistNotes(hrNotes)}
                  disabled={isSavingNotes}
                  className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                  title="Force immediate cloud persist"
                >
                  <Save className="w-3 h-3" />
                  <span>Save Notes</span>
                </button>
              </div>
            </div>

            {/* Editable Rich-Text Area */}
            <div className="mt-2.5">
              <textarea
                ref={notesTextareaRef}
                rows={5}
                value={hrNotes}
                onChange={(e) => {
                  const val = e.target.value;
                  setHrNotes(val);
                }}
                onBlur={() => {
                  handlePersistNotes(hrNotes);
                }}
                placeholder="Log internal recruiter thoughts during or after calls... e.g.:
• Candidate demonstrated strong understanding of Golf Course Extension Road developer inventory.
• Currently drawing 16 LPA fixed, open to 20-22 LPA depending on DLF project allocation.
[✓] Verified 4.5 years luxury real estate sales pedigree."
                className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-500 font-sans focus:outline-hidden focus:border-amber-500 transition leading-relaxed resize-y"
              />
            </div>
          </div>

          {/* Call Logs & Transcripts */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
              <span>Call Records & Voice Transcripts ({candidate.callHistory.length})</span>
            </h3>

            {candidate.callHistory.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-500">
                No calls recorded yet for this candidate. Click "Screening Call" to initiate the HR voice agent.
              </div>
            ) : (
              <div className="space-y-3">
                {candidate.callHistory.map((call) => (
                  <div
                    key={call.id}
                    className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between text-xs mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white uppercase text-[11px] bg-slate-800 px-2 py-0.5 rounded">
                          {call.scenario} Call
                        </span>
                        <span className="text-slate-400">{call.timestamp}</span>
                      </div>
                      <span className="text-emerald-400 font-semibold">{call.outcome}</span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 mb-3">
                      {call.summary}
                    </p>

                    <button
                      onClick={() => setSelectedCall(selectedCall?.id === call.id ? null : call)}
                      className="text-xs text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{selectedCall?.id === call.id ? 'Hide Full Transcript' : `View Full Transcript (${call.transcript.length} turns)`}</span>
                    </button>

                    {/* Expandable transcript */}
                    {selectedCall?.id === call.id && (
                      <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 max-h-64 overflow-y-auto pr-1">
                        {call.transcript.map((msg) => (
                          <div
                            key={msg.id}
                            className={`p-2.5 rounded-lg text-xs ${
                              msg.sender === 'agent'
                                ? 'bg-amber-950/20 border border-amber-500/20 text-slate-200'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between font-bold text-[10px] text-slate-400 mb-1">
                              <span>{msg.sender === 'agent' ? 'Arjun (White Collar HR)' : candidate.name}</span>
                              <span>{msg.timestamp}</span>
                            </div>
                            <div>{msg.text}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
