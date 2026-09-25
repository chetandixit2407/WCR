import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Square,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Clock,
  CheckCircle2,
  PhoneCall,
  PhoneOff,
  PhoneForwarded,
  Sliders,
  Users,
  Calendar,
  X,
  Radio,
  Zap,
} from 'lucide-react';
import { Candidate } from '../types';

export interface AutomationQueueTabProps {
  candidates: Candidate[];
  onSelectCandidate: (candidate: Candidate) => void;
}

export const AutomationQueueTab: React.FC<AutomationQueueTabProps> = ({
  candidates,
  onSelectCandidate,
}) => {
  const [status, setStatus] = useState<'OFF' | 'RUNNING' | 'PAUSED'>('OFF');
  const [mode, setMode] = useState<'DRY_RUN' | 'LIVE'>('DRY_RUN');
  const [queue, setQueue] = useState<any[]>([]);
  const [dailyStats, setDailyStats] = useState<any>({
    date: new Date().toISOString().split('T')[0],
    target: 200,
    attempted: 0,
    completed: 0,
    failed: 0,
    noAnswer: 0,
    busy: 0,
    callbacks: 0,
    qualified: 0,
    notQualified: 0,
    interviewsScheduled: 0,
  });
  const [settings, setSettings] = useState<any>({
    enabled: false,
    automationMode: 'DRY_RUN',
    dailyTarget: 200,
    maxConcurrentCalls: 5,
    callingWindowStart: '10:00',
    callingWindowEnd: '19:00',
    timezone: 'Asia/Kolkata',
    allowedDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
    maxRetries: 3,
    retryBackoffMinutes: 45,
  });
  const [activeCallsCount, setActiveCallsCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [dryTestResults, setDryTestResults] = useState<any[] | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const fetchAutomationStatus = async () => {
    try {
      const res = await fetch('/api/automation/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
        setMode(data.mode);
        setActiveCallsCount(data.activeCallsCount);
        if (data.dailyStats) setDailyStats(data.dailyStats);
        if (data.settings) setSettings(data.settings);
      }

      const qRes = await fetch('/api/automation/queue');
      if (qRes.ok) {
        const qData = await qRes.json();
        setQueue(qData);
      }
    } catch (e) {
      console.warn('Failed to fetch automation status:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAutomationStatus();
    const interval = setInterval(fetchAutomationStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    setActionLoading(true);
    setFeedbackMessage(null);
    try {
      const res = await fetch('/api/automation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceEnable: true }),
      });
      const data = await res.json();
      setFeedbackMessage(data.message || 'Automation started in DRY RUN mode.');
      await fetchAutomationStatus();
    } catch (e: any) {
      setFeedbackMessage(`Error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/automation/pause', { method: 'POST' });
      const data = await res.json();
      setFeedbackMessage(data.message || 'Automation paused.');
      await fetchAutomationStatus();
    } catch (e: any) {
      setFeedbackMessage(`Error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/automation/stop', { method: 'POST' });
      const data = await res.json();
      setFeedbackMessage(data.message || 'Automation stopped.');
      await fetchAutomationStatus();
    } catch (e: any) {
      setFeedbackMessage(`Error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePopulateQueue = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/automation/populate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ignoreTimeWindow: true }),
      });
      const data = await res.json();
      setFeedbackMessage(`Queued ${data.added} candidates (${data.totalEligible} eligible out of ${data.totalCandidates} total).`);
      await fetchAutomationStatus();
    } catch (e: any) {
      setFeedbackMessage(`Error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunDryTest = async () => {
    setActionLoading(true);
    setDryTestResults(null);
    setFeedbackMessage('Running dry test simulation on 5 eligible candidates...');
    try {
      const res = await fetch('/api/automation/run-dry-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 5 }),
      });
      const data = await res.json();
      setDryTestResults(data.results);
      setFeedbackMessage(`Dry test finished: processed ${data.processedCount} simulated calls with 0 real PSTN calls.`);
      await fetchAutomationStatus();
    } catch (e: any) {
      setFeedbackMessage(`Error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch('/api/automation/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      setSettings(data);
      setIsSettingsOpen(false);
      setFeedbackMessage('Automation settings saved to Firestore.');
    } catch (err: any) {
      setFeedbackMessage(`Error saving settings: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const progressPercent = Math.min(
    100,
    Math.round(((dailyStats.attempted || 0) / (settings.dailyTarget || 200)) * 100)
  );

  return (
    <div className="space-y-6">
      {/* Prominent Dry Run Safety Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-600/10 to-transparent border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white uppercase tracking-wider">
                Automated Calling Queue
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 tracking-wide">
                DRY RUN MODE (SIMULATION)
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Simulates candidate selection, calling locks, AI brain screening & post-call pipelines. 
              <strong className="text-amber-400 font-semibold ml-1">Zero real PSTN/Vapi calls are dispatched.</strong>
            </p>
          </div>
        </div>

        {/* Real-time Status Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs">
            <span className="text-slate-400">Status:</span>
            <span
              className={`font-bold flex items-center gap-1.5 ${
                status === 'RUNNING'
                  ? 'text-emerald-400'
                  : status === 'PAUSED'
                  ? 'text-amber-400'
                  : 'text-slate-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  status === 'RUNNING'
                    ? 'bg-emerald-400 animate-ping'
                    : status === 'PAUSED'
                    ? 'bg-amber-400'
                    : 'bg-slate-500'
                }`}
              />
              {status}
            </span>
          </div>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-amber-500/40 transition"
            title="Configure Calling Window, Daily Target & Concurrency"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Control Action Toolbar */}
      <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2 flex-wrap">
          {status !== 'RUNNING' ? (
            <button
              id="btn-start-dry-run"
              onClick={handleStart}
              disabled={actionLoading}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>START DRY RUN</span>
            </button>
          ) : (
            <button
              onClick={handlePause}
              disabled={actionLoading}
              className="flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold px-4 py-2 rounded-xl text-xs transition"
            >
              <Pause className="w-4 h-4" />
              <span>PAUSE</span>
            </button>
          )}

          {status !== 'OFF' && (
            <button
              onClick={handleStop}
              disabled={actionLoading}
              className="flex items-center gap-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-semibold px-3.5 py-2 rounded-xl text-xs transition"
            >
              <Square className="w-3.5 h-3.5 fill-rose-300" />
              <span>STOP</span>
            </button>
          )}

          <button
            id="btn-populate-queue"
            onClick={handlePopulateQueue}
            disabled={actionLoading}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition"
          >
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span>Populate Eligible Queue</span>
          </button>

          <button
            id="btn-run-dry-test"
            onClick={handleRunDryTest}
            disabled={actionLoading}
            className="flex items-center gap-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs"
          >
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            <span>Run Dry Test (5 Candidates)</span>
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Concurrency: <strong>{activeCallsCount} / {settings.maxConcurrentCalls} active</strong></span>
          </span>
          <button
            onClick={fetchAutomationStatus}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {feedbackMessage && (
        <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/30 text-xs text-amber-300 flex items-center justify-between">
          <span>{feedbackMessage}</span>
          <button onClick={() => setFeedbackMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Dry Test Execution Results Banner */}
      {dryTestResults && (
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-indigo-500/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Dry Test Execution Summary ({dryTestResults.length} Simulated Calls)
              </h4>
            </div>
            <button
              onClick={() => setDryTestResults(null)}
              className="text-slate-400 hover:text-white text-xs"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {dryTestResults.map((r, i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                <div className="font-bold text-white flex items-center justify-between">
                  <span>{r.candidateName}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {r.priority} Priority
                  </span>
                </div>
                <div className="mt-1.5 text-slate-300 flex items-center justify-between text-[11px]">
                  <span>Outcome: <strong className="text-amber-400">{r.outcome}</strong></span>
                  <span className="text-emerald-400 font-semibold">{r.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Target Progress & Concurrency Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Daily Target Progress */}
        <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-semibold uppercase tracking-wider">Daily Call Target (Asia/Kolkata)</span>
              <span className="text-amber-400 font-bold">{dailyStats.attempted} / {settings.dailyTarget}</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Remaining Capacity: {Math.max(0, settings.dailyTarget - dailyStats.attempted)} calls</span>
            <span>Calling Hours: {settings.callingWindowStart} - {settings.callingWindowEnd} IST</span>
          </div>
        </div>

        {/* Real-time Call Concurrency */}
        <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-semibold uppercase tracking-wider">Active Concurrency Lock</span>
              <span className="text-emerald-400 font-bold">{activeCallsCount} / {settings.maxConcurrentCalls} Max</span>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: settings.maxConcurrentCalls }).map((_, idx) => (
                <div
                  key={idx}
                  className={`flex-1 h-3 rounded-md transition ${
                    idx < activeCallsCount
                      ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse'
                      : 'bg-slate-800'
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Protected by Firestore Transactions</span>
            <span className="text-emerald-400">Atomic Lock Active</span>
          </div>
        </div>

        {/* Summary Counter */}
        <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 flex flex-col justify-between">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase">Queued</div>
              <div className="text-lg font-bold text-white mt-0.5">{queue.length}</div>
            </div>
            <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase">Screened</div>
              <div className="text-lg font-bold text-emerald-400 mt-0.5">{dailyStats.completed}</div>
            </div>
            <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase">Scheduled</div>
              <div className="text-lg font-bold text-amber-400 mt-0.5">{dailyStats.interviewsScheduled}</div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Callbacks: {dailyStats.callbacks}</span>
            <span>No Answer/Busy: {dailyStats.noAnswer + dailyStats.busy}</span>
          </div>
        </div>
      </div>

      {/* Queue Table */}
      <div className="rounded-2xl bg-[#0f172a] border border-slate-800 overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Automated Calling Queue ({queue.length} Candidates Pending)
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Prioritized by Real Estate Experience & Market Fit
          </span>
        </div>

        {queue.length === 0 ? (
          <div className="p-10 text-center text-slate-400 space-y-3">
            <Clock className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm">Queue is currently empty.</p>
            <button
              onClick={handlePopulateQueue}
              className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition"
            >
              Populate Eligible Candidates
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Candidate</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Attempt</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Scheduled</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {queue.map((job) => {
                  const targetCand = candidates.find((c) => c.id === job.candidateId);
                  return (
                    <tr key={job.jobId} className="hover:bg-slate-900/50 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">{job.candidateName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{job.phone || 'Phone verified'}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">{job.appliedRole}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            job.priority === 'HIGH'
                              ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                              : job.priority === 'MEDIUM'
                              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {job.priority} ({job.priorityScore} pts)
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono">
                        #{job.attemptNumber || 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            job.status === 'CALLING'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                              : job.status === 'COMPLETED'
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                              : job.status === 'RETRY_SCHEDULED'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-slate-400">
                        {new Date(job.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {targetCand && (
                          <button
                            onClick={() => onSelectCandidate(targetCand)}
                            className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Automation Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Calling Queue Settings
                </h3>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Daily Call Target
                  </label>
                  <input
                    type="number"
                    value={settings.dailyTarget}
                    onChange={(e) =>
                      setSettings({ ...settings, dailyTarget: parseInt(e.target.value, 10) || 200 })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Max Concurrent Calls
                  </label>
                  <input
                    type="number"
                    value={settings.maxConcurrentCalls}
                    max={10}
                    min={1}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        maxConcurrentCalls: parseInt(e.target.value, 10) || 5,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Calling Window Start (IST)
                  </label>
                  <input
                    type="time"
                    value={settings.callingWindowStart}
                    onChange={(e) =>
                      setSettings({ ...settings, callingWindowStart: e.target.value })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Calling Window End (IST)
                  </label>
                  <input
                    type="time"
                    value={settings.callingWindowEnd}
                    onChange={(e) =>
                      setSettings({ ...settings, callingWindowEnd: e.target.value })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Max Retry Attempts
                  </label>
                  <input
                    type="number"
                    value={settings.maxRetries}
                    onChange={(e) =>
                      setSettings({ ...settings, maxRetries: parseInt(e.target.value, 10) || 3 })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Retry Backoff (Minutes)
                  </label>
                  <input
                    type="number"
                    value={settings.retryBackoffMinutes}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        retryBackoffMinutes: parseInt(e.target.value, 10) || 45,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
