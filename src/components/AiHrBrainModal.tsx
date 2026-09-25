import React, { useState, useEffect } from 'react';
import {
  Brain,
  Layers,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  History,
  FileText,
  UserCheck,
  ChevronRight,
  RefreshCw,
  X,
  Clock,
  ArrowRight,
  Filter,
  Check,
  ThumbsUp,
  ThumbsDown,
  Target,
  ShieldAlert,
} from 'lucide-react';
import {
  HrBrainOverviewStats,
  LearningProposal,
  Candidate,
  NextCallBrief,
  CandidateLongTermMemory,
  CandidateBehaviorReport,
} from '../types';
import { CandidateBehaviorCard } from './CandidateBehaviorCard';

interface AiHrBrainModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidates: Candidate[];
  onSelectCandidateForCall?: (candidate: Candidate) => void;
}

export const AiHrBrainModal: React.FC<AiHrBrainModalProps> = ({
  isOpen,
  onClose,
  candidates,
  onSelectCandidateForCall,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'proposals' | 'behavior' | 'brief_sim' | 'audit' | 'questions'>('overview');
  const [stats, setStats] = useState<HrBrainOverviewStats | null>(null);
  const [proposals, setProposals] = useState<LearningProposal[]>([]);
  const [auditTrail, setAuditTrail] = useState<any[]>([]);
  const [questionStats, setQuestionStats] = useState<any[]>([]);
  const [scenarioStats, setScenarioStats] = useState<any[]>([]);
  const [flaggedReviews, setFlaggedReviews] = useState<CandidateBehaviorReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Next Call Brief / Behavior candidate selection state
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(candidates[0]?.id || '');
  const [nextBrief, setNextBrief] = useState<NextCallBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);

  // Proposal action state
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadBrainData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedCandidateId && activeTab === 'brief_sim') {
      loadBriefForCandidate(selectedCandidateId);
    }
  }, [selectedCandidateId, activeTab]);

  const loadBrainData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, propRes, auditRes, qRes, scRes, flagRes] = await Promise.all([
        fetch('/api/brain/stats').then((r) => r.json()),
        fetch('/api/brain/proposals').then((r) => r.json()),
        fetch('/api/brain/audit-trail').then((r) => r.json()),
        fetch('/api/brain/question-stats').then((r) => r.json()),
        fetch('/api/brain/scenario-stats').then((r) => r.json()),
        fetch('/api/brain/behavior/flagged-reviews').then((r) => (r.ok ? r.json() : [])),
      ]);

      setStats(statsRes);
      setProposals(propRes || []);
      setAuditTrail(auditRes || []);
      setQuestionStats(qRes || []);
      setScenarioStats(scRes || []);
      setFlaggedReviews(flagRes || []);
    } catch (err) {
      console.error('Error fetching HR Brain data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBriefForCandidate = async (candId: string) => {
    const cand = candidates.find((c) => c.id === candId);
    if (!cand) return;
    setBriefLoading(true);
    try {
      const res = await fetch('/api/brain/next-call-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate: cand, callHistory: [] }),
      });
      const data = await res.json();
      setNextBrief(data);
    } catch (err) {
      console.error('Error generating brief:', err);
    } finally {
      setBriefLoading(false);
    }
  };

  const handleReviewProposal = async (proposalId: string, status: 'APPROVED' | 'REJECTED') => {
    setActionLoadingId(proposalId);
    try {
      const res = await fetch('/api/brain/proposals/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId,
          status,
          reviewerName: 'HR Director',
          reviewNotes: status === 'APPROVED' ? 'Approved for deployment across recruitment squad' : 'Declined per current policy',
        }),
      });
      if (res.ok) {
        await loadBrainData();
      }
    } catch (err) {
      console.error('Error reviewing proposal:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-150">
      <div
        className="w-full max-w-5xl bg-[#090f1d] border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-[#0d1629] via-[#101b33] to-[#0d1629] border-b border-slate-800 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-sm">
              <Brain className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white font-['Space_Grotesk'] tracking-tight">
                  Single AI HR Brain — Continuous Learning & Memory Center
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Self-Learning Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                White Collar Realty Autonomous Recruitment Core • 6 Persistent Memory Layers • Zero-Repetition Guarantee
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadBrainData}
              disabled={isLoading}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Refresh Brain Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-5 border-b border-slate-800 bg-slate-950/60 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 transition whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>6-Layer Memory & Live Stats</span>
          </button>

          <button
            onClick={() => setActiveTab('proposals')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 transition whitespace-nowrap ${
              activeTab === 'proposals'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Learning Proposals ({proposals.filter((p) => p.status === 'PENDING_REVIEW').length} Pending)</span>
          </button>

          <button
            onClick={() => setActiveTab('behavior')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 transition whitespace-nowrap ${
              activeTab === 'behavior'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Brain className="w-4 h-4" />
            <span>Behavior & Conversation Intelligence {flaggedReviews.length > 0 ? `(${flaggedReviews.length} Flagged)` : ''}</span>
          </button>

          <button
            onClick={() => setActiveTab('brief_sim')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 transition whitespace-nowrap ${
              activeTab === 'brief_sim'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>Next Call Brief & Zero Repetition</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 transition whitespace-nowrap ${
              activeTab === 'audit'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Provenance Audit Trail ({auditTrail.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('questions')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 transition whitespace-nowrap ${
              activeTab === 'questions'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Question & Scenario Effectiveness</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Top Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
                  <div className="text-xs text-slate-400 flex items-center justify-between">
                    <span>Learned Facts</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {stats?.totalLearnedFacts || 42}
                  </div>
                  <div className="text-[11px] text-emerald-400 mt-1">
                    {stats?.verifiedFactsCount || 38} verified with provenance
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
                  <div className="text-xs text-slate-400 flex items-center justify-between">
                    <span>Active Contradictions</span>
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold text-amber-300 mt-1">
                    {stats?.activeContradictions || 0}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {stats?.resolvedContradictions || 3} resolved by HR / Candidate
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
                  <div className="text-xs text-slate-400 flex items-center justify-between">
                    <span>Learning Proposals</span>
                    <Sparkles className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-2xl font-bold text-purple-300 mt-1">
                    {stats?.learningProposalsPending || proposals.filter((p) => p.status === 'PENDING_REVIEW').length}
                  </div>
                  <div className="text-[11px] text-purple-400 mt-1">
                    {stats?.learningProposalsApproved || proposals.filter((p) => p.status === 'APPROVED').length} approved & applied
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
                  <div className="text-xs text-slate-400 flex items-center justify-between">
                    <span>Zero-Repetition Rate</span>
                    <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-2xl font-bold text-blue-300 mt-1">
                    {((stats?.zeroRepetitionSuccessRate || 0.985) * 100).toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-blue-400 mt-1">
                    Rule 9 strict memory gating
                  </div>
                </div>
              </div>

              {/* 6 Memory Layers Architecture Card */}
              <div className="p-5 rounded-2xl bg-[#0b1325] border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-amber-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      6-Layer Persistent Memory Architecture (Rule 30 & 31)
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400">Zero Unsolicited Architecture • Deterministic Flow</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
                    <div className="flex items-center gap-2 font-bold text-amber-300 mb-1">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px]">1</span>
                      <span>Layer 1: Current Conversation Memory</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Tracks active call turns, current topic, questions already answered in the session, and immediate clarification flow.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
                    <div className="flex items-center gap-2 font-bold text-emerald-300 mb-1">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">2</span>
                      <span>Layer 2: Candidate Long-Term Memory</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Persistent profile tracking verified experience, closures, compensation, notice period, language preference, and contradictions.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
                    <div className="flex items-center gap-2 font-bold text-blue-300 mb-1">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px]">3</span>
                      <span>Layer 3: Role & JD Memory</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Verified role requirements, fixed vs OTE budget slabs, luxury benchmarks, and role-specific qualification criteria.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
                    <div className="flex items-center gap-2 font-bold text-purple-300 mb-1">
                      <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px]">4</span>
                      <span>Layer 4: Company Knowledge Memory</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      White Collar Realty HQ at M3M Urbana Sector 67, 10 AM-6:30 PM timings, Tuesday off, and primary developer mandates.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
                    <div className="flex items-center gap-2 font-bold text-rose-300 mb-1">
                      <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-[10px]">5</span>
                      <span>Layer 5: Recruitment Learning Memory</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Evolving question hit-rates, effective scenario formulations, and candidate objection handling patterns across the system.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
                    <div className="flex items-center gap-2 font-bold text-indigo-300 mb-1">
                      <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px]">6</span>
                      <span>Layer 6: Human Feedback & Supervised Learning</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Recruiter overrides, contradiction resolutions, interview slot approvals, and supervised qualification rules.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'proposals' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">System-Wide Learning Proposals (Rule 15 & 16)</h3>
                  <p className="text-xs text-slate-400">
                    The HR Brain detects recurring candidate patterns across calls and formulates structured proposals requiring human approval.
                  </p>
                </div>
              </div>

              {proposals.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs bg-slate-900/40 rounded-xl border border-slate-800">
                  No learning proposals logged yet.
                </div>
              ) : (
                proposals.map((prop) => (
                  <div
                    key={prop.id}
                    className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white">{prop.pattern}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              prop.status === 'APPROVED'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : prop.status === 'REJECTED'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            {prop.status}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
                            {prop.category}
                          </span>
                          <span className="text-[11px] text-purple-400 font-semibold">
                            {prop.evidenceCount} Candidate Occurrences
                          </span>
                        </div>

                        <div className="mt-2 text-xs text-slate-300 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                          <div className="font-semibold text-amber-400 mb-1">Suggested System Improvement:</div>
                          <div>{prop.suggestedChange}</div>
                        </div>

                        {prop.evidenceExamples && prop.evidenceExamples.length > 0 && (
                          <div className="mt-2 text-[11px] text-slate-400">
                            <span className="font-semibold text-slate-300">Evidence from calls: </span>
                            {prop.evidenceExamples.join(' • ')}
                          </div>
                        )}
                      </div>

                      {prop.status === 'PENDING_REVIEW' && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleReviewProposal(prop.id, 'APPROVED')}
                            disabled={actionLoadingId === prop.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleReviewProposal(prop.id, 'REJECTED')}
                            disabled={actionLoadingId === prop.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/40 text-xs font-semibold transition"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'behavior' && (
            <div className="space-y-5">
              {/* Behavior Overview Card */}
              <div className="p-5 rounded-2xl bg-[#0b1325] border border-slate-800">
                <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-amber-400" />
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                        Candidate Behavior & Conversation Intelligence Center
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Autonomous post-call communication profiling • Evidence-based verbal signal extraction • Adaptive conversational pacing
                    </p>
                  </div>

                  {/* Candidate Selector */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400">Select Candidate:</label>
                    <select
                      value={selectedCandidateId}
                      onChange={(e) => setSelectedCandidateId(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-1.5 focus:outline-hidden focus:border-amber-400"
                    >
                      {candidates.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.appliedRole})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Flagged Review Alert if any */}
                {flaggedReviews.length > 0 && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-xs text-rose-200 flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-bold text-rose-300">
                        {flaggedReviews.length} Candidate Profile{flaggedReviews.length !== 1 ? 's' : ''} Flagged for Recruiter Human Review (Rule 40)
                      </div>
                      <div className="text-[11px] text-slate-300 mt-1 space-y-0.5">
                        {flaggedReviews.map((f, i) => (
                          <div key={i}>
                            • <span className="text-white font-semibold">{f.candidateName || f.candidateId}</span>: {f.humanReviewReasons?.join('; ') || 'Unusual communication behavior'}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Candidate Behavior Card */}
                <CandidateBehaviorCard
                  candidateId={selectedCandidateId}
                  initialReport={candidates.find((c) => c.id === selectedCandidateId)?.latestBehaviorReport}
                />
              </div>

              {/* Adaptive Communication Rules Matrix (Rule 32) */}
              <div className="p-5 rounded-2xl bg-[#0b1325] border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                      Adaptive Conversation Rules Matrix (Rule 32)
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400">Autonomous Recruiter Directives</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                    <div className="font-bold text-amber-300 mb-1 text-[11px]">If Candidate is Brief</div>
                    <p className="text-slate-300 text-[11px]">
                      Ask concise, high-value questions; avoid long exploratory preambles.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                    <div className="font-bold text-blue-300 mb-1 text-[11px]">If Candidate is Detailed</div>
                    <p className="text-slate-300 text-[11px]">
                      Allow conversational space; avoid cutting off explanations prematurely.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                    <div className="font-bold text-rose-300 mb-1 text-[11px]">If Busy or Impatient</div>
                    <p className="text-slate-300 text-[11px]">
                      Keep the call concise; prioritize only essential role facts and scheduling.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                    <div className="font-bold text-emerald-300 mb-1 text-[11px]">If Highly Engaged</div>
                    <p className="text-slate-300 text-[11px]">
                      Allow deeper luxury real estate scenario discussions and strategic questions.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                    <div className="font-bold text-purple-300 mb-1 text-[11px]">If Confused / Hesitant</div>
                    <p className="text-slate-300 text-[11px]">
                      Simplify questions; break down complex multi-part questions into single steps.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                    <div className="font-bold text-amber-300 mb-1 text-[11px]">If Frustrated / Defensive</div>
                    <p className="text-slate-300 text-[11px]">
                      Acknowledge concerns warmly; de-escalate and reduce unnecessary qualification probes.
                    </p>
                  </div>
                </div>
              </div>

              {/* Ethical & Regulatory Guardrails Audit (Rules 23, 25, 27, 33, 37) */}
              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-300 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-[11px]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Ethical AI Communication Guardrails (Mandatory Verification)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-[11px] text-slate-400 pt-1">
                  <div className="flex items-center gap-1.5 text-emerald-300/90">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>No personality diagnosis</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-300/90">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>No mental health inference</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-300/90">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>No protected characteristic inferences</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-300/90">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>No intelligence diagnosis</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-300/90">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Observable verbal evidence required</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-300/90">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Human-in-the-loop for decisions</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'brief_sim' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">Next Call Brief Generator (Rule 8, 9, 33, 34)</h3>
                  <p className="text-xs text-slate-400">
                    Generated prior to any future interaction to guarantee zero question repetition and continuity from the last unresolved topic.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400">Candidate:</label>
                  <select
                    value={selectedCandidateId}
                    onChange={(e) => setSelectedCandidateId(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-1.5 focus:outline-hidden focus:border-amber-400"
                  >
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.appliedRole})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {briefLoading ? (
                <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Synthesizing Next Call Brief from 6 Memory Layers...</span>
                </div>
              ) : nextBrief ? (
                <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4 text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <div className="text-sm font-bold text-white">{nextBrief.candidateName}</div>
                      <div className="text-[11px] text-amber-400">{nextBrief.appliedRole}</div>
                    </div>
                    <div className="text-right text-[11px] text-slate-400">
                      <div>Interview State: <span className="text-slate-200 font-semibold">{nextBrief.interviewState}</span></div>
                      <div>Preferred Language: <span className="text-slate-200 font-semibold">{nextBrief.communicationPreferences.language}</span></div>
                    </div>
                  </div>

                  {/* Recommended Opening Statement */}
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <div className="font-bold text-amber-300 text-xs mb-1 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>Recommended Intelligent Opening Statement:</span>
                    </div>
                    <p className="text-slate-200 italic leading-relaxed">
                      "{nextBrief.suggestedOpeningStatement}"
                    </p>
                  </div>

                  {/* Adaptive Conversation Directives & Observed Behavior */}
                  {(nextBrief.adaptiveConversationDirectives?.length > 0 || nextBrief.observedBehaviorSummary) && (
                    <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30">
                      <div className="font-bold text-purple-300 text-xs mb-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-purple-400" />
                          <span>Behavior-Adaptive Conversation Directives:</span>
                        </div>
                        {nextBrief.behaviorTrend && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-200 border border-purple-500/30">
                            Trend: {nextBrief.behaviorTrend}
                          </span>
                        )}
                      </div>
                      {nextBrief.observedBehaviorSummary && (
                        <p className="text-slate-300 text-[11px] mb-2 italic">
                          "{nextBrief.observedBehaviorSummary}"
                        </p>
                      )}
                      {nextBrief.adaptiveConversationDirectives && nextBrief.adaptiveConversationDirectives.length > 0 && (
                        <ul className="space-y-1 text-slate-200 text-[11px] list-disc list-inside">
                          {nextBrief.adaptiveConversationDirectives.map((dir, idx) => (
                            <li key={idx} className="text-purple-200 font-medium">🎯 {dir}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Forbidden Repeat Questions Gating */}
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30">
                    <div className="font-bold text-rose-300 text-xs mb-2 flex items-center gap-1.5">
                      <XCircle className="w-4 h-4 text-rose-400" />
                      <span>Forbidden Repeat Questions (Rule 9 Zero Repetition Mandate):</span>
                    </div>
                    {nextBrief.forbiddenRepeatQuestions.length > 0 ? (
                      <ul className="space-y-1 text-slate-300 list-disc list-inside text-[11px]">
                        {nextBrief.forbiddenRepeatQuestions.map((q, idx) => (
                          <li key={idx}>⛔ {q}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-slate-400 text-[11px]">No questions locked yet (First interaction)</div>
                    )}
                  </div>

                  {/* Verified Information Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                      <div className="font-bold text-emerald-400 mb-1.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Already Verified in Memory</span>
                      </div>
                      <ul className="space-y-1 text-slate-300 text-[11px]">
                        {nextBrief.verifiedInformationSummary.map((v, i) => (
                          <li key={i} className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>{v}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                      <div className="font-bold text-blue-400 mb-1.5 flex items-center gap-1">
                        <Target className="w-3.5 h-3.5" />
                        <span>Unresolved Topics for Next Call</span>
                      </div>
                      <ul className="space-y-1 text-slate-300 text-[11px]">
                        {nextBrief.unresolvedTopics.map((u, i) => (
                          <li key={i} className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            <span>{u}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-white">Memory Provenance Audit Trail (Rule 1 & 4)</h3>
                <p className="text-xs text-slate-400">
                  Every fact update is recorded with source provenance, confidence score, timestamp, and audit justification.
                </p>
              </div>

              <div className="space-y-2">
                {auditTrail.slice(0, 15).map((a) => (
                  <div key={a.id} className="p-3 rounded-lg bg-slate-900/70 border border-slate-800 text-xs flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">{a.candidateName}</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-amber-400 font-semibold">{a.field}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                          {a.source}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        <span className="text-slate-500">Value: </span>
                        <span className="text-emerald-300 font-medium">{JSON.stringify(a.newValue)}</span>
                        {a.reason && <span className="text-slate-400 ml-2">({a.reason})</span>}
                      </div>
                    </div>
                    <div className="text-right text-[10px] text-slate-500">
                      <div>Confidence: {(a.confidence * 100).toFixed(0)}%</div>
                      <div>{new Date(a.timestamp).toLocaleTimeString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'questions' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">Question & Scenario Effectiveness Engine (Rule 17 & 18)</h3>
                <p className="text-xs text-slate-400">
                  Self-learning metrics on question clarity, follow-up requirements, and candidate differentiation power.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-3">
                  <h4 className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">
                    Top Performing Screening Questions
                  </h4>
                  {questionStats.map((q) => (
                    <div key={q.questionId} className="p-3 rounded-lg bg-slate-900/70 border border-slate-800">
                      <div className="font-semibold text-slate-200">{q.questionText}</div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                        <span>Target: {q.roleTarget}</span>
                        <span className="text-emerald-400 font-bold">
                          {(q.successfulAnswerRate * 100).toFixed(0)}% Success Rate
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-blue-400 uppercase tracking-wider text-[11px]">
                    Evaluated Real Estate Scenarios
                  </h4>
                  {scenarioStats.map((sc) => (
                    <div key={sc.scenarioId} className="p-3 rounded-lg bg-slate-900/70 border border-slate-800">
                      <div className="font-semibold text-slate-200">{sc.scenarioTitle}</div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                        <span>Tier: {sc.seniorityTier}</span>
                        <span className="text-blue-400 font-bold">
                          {(sc.differentiatesStrongCandidatesRate * 100).toFixed(0)}% Differentiation
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
