import React, { useState, useEffect } from 'react';
import {
  Brain,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Clock,
  Sparkles,
  TrendingUp,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Activity,
  FileText,
  Volume2,
  Eye,
  Award,
} from 'lucide-react';
import { CandidateBehaviorReport, BehaviorEvidenceItem } from '../types';

interface CandidateBehaviorCardProps {
  candidateId: string;
  initialReport?: CandidateBehaviorReport | null;
}

export const CandidateBehaviorCard: React.FC<CandidateBehaviorCardProps> = ({
  candidateId,
  initialReport,
}) => {
  const [report, setReport] = useState<CandidateBehaviorReport | null>(initialReport || null);
  const [history, setHistory] = useState<CandidateBehaviorReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showScenarios, setShowScenarios] = useState(false);

  useEffect(() => {
    if (!candidateId) return;
    setLoading(true);
    // Fetch latest behavior report and full history
    Promise.all([
      fetch(`/api/brain/behavior/latest/${candidateId}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/brain/behavior/history/${candidateId}`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([latest, hist]) => {
        if (latest) setReport(latest);
        if (Array.isArray(hist)) setHistory(hist);
      })
      .catch((err) => console.error('Error loading behavior data:', err))
      .finally(() => setLoading(false));
  }, [candidateId]);

  if (loading && !report) {
    return (
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse text-xs text-slate-400 flex items-center gap-2">
        <Activity className="w-4 h-4 text-amber-400 animate-spin" />
        <span>Loading communication & behavior intelligence...</span>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
        <div className="flex items-center gap-2 text-slate-300 font-semibold mb-1">
          <Brain className="w-4 h-4 text-amber-400" />
          <span>Behavior & Conversation Intelligence</span>
        </div>
        <p className="text-slate-500">
          No conversation behavior recorded yet. Behavior observations are generated automatically from completed voice screening transcripts.
        </p>
      </div>
    );
  }

  const trendColor =
    report.behaviorTrend.trend === 'IMPROVING'
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      : report.behaviorTrend.trend === 'DECLINING'
      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
      : 'bg-blue-500/10 text-blue-400 border-blue-500/30';

  const politenessBadge =
    report.interactionBehavior.politeness === 'polite' || report.interactionBehavior.politeness === 'generally polite'
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
      : report.interactionBehavior.politeness === 'disrespectful language observed'
      ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
      : 'text-amber-300 bg-amber-500/10 border-amber-500/20';

  const cooperationBadge =
    report.interactionBehavior.cooperation === 'COOPERATIVE' || report.interactionBehavior.cooperation === 'MOSTLY_COOPERATIVE'
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
      : report.interactionBehavior.cooperation === 'RELUCTANT' || report.interactionBehavior.cooperation === 'NON_RESPONSIVE'
      ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
      : 'text-amber-300 bg-amber-500/10 border-amber-500/20';

  return (
    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3.5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-bold text-white">
              Candidate Behavior & Conversation Intelligence
            </h4>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Strictly observable verbal communication evidence • {history.length} call{history.length !== 1 ? 's' : ''} analyzed
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${trendColor}`}>
            Trend: {report.behaviorTrend.trend}
          </span>
          {report.humanReviewRequired && (
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-rose-400" />
              <span>Human Review Flagged</span>
            </span>
          )}
        </div>
      </div>

      {/* Human Review Alert Banner if applicable */}
      {report.humanReviewRequired && (
        <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/30 text-xs text-rose-200">
          <div className="font-bold flex items-center gap-1 text-rose-300 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>HR Attention Required (Rule 40)</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-300">
            {report.humanReviewReasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Primary Style Summary */}
      <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-slate-200">
        <div className="flex items-center justify-between text-[11px] font-bold text-amber-400 mb-1">
          <span>Observed Communication Style:</span>
          <span className="text-[10px] font-normal text-slate-400 uppercase tracking-wider">
            {report.communicationStyle.primaryTone} • {report.communicationStyle.isBrief ? 'Brief' : report.communicationStyle.isDetailed ? 'Detailed' : 'Conversational'}
          </span>
        </div>
        <p className="text-slate-300 leading-relaxed text-[11px]">
          {report.communicationStyle.summary}
        </p>
      </div>

      {/* Observable Interaction Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
        <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800">
          <div className="text-slate-400 text-[10px]">Politeness</div>
          <div className={`font-semibold mt-0.5 px-1.5 py-0.5 rounded text-[10px] inline-block border ${politenessBadge}`}>
            {report.interactionBehavior.politeness}
          </div>
        </div>

        <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800">
          <div className="text-slate-400 text-[10px]">Respectfulness</div>
          <div className="font-semibold text-slate-200 mt-0.5 capitalize">
            {report.interactionBehavior.respectfulness}
          </div>
        </div>

        <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800">
          <div className="text-slate-400 text-[10px]">Cooperation</div>
          <div className={`font-semibold mt-0.5 px-1.5 py-0.5 rounded text-[10px] inline-block border ${cooperationBadge}`}>
            {report.interactionBehavior.cooperation}
          </div>
        </div>

        <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800">
          <div className="text-slate-400 text-[10px]">Patience</div>
          <div className="font-semibold text-slate-200 mt-0.5 capitalize truncate">
            {report.interactionBehavior.patience}
          </div>
        </div>
      </div>

      {/* Conversation Signals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
        {/* Answer Ownership (Rule 15) */}
        <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800">
          <div className="text-slate-400 text-[10px] flex items-center justify-between">
            <span>Answer Ownership (Rule 15)</span>
            <span className="text-amber-400 font-semibold text-[9px]">Personal vs Team</span>
          </div>
          <p className="text-slate-200 mt-1 line-clamp-2 text-[11px]">
            {report.conversationSignals.answerOwnership}
          </p>
        </div>

        {/* Accountability & Problem Solving (Rule 16) */}
        <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800">
          <div className="text-slate-400 text-[10px] flex items-center justify-between">
            <span>Accountability (Rule 16)</span>
            <span className="text-blue-400 font-semibold text-[9px]">Problem Analysis</span>
          </div>
          <p className="text-slate-200 mt-1 line-clamp-2 text-[11px]">
            {report.conversationSignals.accountabilitySignals}
          </p>
        </div>
      </div>

      {/* Interruption & Impatience Gauges */}
      <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/80 text-[11px] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Interruption Flow:</span>
          <span className="text-slate-200 font-medium">
            {report.conversationSignals.interruptions.frequency}
            {report.conversationSignals.interruptions.classification !== 'none' && (
              <span className="text-slate-400 text-[10px] ml-1">
                ({report.conversationSignals.interruptions.classification})
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Impatience Signal:</span>
          <span className={`font-semibold ${
            report.conversationSignals.impatience.level === 'NONE'
              ? 'text-emerald-400'
              : report.conversationSignals.impatience.level === 'TEMPORARY_IMPATIENCE'
              ? 'text-amber-400'
              : 'text-rose-400'
          }`}>
            {report.conversationSignals.impatience.level}
          </span>
        </div>
      </div>

      {/* Multi-Dimensional Behavior Score Breakdown (Rule 26, 27) */}
      <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-slate-300 text-[11px] flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>Multi-Dimensional Behavior Ratings (1–5 Scale)</span>
          </span>
          <span className="text-[10px] text-slate-500">Non-personality rating</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[10px] text-center">
          <div className="p-2 rounded bg-slate-900 border border-slate-800">
            <div className="text-slate-400 mb-1">Communication</div>
            <div className="text-amber-300 font-bold text-xs">
              Clarity: {report.behaviorScore.communication.clarity}/5 • Resp: {report.behaviorScore.communication.responsiveness}/5
            </div>
          </div>
          <div className="p-2 rounded bg-slate-900 border border-slate-800">
            <div className="text-slate-400 mb-1">Interaction</div>
            <div className="text-emerald-300 font-bold text-xs">
              Polite: {report.behaviorScore.interaction.politeness}/5 • Coop: {report.behaviorScore.interaction.cooperation}/5
            </div>
          </div>
          <div className="p-2 rounded bg-slate-900 border border-slate-800">
            <div className="text-slate-400 mb-1">Conversation Flow</div>
            <div className="text-blue-300 font-bold text-xs">
              Relevance: {report.behaviorScore.conversation.answer_relevance}/5 • Pace: {report.behaviorScore.conversation.interruptions}/5
            </div>
          </div>
        </div>
      </div>

      {/* Adaptive Agent Pacing Guidance (Rule 32) */}
      <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/20 text-xs text-amber-200">
        <div className="font-bold text-amber-300 mb-0.5 flex items-center gap-1 text-[11px]">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Next Call Adaptive Recruiter Directives (Rule 32):</span>
        </div>
        <p className="text-slate-300 text-[11px] leading-relaxed">
          {report.adaptiveRecommendations.guidance}
        </p>
      </div>

      {/* Expandable Sections: Evidence, Timeline, Scenarios */}
      <div className="space-y-2 pt-1">
        {/* Evidence List Accordion (Rule 28) */}
        <div className="border border-slate-800 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowEvidence(!showEvidence)}
            className="w-full px-3 py-2 bg-slate-950/40 hover:bg-slate-950/70 text-left text-xs text-slate-300 font-medium flex items-center justify-between"
          >
            <span className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              <span>Verbatim Observable Evidence Log ({report.evidence.length})</span>
            </span>
            {showEvidence ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showEvidence && (
            <div className="p-3 bg-slate-950/80 border-t border-slate-800 space-y-2 text-xs">
              {report.evidence.length === 0 ? (
                <div className="text-slate-500 text-[11px]">No specific citations recorded.</div>
              ) : (
                report.evidence.map((ev, idx) => (
                  <div key={idx} className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px]">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span className="font-semibold text-amber-300 uppercase">{ev.dimension}</span>
                      <span>Confidence: {(ev.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="text-slate-200 italic mb-1">{ev.evidence}</div>
                    <div className="text-slate-400 text-[10px]">{ev.observation}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Behavior Timeline Accordion (Rule 22) */}
        {report.behaviorTimeline && report.behaviorTimeline.length > 0 && (
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowTimeline(!showTimeline)}
              className="w-full px-3 py-2 bg-slate-950/40 hover:bg-slate-950/70 text-left text-xs text-slate-300 font-medium flex items-center justify-between"
            >
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Call Stage Behavior Progression ({report.behaviorTimeline.length} stages)</span>
              </span>
              {showTimeline ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showTimeline && (
              <div className="p-3 bg-slate-950/80 border-t border-slate-800 space-y-1.5 text-xs">
                {report.behaviorTimeline.map((st, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-[11px]">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-semibold text-[10px] uppercase shrink-0">
                      {st.stage}
                    </span>
                    <span className="text-slate-300">{st.observation}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Scenario Behavior Accordion (Rule 17) */}
        {report.scenarioBehavior && report.scenarioBehavior.length > 0 && (
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowScenarios(!showScenarios)}
              className="w-full px-3 py-2 bg-slate-950/40 hover:bg-slate-950/70 text-left text-xs text-slate-300 font-medium flex items-center justify-between"
            >
              <span className="flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-slate-400" />
                <span>Sales Objection & Scenario Handling</span>
              </span>
              {showScenarios ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showScenarios && (
              <div className="p-3 bg-slate-950/80 border-t border-slate-800 space-y-2 text-xs">
                {report.scenarioBehavior.map((sc, idx) => (
                  <div key={idx} className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px]">
                    <div className="font-bold text-white mb-1">{sc.scenarioTitle}</div>
                    <div className="text-slate-300 mb-1">
                      <span className="text-slate-400">Negotiation Style: </span>
                      <span className="text-amber-300 font-semibold">{sc.negotiationStyle}</span>
                      <span className="text-slate-400 ml-2">Adaptability: </span>
                      <span className="text-emerald-300 font-semibold">{sc.conversationalAdaptability}</span>
                    </div>
                    <div className="text-slate-400 text-[10px] mb-1">
                      Steps Used: {sc.objectionHandlingStepsUsed.join(' → ')}
                    </div>
                    <div className="text-slate-300 text-[10px]">{sc.observation}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ethical Guardrails Footer (Rule 23, 25, 27) */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
        <span>White Collar Realty Ethics Guardrails Active</span>
        <span>Observable evidence only • No personality inference</span>
      </div>
    </div>
  );
};
