import React, { useState, useEffect } from 'react';
import { 
  Users, Calendar, Clock, PhoneCall, Search, Filter, 
  Sparkles, CheckCircle2, AlertTriangle, ArrowUpRight, 
  Building, MapPin, Briefcase, DollarSign, MessageSquare, 
  Bot, Phone, ChevronRight, RefreshCw, Plus, CheckCircle, 
  HelpCircle, Volume2, Mail, Bell, ShieldAlert, Tag, Radio
} from 'lucide-react';
import { Candidate, InterviewSlot, CallScenario } from './types';
import { INITIAL_CANDIDATES, INITIAL_INTERVIEW_SLOTS } from './data/mockCandidates';
import { Header } from './components/Header';
import { MetricsBar } from './components/MetricsBar';
import { CandidateDrawer } from './components/CandidateDrawer';
import { VoiceCallModal } from './components/VoiceCallModal';
import { VapiCallModal } from './components/VapiCallModal';
import { InterviewScheduleTab } from './components/InterviewScheduleTab';
import { FollowupQueueTab } from './components/FollowupQueueTab';
import { AutomationQueueTab } from './components/AutomationQueueTab';
import { NewCandidateModal } from './components/NewCandidateModal';
import { ConfirmationEmailModal } from './components/ConfirmationEmailModal';
import { WhatsAppReminderModal } from './components/WhatsAppReminderModal';
import { AiHrBrainModal } from './components/AiHrBrainModal';
import { ScheduleCallModal } from './components/ScheduleCallModal';
import { vapiService, VapiCallStatus, DEFAULT_VAPI_ASSISTANT_ID } from './utils/vapiService';

export default function App() {
  const [candidates, setCandidates] = useState<Candidate[]>(() => {
    try {
      const stored = localStorage.getItem('wcr_candidates');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Failed to parse stored candidates:', e);
    }
    return INITIAL_CANDIDATES;
  });

  const [interviewSlots, setInterviewSlots] = useState<InterviewSlot[]>(() => {
    try {
      const stored = localStorage.getItem('wcr_interview_slots');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Failed to parse stored slots:', e);
    }
    return INITIAL_INTERVIEW_SLOTS;
  });

  const [activeTab, setActiveTab] = useState<'roster' | 'schedule' | 'followups' | 'transcripts'>('roster');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [metricsFilter, setMetricsFilter] = useState('all');
  const [dayAlertFilter, setDayAlertFilter] = useState<'all' | 'overdue' | 'today' | 'tomorrow' | 'pipeline'>('all');

  // Modals state
  const [showBrainModal, setShowBrainModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [activeCallCandidate, setActiveCallCandidate] = useState<Candidate | null>(null);
  const [activeCallScenario, setActiveCallScenario] = useState<CallScenario>('screening');
  const [showNewCandidateModal, setShowNewCandidateModal] = useState(false);
  const [confirmationMailCandidate, setConfirmationMailCandidate] = useState<Candidate | null>(null);
  const [scheduleCallCandidate, setScheduleCallCandidate] = useState<Candidate | null>(null);
  const [whatsAppCandidate, setWhatsAppCandidate] = useState<{
    candidate: Candidate;
    template?: 'unanswered' | 'interview_reminder' | 'missed_followup';
  } | null>(null);

  // Vapi Voice Assistant state
  const [vapiCallStatus, setVapiCallStatus] = useState<VapiCallStatus>('idle');
  const [vapiCandidate, setVapiCandidate] = useState<Candidate | null>(null);
  const [showVapiModal, setShowVapiModal] = useState<boolean>(false);

  // Listen to Vapi state events
  useEffect(() => {
    const unsub = vapiService.onStatusChange((status) => {
      setVapiCallStatus(status);
    });
    return () => unsub();
  }, []);

  // Autonomous scheduler ticker: checks every 10 seconds for scheduled AI calls due
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCandidates((currentCandidates) => {
        let hasTriggered = false;
        const updated = currentCandidates.map((c) => {
          if (
            c.scheduledCall &&
            c.scheduledCall.status === 'pending' &&
            new Date(c.scheduledCall.scheduledAt).getTime() <= now.getTime()
          ) {
            hasTriggered = true;
            // Trigger call immediately if no call is currently active
            if (!activeCallCandidate && !showVapiModal) {
              handleStartCall(c, c.scheduledCall.scenario);
            }
            return {
              ...c,
              scheduledCall: {
                ...c.scheduledCall,
                status: 'triggered' as const,
              },
              notes: `${c.notes ? c.notes + ' | ' : ''}AI follow-up call auto-triggered at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
            };
          }
          return c;
        });

        return updated;
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [activeCallCandidate, showVapiModal]);

  // Synchronize candidates to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('wcr_candidates', JSON.stringify(candidates));
    } catch (e) {
      console.warn('Failed to save candidates to localStorage:', e);
    }
  }, [candidates]);

  // Synchronize interview slots to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('wcr_interview_slots', JSON.stringify(interviewSlots));
    } catch (e) {
      console.warn('Failed to save interview slots to localStorage:', e);
    }
  }, [interviewSlots]);

  const handleEmailSent = (candidateId: string) => {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId
          ? {
              ...c,
              lastEmailSentAt: timestamp,
              notes: `${c.notes ? c.notes + ' | ' : ''}Interview confirmation mail dispatched at ${timestamp}.`,
            }
          : c
      )
    );
    if (selectedCandidate && selectedCandidate.id === candidateId) {
      setSelectedCandidate((prev) =>
        prev ? { ...prev, lastEmailSentAt: timestamp } : null
      );
    }
  };

  const handleWhatsAppSent = (candidateId: string) => {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId
          ? {
              ...c,
              lastWhatsAppSentAt: timestamp,
              notes: `${c.notes ? c.notes + ' | ' : ''}WhatsApp reminder message sent at ${timestamp}.`,
            }
          : c
      )
    );
    if (selectedCandidate && selectedCandidate.id === candidateId) {
      setSelectedCandidate((prev) =>
        prev ? { ...prev, lastWhatsAppSentAt: timestamp } : null
      );
    }
  };

  const handleSaveSchedule = (
    candidateId: string,
    schedule: {
      scheduledAt: string;
      date: string;
      time: string;
      scenario: CallScenario;
      notes?: string;
    }
  ) => {
    let targetCand: Candidate | null = null;

    setCandidates((prev) =>
      prev.map((c) => {
        if (c.id === candidateId) {
          const updated: Candidate = {
            ...c,
            scheduledCall: {
              ...schedule,
              status: 'pending',
            },
            notes: `${c.notes ? c.notes + ' | ' : ''}AI Follow-up call scheduled for ${schedule.date} at ${schedule.time} (${schedule.scenario}).`,
          };
          targetCand = updated;
          return updated;
        }
        return c;
      })
    );

    if (selectedCandidate && selectedCandidate.id === candidateId && targetCand) {
      setSelectedCandidate(targetCand);
    }
  };

  const handleCancelSchedule = (candidateId: string) => {
    let targetCand: Candidate | null = null;

    setCandidates((prev) =>
      prev.map((c) => {
        if (c.id === candidateId && c.scheduledCall) {
          const updated: Candidate = {
            ...c,
            scheduledCall: {
              ...c.scheduledCall,
              status: 'cancelled',
            },
            notes: `${c.notes ? c.notes + ' | ' : ''}Scheduled AI call for ${c.scheduledCall.date} cancelled.`,
          };
          targetCand = updated;
          return updated;
        }
        return c;
      })
    );

    if (selectedCandidate && selectedCandidate.id === candidateId && targetCand) {
      setSelectedCandidate(targetCand);
    }
  };

  // Helper to determine candidate priority label and color highlighting
  const getCandidatePriority = (cand: Candidate) => {
    // Missed interviews: High Priority (Red highlight)
    if (cand.status === 'Missed Interview - Followup') {
      return {
        key: 'high',
        label: 'High Priority',
        badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-xs shadow-rose-950/40',
        cardHighlight: 'border-rose-500/60 hover:border-rose-400 ring-1 ring-rose-500/30 shadow-rose-950/30',
        icon: AlertTriangle,
        iconColor: 'text-rose-400',
        pulse: true,
      };
    }

    // Upcoming slots / Scheduled / Attendance Confirmed: Upcoming Slot (Amber highlight)
    if (cand.status === 'Interview Scheduled' || cand.status === 'Attendance Confirmed' || cand.interviewSlotId) {
      return {
        key: 'upcoming',
        label: cand.status === 'Attendance Confirmed' ? 'Confirmed Slot' : 'Upcoming Slot',
        badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-xs shadow-amber-950/40',
        cardHighlight: 'border-amber-500/60 hover:border-amber-400 ring-1 ring-amber-500/30 shadow-amber-950/30',
        icon: Clock,
        iconColor: 'text-amber-400',
        pulse: false,
      };
    }

    // Action Needed: Callback Needed or Unanswered Attempts
    if (cand.status === 'Callback Needed' || cand.unansweredAttempts > 0) {
      return {
        key: 'callback',
        label: cand.status === 'Callback Needed' ? 'Callback Due' : `Retry (${cand.unansweredAttempts}/3)`,
        badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        cardHighlight: 'border-purple-500/30 hover:border-purple-400',
        icon: PhoneCall,
        iconColor: 'text-purple-400',
        pulse: false,
      };
    }

    if (cand.status === 'Screened - Ready for Interview') {
      return {
        key: 'ready',
        label: 'Ready to Schedule',
        badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
        cardHighlight: 'border-slate-800/90 hover:border-sky-500/40',
        icon: CheckCircle2,
        iconColor: 'text-sky-400',
        pulse: false,
      };
    }

    if (cand.status === 'Declined - Do Not Call') {
      return {
        key: 'closed',
        label: 'Closed',
        badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
        cardHighlight: 'border-slate-800/60 opacity-80',
        icon: AlertTriangle,
        iconColor: 'text-slate-500',
        pulse: false,
      };
    }

    return {
      key: 'normal',
      label: 'Standard Lead',
      badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
      cardHighlight: 'border-slate-800/90 hover:border-amber-500/40',
      icon: Sparkles,
      iconColor: 'text-blue-400',
      pulse: false,
    };
  };

  // Day-by-Day Alert Counts
  const overdueCount = candidates.filter((c) => c.alertDueDate === 'Overdue').length;
  const todayCount = candidates.filter((c) => c.alertDueDate === 'Today').length;
  const tomorrowCount = candidates.filter((c) => c.alertDueDate === 'Tomorrow').length;
  const pipelineCount = candidates.filter(
    (c) =>
      c.latestRemark?.category?.includes('Already Joined') ||
      c.alertDueDate === 'Upcoming' ||
      c.latestRemark?.actionDueDate?.includes('90')
  ).length;

  // Filter candidates based on search, status filter, priority filter, day alert filter, and metric card clicks
  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.appliedRole.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.screening?.currentCompany || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.screening?.currentLocation || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Day-by-day alert filter
    if (dayAlertFilter !== 'all') {
      if (dayAlertFilter === 'overdue' && c.alertDueDate !== 'Overdue') return false;
      if (dayAlertFilter === 'today' && c.alertDueDate !== 'Today') return false;
      if (dayAlertFilter === 'tomorrow' && c.alertDueDate !== 'Tomorrow') return false;
      if (dayAlertFilter === 'pipeline') {
        const isPipeline =
          c.latestRemark?.category?.includes('Already Joined') ||
          c.alertDueDate === 'Upcoming' ||
          c.latestRemark?.actionDueDate?.includes('90');
        if (!isPipeline) return false;
      }
    }

    if (metricsFilter === 'screened') {
      return ['Screened - Ready for Interview', 'Interview Scheduled', 'Attendance Confirmed'].includes(c.status);
    }
    if (metricsFilter === 'scheduled') {
      return ['Interview Scheduled', 'Attendance Confirmed'].includes(c.status);
    }
    if (metricsFilter === 'followups') {
      return ['Missed Interview - Followup', 'Callback Needed'].includes(c.status) || c.unansweredAttempts > 0;
    }

    if (statusFilter !== 'all' && c.status !== statusFilter) {
      return false;
    }

    if (priorityFilter !== 'all') {
      const p = getCandidatePriority(c);
      if (priorityFilter === 'high' && p.key !== 'high') return false;
      if (priorityFilter === 'upcoming' && p.key !== 'upcoming') return false;
      if (priorityFilter === 'callback' && p.key !== 'callback') return false;
    }

    return true;
  });

  // Launch live Vapi voice assistant call
  const handleStartVapiCall = (candidate?: Candidate) => {
    if (vapiCallStatus === 'active' || vapiCallStatus === 'connecting') {
      setShowVapiModal(true);
      return;
    }

    const targetCandidate =
      candidate ||
      selectedCandidate ||
      candidates.find((c) => c.status === 'Screening Pending') ||
      candidates[0];

    setVapiCandidate(targetCandidate);
    setShowVapiModal(true);
  };

  const handleEndVapiCall = () => {
    vapiService.stopCall();
  };

  // Launch a call simulation
  const handleStartCall = (candidate: Candidate, scenario: string = 'screening') => {
    setActiveCallCandidate(candidate);
    setActiveCallScenario(scenario as CallScenario);
  };

  // Called when a live voice call ends
  const handleCallEnded = (updatedCandidate: Candidate, bookedSlotId?: string) => {
    // Update candidate list
    setCandidates((prev) =>
      prev.map((c) => (c.id === updatedCandidate.id ? updatedCandidate : c))
    );

    // If a slot was booked or changed
    if (bookedSlotId) {
      setInterviewSlots((prev) =>
        prev.map((slot) => {
          if (slot.id === bookedSlotId) {
            return {
              ...slot,
              bookedCount: 1,
              bookedCandidateId: updatedCandidate.id,
              bookedCandidateName: updatedCandidate.name,
              isAvailable: false,
            };
          }
          // Free previously booked slot if this candidate had another slot
          if (slot.bookedCandidateId === updatedCandidate.id && slot.id !== bookedSlotId) {
            return {
              ...slot,
              bookedCount: 0,
              bookedCandidateId: undefined,
              bookedCandidateName: undefined,
              isAvailable: true,
            };
          }
          return slot;
        })
      );
    }

    // Update selected candidate drawer if open
    if (selectedCandidate && selectedCandidate.id === updatedCandidate.id) {
      setSelectedCandidate(updatedCandidate);
    }

    setActiveCallCandidate(null);
  };

  // Handle slot cancellation
  const handleCancelSlotBooking = (slotId: string) => {
    const slot = interviewSlots.find((s) => s.id === slotId);
    if (!slot || !slot.bookedCandidateId) return;

    const candId = slot.bookedCandidateId;

    setInterviewSlots((prev) =>
      prev.map((s) =>
        s.id === slotId
          ? {
              ...s,
              bookedCount: 0,
              bookedCandidateId: undefined,
              bookedCandidateName: undefined,
              isAvailable: true,
            }
          : s
      )
    );

    setCandidates((prev) =>
      prev.map((c) => {
        if (c.id === candId) {
          return {
            ...c,
            status: 'Screened - Ready for Interview',
            interviewStatus: 'Not Scheduled',
            interviewSlotId: undefined,
            interviewDate: undefined,
            interviewTime: undefined,
            notes: `Interview slot for ${slot.date} cancelled. Ready to be rescheduled.`,
          };
        }
        return c;
      })
    );
  };

  // Handle slot rescheduling trigger
  const handleRescheduleClick = (candidate: Candidate) => {
    handleStartCall(candidate, 'screening');
  };

  // Add new candidate
  const handleAddCandidate = (newCand: Candidate) => {
    setCandidates((prev) => [newCand, ...prev]);
    setSelectedCandidate(newCand);
  };

  // Helper for status badge
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
    <div className="min-h-screen bg-[#090e1a] text-slate-100 flex flex-col selection:bg-amber-500 selection:text-black">
      {/* Top Header */}
      <Header
        onNewCandidate={() => setShowNewCandidateModal(true)}
        onQuickStartCall={() => handleStartVapiCall()}
        onStartInteractiveCall={() => {
          const targetCandidate =
            selectedCandidate ||
            candidates.find((c) => c.status === 'Screening Pending') ||
            candidates[0];
          handleStartCall(targetCandidate, 'screening');
        }}
        onEndCall={handleEndVapiCall}
        onOpenBrainModal={() => setShowBrainModal(true)}
        vapiCallStatus={vapiCallStatus}
        activeCandidateCount={candidates.length}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* KPI Metrics Summary */}
        <MetricsBar
          candidates={candidates}
          onSelectFilter={(f) => {
            setMetricsFilter(f);
            if (f === 'scheduled') setActiveTab('schedule');
            else if (f === 'followups') setActiveTab('followups');
            else setActiveTab('roster');
          }}
          activeFilter={metricsFilter}
        />

        {/* Tab Navigation & Search Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              id="tab-roster"
              onClick={() => {
                setActiveTab('roster');
                setMetricsFilter('all');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
                activeTab === 'roster'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Candidate Roster & Screening ({candidates.length})</span>
            </button>

            <button
              id="tab-schedule"
              onClick={() => setActiveTab('schedule')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
                activeTab === 'schedule'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Interview Schedules & Slots</span>
            </button>

            <button
              id="tab-followups"
              onClick={() => setActiveTab('followups')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
                activeTab === 'followups'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pending Follow-ups Queue</span>
            </button>

            <button
              id="tab-transcripts"
              onClick={() => setActiveTab('transcripts')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
                activeTab === 'transcripts'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Voice Logs & Transcripts</span>
            </button>

            <button
              id="tab-automation"
              onClick={() => setActiveTab('automation')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
                activeTab === 'automation'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${activeTab === 'automation' ? 'text-slate-950 animate-pulse' : 'text-amber-400 animate-pulse'}`} />
              <span>AI Calling Queue (Dry Run)</span>
            </button>
          </div>

          {/* Search & Status Filters */}
          {activeTab === 'roster' && (
            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, role, company..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <select
                id="filter-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-hidden focus:border-amber-500"
              >
                <option value="all">All Statuses</option>
                <option value="Screening Pending">Screening Pending</option>
                <option value="Screened - Ready for Interview">Screened</option>
                <option value="Interview Scheduled">Interview Scheduled</option>
                <option value="Attendance Confirmed">Attendance Confirmed</option>
                <option value="Missed Interview - Followup">Missed Interview</option>
                <option value="Callback Needed">Callback Needed</option>
                <option value="Declined - Do Not Call">Declined</option>
              </select>

              <select
                id="filter-priority"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-hidden focus:border-amber-500"
              >
                <option value="all">All Priorities</option>
                <option value="high">🔴 High Priority (Missed)</option>
                <option value="upcoming">🟡 Upcoming Slots (Amber)</option>
                <option value="callback">🟣 Callback Due</option>
              </select>
            </div>
          )}
        </div>

        {/* TAB 1: CANDIDATE ROSTER & SCREENING */}
        {activeTab === 'roster' && (
          <div className="space-y-4">
            {/* Day-by-Day Status Alert Bar */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 via-[#0d1629] to-slate-900 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <span>Day-by-Day Candidate Status Alerts</span>
                    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700">
                      CRM Priority Engine
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Live tracking by action due date: Overdue follow-ups, Today's callbacks, Tomorrow's F2F interviews & 90-Day Pipeline.
                  </p>
                </div>
              </div>

              {/* Day Alert Filter Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setDayAlertFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                    dayAlertFilter === 'all'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/60'
                  }`}
                >
                  <span>All Leads</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 font-bold">
                    {candidates.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDayAlertFilter('overdue')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                    dayAlertFilter === 'overdue'
                      ? 'bg-rose-500 text-white font-bold shadow-xs shadow-rose-950'
                      : 'bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/30'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping inline-block" />
                  <span>🚨 Overdue</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-900/50 font-bold">
                    {overdueCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDayAlertFilter('today')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                    dayAlertFilter === 'today'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                      : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30'
                  }`}
                >
                  <span>📅 Today</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-900/40 text-amber-200 font-bold">
                    {todayCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDayAlertFilter('tomorrow')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                    dayAlertFilter === 'tomorrow'
                      ? 'bg-blue-500 text-white font-bold shadow-xs'
                      : 'bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 border border-blue-500/30'
                  }`}
                >
                  <span>⏰ Tomorrow</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-900/50 font-bold">
                    {tomorrowCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDayAlertFilter('pipeline')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                    dayAlertFilter === 'pipeline'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                      : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30'
                  }`}
                >
                  <span>🌱 Pipeline (Joined Other Co)</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-900/50 font-bold">
                    {pipelineCount}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 gap-2 mb-1">
              <span>Showing {filteredCandidates.length} candidate profiles {dayAlertFilter !== 'all' && `(Filtered: ${dayAlertFilter.toUpperCase()})`}</span>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 text-[11px] text-rose-300">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
                  Red = Missed Interview
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-300">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  Amber = Upcoming Slot
                </span>
                <span className="text-amber-400/90 hidden md:inline">Tap card or 'Screening Call' to launch Voice Agent</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCandidates.map((cand) => {
                const s = cand.screening || {};
                const hasREExp = s.realEstateExperienceYears !== undefined;
                const hasSalary = s.currentSalaryLPA || s.expectedSalaryLPA;
                const isConfirmed = cand.status === 'Attendance Confirmed';
                const isScheduled = cand.status === 'Interview Scheduled';
                const priority = getCandidatePriority(cand);

                return (
                  <div
                    key={cand.id}
                    id={`candidate-card-${cand.id}`}
                    onClick={() => setSelectedCandidate(cand)}
                    className={`p-5 rounded-2xl bg-[#0f172a] transition shadow-lg flex flex-col justify-between cursor-pointer group ${priority.cardHighlight}`}
                  >
                    <div>
                      {/* Priority Header Row */}
                      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800/80">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Priority:</span>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border flex items-center gap-1 ${priority.badgeClass}`}>
                            <priority.icon className={`w-3 h-3 ${priority.iconColor} ${priority.pulse ? 'animate-pulse' : ''}`} />
                            <span>{priority.label}</span>
                          </span>
                        </div>
                        <span className={`px-2.5 py-0.5 text-[10px] font-semibold rounded-full border whitespace-nowrap ${getStatusBadge(cand.status)}`}>
                          {cand.status}
                        </span>
                      </div>

                      {/* Top Row: Avatar & Role */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-700/20 border border-amber-500/30 flex items-center justify-center font-bold text-amber-400 text-sm group-hover:scale-105 transition">
                            {cand.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition">
                              {cand.name}
                            </h3>
                            <p className="text-xs text-amber-400/90 font-medium">
                              {cand.appliedRole}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Middle Details: Company, RE Exp, Location */}
                      <div className="space-y-1.5 text-xs text-slate-300 my-3.5 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                        <div className="flex items-center justify-between text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-amber-400" />
                            <span>Current Company:</span>
                          </span>
                          <span className="font-semibold text-white">
                            {s.currentCompany || 'Not captured yet'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                            <span>Real Estate Experience:</span>
                          </span>
                          <span className="font-semibold text-white">
                            {s.realEstateExperienceYears 
                              ? `${s.realEstateExperienceYears} Yrs` 
                              : 'Pending'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-amber-400" />
                            <span>Location:</span>
                          </span>
                          <span className="font-semibold text-slate-200">
                            {s.currentLocation || 'NCR'}
                          </span>
                        </div>

                        {/* Gurgaon/Dubai tag */}
                        {(s.gurgaonDubaiExperience?.gurgaon || s.gurgaonDubaiExperience?.dubai) && (
                          <div className="pt-1.5 flex items-center gap-1.5">
                            {s.gurgaonDubaiExperience?.gurgaon && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Gurgaon Luxury Exp
                              </span>
                            )}
                            {s.gurgaonDubaiExperience?.dubai && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Dubai Property Exp
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Scheduled Slot if present */}
                      {cand.interviewTime && (
                        <div className="mb-3 p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/20 text-xs">
                          <div className="flex items-center justify-between font-bold text-amber-300 text-[11px]">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3 h-3" />
                              <span>F2F Interview</span>
                            </span>
                            <span>{cand.interviewStatus}</span>
                          </div>
                          <div className="text-[11px] text-slate-300 mt-0.5">
                            {cand.interviewDate} • {cand.interviewTime}
                          </div>
                        </div>
                      )}

                      {/* Autonomous AI Priority Remark & Day-by-Day Alert Box */}
                      {cand.latestRemark && (
                        <div className="mb-3 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/90 text-xs">
                          <div className="flex items-center justify-between gap-1 text-[10px] mb-1">
                            <span className="font-bold text-amber-400 flex items-center gap-1 truncate">
                              <Bell className="w-3 h-3 text-amber-400 shrink-0" />
                              <span className="truncate">{cand.latestRemark.category}</span>
                            </span>
                            {cand.alertDueDate && (
                              <span className={`px-1.5 py-0.5 rounded font-extrabold uppercase text-[9px] border shrink-0 whitespace-nowrap ${
                                cand.alertDueDate === 'Overdue'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : cand.alertDueDate === 'Today'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : cand.alertDueDate === 'Tomorrow'
                                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              }`}>
                                Due: {cand.alertDueDate}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                            {cand.latestRemark.text}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Bar */}
                    <div 
                      className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-1.5 flex-wrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => setSelectedCandidate(cand)}
                        className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                      >
                        <span>Profile</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-1.5">
                        {/* Send Confirmation Mail button */}
                        {(cand.interviewSlotId || cand.status === 'Interview Scheduled' || cand.status === 'Attendance Confirmed') && (
                          <button
                            type="button"
                            onClick={() => setConfirmationMailCandidate(cand)}
                            className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs flex items-center gap-1 transition"
                            title="Send interview confirmation email with Sector 67 venue details"
                          >
                            <Mail className="w-3.5 h-3.5 text-amber-400" />
                            <span className="hidden xl:inline text-[11px] font-medium">Mail</span>
                          </button>
                        )}

                        {/* Send WhatsApp button */}
                        <button
                          type="button"
                          onClick={() => setWhatsAppCandidate({
                            candidate: cand,
                            template: cand.status === 'Missed Interview - Followup' 
                              ? 'missed_followup' 
                              : cand.interviewSlotId 
                              ? 'interview_reminder' 
                              : 'unanswered',
                          })}
                          className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs flex items-center gap-1 transition"
                          title="Send WhatsApp message (interview reminder or missed call follow-up)"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="hidden xl:inline text-[11px] font-medium">WhatsApp</span>
                        </button>

                        {/* Schedule AI Call button */}
                        <button
                          type="button"
                          id={`btn-schedule-call-${cand.id}`}
                          onClick={() => setScheduleCallCandidate(cand)}
                          className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition ${
                            cand.scheduledCall?.status === 'pending'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-slate-800 hover:bg-slate-700 text-amber-400/90 border-slate-700'
                          }`}
                          title="Schedule automated AI follow-up call with date and time picker"
                        >
                          <Calendar className="w-3.5 h-3.5 text-amber-400" />
                          <span className="hidden xl:inline text-[11px] font-medium">
                            {cand.scheduledCall?.status === 'pending' ? cand.scheduledCall.time : 'Schedule'}
                          </span>
                        </button>

                        <button
                          id={`btn-call-${cand.id}`}
                          onClick={() => {
                            const scenario = cand.status === 'Missed Interview - Followup' 
                              ? 'missed_followup' 
                              : cand.status === 'Callback Needed' 
                              ? 'callback_followup'
                              : cand.interviewSlotId 
                              ? 'reminder' 
                              : 'screening';
                            handleStartCall(cand, scenario);
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 px-2.5 py-1.5 rounded-lg transition shadow-md shadow-amber-500/20"
                        >
                          <PhoneCall className="w-3 h-3" />
                          <span>
                            {cand.interviewSlotId ? 'Reconfirm' : 'Call'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: INTERVIEW SCHEDULE & SLOTS */}
        {activeTab === 'schedule' && (
          <InterviewScheduleTab
            slots={interviewSlots}
            candidates={candidates}
            onTriggerCall={(cand, scenario) => handleStartCall(cand, scenario)}
            onCancelBooking={handleCancelSlotBooking}
            onRescheduleClick={handleRescheduleClick}
            onOpenConfirmationMail={(cand) => setConfirmationMailCandidate(cand)}
            onOpenWhatsApp={(cand, template) => setWhatsAppCandidate({ candidate: cand, template })}
          />
        )}

        {/* TAB 3: PENDING FOLLOW-UPS QUEUE */}
        {activeTab === 'followups' && (
          <FollowupQueueTab
            candidates={candidates}
            onTriggerCall={(cand, scenario) => handleStartCall(cand, scenario)}
            onSelectCandidate={(cand) => setSelectedCandidate(cand)}
            onOpenWhatsApp={(cand, template) => setWhatsAppCandidate({ candidate: cand, template })}
            onOpenScheduleCall={(cand) => setScheduleCallCandidate(cand)}
          />
        )}

        {/* TAB 4: VOICE LOGS & TRANSCRIPTS */}
        {activeTab === 'transcripts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-semibold text-slate-300">
                Audit Trail: All Completed HR Voice Conversations
              </span>
              <span className="text-amber-400">Powered by Gemini AI Recruiter</span>
            </div>

            {candidates.every((c) => c.callHistory.length === 0) ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 text-sm">
                No voice calls recorded yet. Click "Start Voice Screening" to test the AI agent.
              </div>
            ) : (
              <div className="space-y-4">
                {candidates
                  .flatMap((c) => c.callHistory)
                  .map((call) => (
                    <div
                      key={call.id}
                      className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 hover:border-slate-700 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-xs">
                            HR
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white">
                              {call.candidateName} • <span className="text-amber-400 uppercase text-xs">{call.scenario} Call</span>
                            </h4>
                            <p className="text-[11px] text-slate-400 font-mono">
                              {call.timestamp} • Duration: {Math.floor(call.durationSeconds / 60)}m {call.durationSeconds % 60}s
                            </p>
                          </div>
                        </div>

                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 self-start sm:self-auto">
                          Outcome: {call.outcome}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300 leading-relaxed mb-4">
                        <strong className="text-amber-400">Executive Call Summary: </strong>
                        {call.summary}
                      </div>

                      {/* Transcript Accordion */}
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {call.transcript.map((msg) => (
                          <div
                            key={msg.id}
                            className={`p-2 rounded-lg text-xs ${
                              msg.sender === 'agent'
                                ? 'bg-amber-950/20 text-amber-200 border border-amber-500/20'
                                : 'bg-slate-800 text-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold mb-0.5">
                              <span>{msg.sender === 'agent' ? 'Arjun (White Collar HR)' : call.candidateName}</span>
                              <span>{msg.timestamp}</span>
                            </div>
                            <div>{msg.text}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: AUTOMATED AI HR CALLING QUEUE (DRY RUN) */}
        {activeTab === 'automation' && (
          <AutomationQueueTab
            candidates={candidates}
            onSelectCandidate={(cand) => setSelectedCandidate(cand)}
          />
        )}
      </main>

      {/* MODAL: LIVE VAPI VOICE ASSISTANT MODAL */}
      {showVapiModal && (
        <VapiCallModal
          isOpen={showVapiModal}
          candidate={vapiCandidate}
          assistantId={DEFAULT_VAPI_ASSISTANT_ID}
          onClose={() => setShowVapiModal(false)}
          onCallEnded={(updatedCandidate) => {
            setCandidates((prev) =>
              prev.map((c) => (c.id === updatedCandidate.id ? updatedCandidate : c))
            );
            if (selectedCandidate?.id === updatedCandidate.id) {
              setSelectedCandidate(updatedCandidate);
            }
          }}
          onSwitchToInteractive={(cand) => {
            setShowVapiModal(false);
            handleStartCall(cand, 'screening');
          }}
        />
      )}

      {/* MODAL 1: LIVE VOICE CALL MODAL */}
      {activeCallCandidate && (
        <VoiceCallModal
          candidate={activeCallCandidate}
          scenario={activeCallScenario}
          availableSlots={interviewSlots}
          onClose={() => setActiveCallCandidate(null)}
          onCallEnded={handleCallEnded}
          onOpenConfirmationMail={(cand) => setConfirmationMailCandidate(cand)}
          onOpenWhatsApp={(cand, template) => setWhatsAppCandidate({ candidate: cand, template })}
        />
      )}

      {/* MODAL 2: CANDIDATE DETAIL DRAWER */}
      {selectedCandidate && (
        <CandidateDrawer
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          onStartCall={(cand, scenario) => handleStartCall(cand, scenario || 'screening')}
          onStartVapiCall={(cand) => handleStartVapiCall(cand)}
          onOpenConfirmationMail={(cand) => setConfirmationMailCandidate(cand)}
          onOpenWhatsApp={(cand, template) => setWhatsAppCandidate({ candidate: cand, template })}
          onOpenScheduleCall={(cand) => setScheduleCallCandidate(cand)}
          onUpdateCandidate={(updated) => {
            setSelectedCandidate(updated);
            setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          }}
        />
      )}

      {/* MODAL 3: NEW DUMMY CANDIDATE MODAL */}
      {showNewCandidateModal && (
        <NewCandidateModal
          onClose={() => setShowNewCandidateModal(false)}
          onAddCandidate={handleAddCandidate}
        />
      )}

      {/* MODAL 4: INTERVIEW CONFIRMATION EMAIL MODAL */}
      {confirmationMailCandidate && (
        <ConfirmationEmailModal
          candidate={confirmationMailCandidate}
          isOpen={Boolean(confirmationMailCandidate)}
          onClose={() => setConfirmationMailCandidate(null)}
          onEmailSent={handleEmailSent}
        />
      )}

      {/* MODAL 5: WHATSAPP REMINDER OUTREACH MODAL */}
      {whatsAppCandidate && (
        <WhatsAppReminderModal
          candidate={whatsAppCandidate.candidate}
          isOpen={Boolean(whatsAppCandidate)}
          defaultTemplate={whatsAppCandidate.template}
          onClose={() => setWhatsAppCandidate(null)}
          onWhatsAppSent={handleWhatsAppSent}
        />
      )}

      {/* MODAL 6: AI HR BRAIN COMMAND & LEARNING CENTER */}
      {showBrainModal && (
        <AiHrBrainModal
          isOpen={showBrainModal}
          onClose={() => setShowBrainModal(false)}
          candidates={candidates}
          onSelectCandidateForCall={(cand) => {
            setShowBrainModal(false);
            handleStartCall(cand, 'screening');
          }}
        />
      )}

      {/* MODAL 7: SCHEDULE AI FOLLOW-UP CALL MODAL */}
      {scheduleCallCandidate && (
        <ScheduleCallModal
          candidate={scheduleCallCandidate}
          onClose={() => setScheduleCallCandidate(null)}
          onSaveSchedule={handleSaveSchedule}
          onCancelSchedule={handleCancelSchedule}
        />
      )}
    </div>
  );
}
