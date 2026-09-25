import fs from 'fs';
import path from 'path';
import {
  CandidateBehaviorReport,
  BehaviorTrend,
  RealTimeBehaviorState,
} from '../../src/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const BEHAVIOR_FILE = path.join(DATA_DIR, 'candidate_behaviors.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadJsonFile<T>(filePath: string, fallback: T): T {
  try {
    ensureDataDir();
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf-8');
      return fallback;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error loading JSON file ${filePath}:`, err);
    return fallback;
  }
}

function saveJsonFile<T>(filePath: string, data: T): void {
  try {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing JSON file ${filePath}:`, err);
  }
}

export class BehaviorRepository {
  // candidateId -> Array of behavior reports across calls
  private behaviorHistory: Map<string, CandidateBehaviorReport[]> = new Map();
  // active callId -> latest real-time turn state (pure in-memory for zero audio latency)
  private activeCallStates: Map<string, RealTimeBehaviorState> = new Map();

  constructor() {
    this.initialize();
  }

  private async initialize() {
    const rawData = loadJsonFile<Record<string, CandidateBehaviorReport[]>>(BEHAVIOR_FILE, {});
    this.behaviorHistory = new Map(Object.entries(rawData));

    // If empty, seed initial behavior profile
    if (this.behaviorHistory.size === 0) {
      this.seedInitialBehaviors();
    }
  }

  private seedInitialBehaviors() {
    const now = new Date(Date.now() - 86400000).toISOString();
    const seedAmit: CandidateBehaviorReport = {
      id: 'beh-seed-001',
      candidateId: 'cand-001',
      candidateName: 'Amit Sharma',
      conversationId: 'CALL-PREV-01',
      timestamp: now,
      confidence: 0.92,
      communicationStyle: {
        primaryTone: 'professional',
        secondaryTones: ['direct', 'confident' as any],
        summary: 'Candidate communicates in a direct, professional, and consultative manner with concrete numbers and market specifics.',
        isBrief: false,
        isDetailed: true,
      },
      interactionBehavior: {
        politeness: 'polite',
        respectfulness: 'respectful',
        cooperation: 'COOPERATIVE',
        patience: 'listens fully',
      },
      engagement: {
        level: 'HIGH',
        rationale: 'Actively asked about DLF luxury inventory pipelines and Gurgaon corridor sales targets with deep interest.',
        interestSignals: [
          'asked about luxury projects on Golf Course Extension Road',
          'inquired about commission slabs for 20 Cr+ luxury closures',
          'asked about face-to-face interview process at Sector 67 HQ',
        ],
        concernSignals: [
          'verified whether leads provided are HNI verified buyers',
        ],
      },
      conversationSignals: {
        listeningResponseQuality: 'EVIDENCE_BASED',
        confidenceSignals: 'CLEARLY_ARTICULATED',
        answerOwnership: 'Clearly distinguished personal direct closures (₹18 Cr DLF Camellias/The Aralias) from total squad target',
        accountabilitySignals: 'Described a structured pipeline conversion analysis when asked about team quarterly target challenges',
        interruptions: {
          frequency: 'occasional interruption',
          classification: 'natural interruption',
          count: 1,
          notes: 'Interrupted briefly to clarify the exact sector location of M3M Urbana, which progressed the scheduling smoothly',
        },
        impatience: {
          level: 'NONE',
          evidence: [],
        },
        frustrationSignals: {
          detected: false,
          evidence: [],
        },
        aggressiveLanguage: {
          detected: false,
          severity: 'none',
          evidence: [],
          count: 0,
        },
      },
      scenarioBehavior: [
        {
          scenarioTitle: 'HNI Client objecting to ₹12 Cr luxury ticket price',
          objectionHandlingStepsUsed: [
            '1. Understand objection',
            '2. Ask clarifying questions',
            '3. Identify actual concern',
            '4. Explain capital appreciation value',
            '5. Compare alternatives in Golf Course Ext',
          ],
          negotiationStyle: 'consultative',
          conversationalAdaptability: 'HIGH',
          customerHandlingApproach: 'Consultative and value-grounded; framed property as an generational asset with infrastructure growth justification',
          observation: 'Followed structured objection handling without pressuring the client',
          ownershipShown: 'Demonstrated high individual deal accountability with specific buyer objection examples',
        },
      ],
      behaviorTimeline: [
        {
          stage: 'opening',
          tone: 'polite',
          engagement: 'medium',
          observation: 'Acknowledged call courteously and confirmed availability',
        },
        {
          stage: 'screening',
          tone: 'professional',
          engagement: 'high',
          observation: 'Shared 6 years Gurugram luxury real estate experience with exact developer details',
        },
        {
          stage: 'compensation',
          tone: 'direct',
          engagement: 'high',
          observation: 'Stated current 16 LPA fixed and 22 LPA expectation clearly without hesitation',
        },
        {
          stage: 'interview_scheduling',
          tone: 'enthusiastic',
          engagement: 'high',
          observation: 'Agreed enthusiastically to visit Sector 67 M3M Urbana office',
        },
      ],
      evidence: [
        {
          dimension: 'politeness',
          observation: 'Candidate used polite framing throughout conversation',
          evidence: '"Sure Arjun ji, please go ahead, I have 10 minutes right now."',
          timestamp: now,
          conversationId: 'CALL-PREV-01',
          confidence: 0.95,
          source: 'transcript',
        },
        {
          dimension: 'answerOwnership',
          observation: 'Candidate distinguished personal contribution from team aggregate',
          evidence: '"Our team did 35 Crores, but my direct individual mandate was 18 Crores in luxury residential."',
          timestamp: now,
          conversationId: 'CALL-PREV-01',
          confidence: 0.94,
          source: 'transcript',
        },
      ],
      candidatePreferences: {
        language: 'Hinglish',
        responseStyle: 'detailed',
        preferredTime: 'afternoon',
        communicationPreference: 'consultative',
      },
      behaviorTrend: {
        trend: 'STABLE',
        historicalCallCount: 1,
        trendDescription: 'Consistently professional, cooperative, and high-engagement across interactions.',
      },
      adaptiveRecommendations: {
        recommendedAgentPacing: 'conversational_space',
        guidance: 'Candidate responds exceptionally well to domain-specific luxury questions. Provide conversational space and discuss project tiers directly.',
      },
      behaviorScore: {
        communication: {
          clarity: 5,
          responsiveness: 5,
          engagement: 5,
        },
        interaction: {
          politeness: 5,
          respectfulness: 5,
          cooperation: 5,
          patience: 4,
        },
        conversation: {
          interruptions: 4,
          topic_drift: 5,
          answer_relevance: 5,
        },
      },
      humanReviewRequired: false,
      humanReviewReasons: [],
      limitations: [
        'Behavior profile reflects observable conversation turns only; does not infer personality, intelligence, or psychological state.',
      ],
    };

    const seedAnanya: CandidateBehaviorReport = {
      id: 'beh-seed-002',
      candidateId: 'cand-2',
      candidateName: 'Ananya Verma',
      conversationId: 'call-rec-1',
      timestamp: '2026-09-14T16:42:00.000Z',
      confidence: 0.95,
      communicationStyle: {
        primaryTone: 'conversational',
        secondaryTones: ['enthusiastic', 'professional'],
        summary: 'Candidate exhibits high verbal clarity, enthusiastic cooperation, and fluid bilingual comfort. Provided structured, transparent answers on both Dubai and Gurgaon transactions.',
        isBrief: false,
        isDetailed: true,
      },
      interactionBehavior: {
        politeness: 'polite',
        respectfulness: 'respectful',
        cooperation: 'COOPERATIVE',
        patience: 'listens fully',
      },
      engagement: {
        level: 'HIGH',
        rationale: 'Immediately recognized developer projects in Dubai & Gurgaon, answered compensation directly, and confirmed F2F interview with zero hesitation.',
        interestSignals: [
          'Eager to attend F2F round at Sector 67 M3M Urbana office',
          'Promptly verified availability for next-day 11:00 AM slot',
          'Proactively mentioned local Golf Course Extension and Dubai Marina project closures',
        ],
        concernSignals: [],
      },
      conversationSignals: {
        listeningResponseQuality: 'EVIDENCE_BASED',
        confidenceSignals: 'CLEARLY_ARTICULATED',
        answerOwnership: 'Cited specific project names (Emaar & Sobha in Dubai, Golf Course Ext locally) with clear transactional familiarity',
        accountabilitySignals: 'Directly stated 15-day notice period and verified immediate joining readiness',
        interruptions: {
          frequency: 'no interruptions',
          classification: 'none',
          count: 0,
          notes: 'No interruptions observed; waited for complete agent prompt before responding',
        },
        impatience: {
          level: 'NONE',
          evidence: [],
        },
        frustrationSignals: {
          detected: false,
          evidence: [],
        },
        aggressiveLanguage: {
          detected: false,
          severity: 'none',
          evidence: [],
          count: 0,
        },
      },
      scenarioBehavior: [
        {
          scenarioTitle: 'Dubai & Gurgaon dual-market luxury sales screening',
          objectionHandlingStepsUsed: [
            'Clarified experience across both international and domestic luxury hubs',
            'Confirmed prompt F2F scheduling availability',
          ],
          negotiationStyle: 'consultative',
          conversationalAdaptability: 'HIGH',
          customerHandlingApproach: 'High warmth and relationship-focused; speaks with poise and professional hospitality suitable for high-net-worth real estate buyers',
          observation: 'Maintained polite, consultative cadence throughout the 3-minute screening dialogue',
          ownershipShown: 'Clear timeline and ownership of compensation expectation and immediate joining availability',
        },
      ],
      behaviorTimeline: [
        { stage: 'opening', tone: 'warm', engagement: 'high', observation: 'Warmly greeted agent and confirmed time to speak' },
        { stage: 'screening', tone: 'enthusiastic', engagement: 'high', observation: 'Detailed 4 years pure real estate background' },
        { stage: 'compensation', tone: 'transparent', engagement: 'high', observation: 'Provided 11 LPA current and 15 LPA expected without deflection' },
        { stage: 'interview_scheduling', tone: 'enthusiastic', engagement: 'high', observation: 'Accepted Sector 67 M3M Urbana HQ slot immediately' },
      ],
      evidence: [
        {
          dimension: 'politeness',
          observation: 'Candidate opened and closed with polite greetings',
          evidence: '"Yes, hi! Good afternoon. Yes, I can speak for a few minutes."',
          timestamp: '16:40:10',
          conversationId: 'call-rec-1',
          confidence: 0.96,
          source: 'transcript',
        },
        {
          dimension: 'clarity',
          observation: 'Directly specified both local and international project credentials',
          evidence: '"I have closed multiple transactions in Emaar and Sobha in Dubai Marina & Downtown, and locally on Golf Course Extension Road."',
          timestamp: '16:40:55',
          conversationId: 'call-rec-1',
          confidence: 0.94,
          source: 'transcript',
        },
        {
          dimension: 'cooperation',
          observation: 'Immediate acceptance of scheduled interview slot',
          evidence: '"Tomorrow 11 AM works perfectly for me. Please share the address."',
          timestamp: '16:42:01',
          conversationId: 'call-rec-1',
          confidence: 0.98,
          source: 'transcript',
        },
      ],
      candidatePreferences: {
        language: 'English',
        responseStyle: 'detailed',
        preferredTime: 'morning',
        communicationPreference: 'consultative',
      },
      behaviorTrend: {
        trend: 'IMPROVING',
        historicalCallCount: 1,
        trendDescription: 'High conversational energy, polite rapport, and crisp factual disclosures.',
      },
      adaptiveRecommendations: {
        recommendedAgentPacing: 'conversational_space',
        guidance: 'Candidate is highly articulate and engaged. Allow conversational room to discuss luxury portfolio strategy and M3M/DLF developer tie-ups.',
      },
      behaviorScore: {
        communication: { clarity: 5, responsiveness: 5, engagement: 5 },
        interaction: { politeness: 5, respectfulness: 5, cooperation: 5, patience: 5 },
        conversation: { interruptions: 5, topic_drift: 5, answer_relevance: 5 },
      },
      humanReviewRequired: false,
      humanReviewReasons: [],
      limitations: [
        'Observable conversational behavior only. No inferences made regarding personal psychological characteristics.',
      ],
    };

    this.saveBehaviorReport(seedAmit);
    this.saveBehaviorReport(seedAnanya);
  }

  public getCandidateBehaviorHistory(candidateId: string): CandidateBehaviorReport[] {
    let list = this.behaviorHistory.get(candidateId);
    if (!list || list.length === 0) {
      if (candidateId === 'cand-1') list = this.behaviorHistory.get('cand-001');
      else if (candidateId === 'cand-001') list = this.behaviorHistory.get('cand-1');
    }
    return list || [];
  }

  public getLatestBehaviorReport(candidateId: string): CandidateBehaviorReport | null {
    const list = this.getCandidateBehaviorHistory(candidateId);
    if (!list || list.length === 0) return null;
    return list[list.length - 1];
  }

  public saveBehaviorReport(report: CandidateBehaviorReport): void {
    const existing = this.behaviorHistory.get(report.candidateId) || [];
    existing.push(report);
    this.behaviorHistory.set(report.candidateId, existing);

    const obj: Record<string, CandidateBehaviorReport[]> = {};
    for (const [k, v] of this.behaviorHistory.entries()) {
      obj[k] = v;
    }
    saveJsonFile(BEHAVIOR_FILE, obj);
  }

  public updateActiveCallState(callId: string, state: RealTimeBehaviorState): void {
    // Pure in-memory update for live call audio performance
    this.activeCallStates.set(callId, state);
  }

  public getActiveCallState(callId: string): RealTimeBehaviorState | null {
    return this.activeCallStates.get(callId) || null;
  }

  public calculateBehaviorTrend(candidateId: string): {
    trend: BehaviorTrend;
    historicalCallCount: number;
    trendDescription: string;
  } {
    const history = this.behaviorHistory.get(candidateId) || [];
    if (history.length === 0) {
      return {
        trend: 'INSUFFICIENT_DATA',
        historicalCallCount: 0,
        trendDescription: 'First conversation recorded. Insufficient historical data for trend analysis.',
      };
    }
    if (history.length === 1) {
      return {
        trend: 'STABLE',
        historicalCallCount: 1,
        trendDescription: 'Single call recorded. Baseline communication behavior established.',
      };
    }

    const recent = history.slice(-3);
    const engagementScores = recent.map((r) => {
      if (r.engagement.level === 'HIGH') return 3;
      if (r.engagement.level === 'MEDIUM') return 2;
      return 1;
    });

    const isImproving = engagementScores[engagementScores.length - 1] > engagementScores[0];
    const isDeclining = engagementScores[engagementScores.length - 1] < engagementScores[0];

    if (isImproving) {
      return {
        trend: 'IMPROVING',
        historicalCallCount: history.length,
        trendDescription: 'Candidate communication engagement and openness have improved over successive interactions.',
      };
    } else if (isDeclining) {
      return {
        trend: 'DECLINING',
        historicalCallCount: history.length,
        trendDescription: 'Observable candidate responsiveness has reduced in recent conversations compared to earlier calls.',
      };
    } else {
      return {
        trend: 'STABLE',
        historicalCallCount: history.length,
        trendDescription: 'Consistent communication tone, cooperation, and engagement maintained across calls.',
      };
    }
  }

  public getAllCandidateBehaviorReports(): CandidateBehaviorReport[] {
    const all: CandidateBehaviorReport[] = [];
    for (const reports of this.behaviorHistory.values()) {
      all.push(...reports);
    }
    return all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public getFlaggedForHumanReview(): CandidateBehaviorReport[] {
    return this.getAllCandidateBehaviorReports().filter((r) => r.humanReviewRequired);
  }
}

export const behaviorRepository = new BehaviorRepository();
