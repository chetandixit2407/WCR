import fs from 'fs';
import path from 'path';
import {
  CallRecord,
  HumanFeedbackRecord,
  QuestionEffectivenessStat,
  ScenarioEffectivenessStat,
} from '../../src/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations_store.json');
const FEEDBACK_FILE = path.join(DATA_DIR, 'human_feedback.json');
const QUESTION_STATS_FILE = path.join(DATA_DIR, 'question_stats.json');
const SCENARIO_STATS_FILE = path.join(DATA_DIR, 'scenario_stats.json');

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

export class ConversationRepository {
  private conversations: Map<string, CallRecord> = new Map();
  private humanFeedback: HumanFeedbackRecord[] = [];
  private questionStats: Map<string, QuestionEffectivenessStat> = new Map();
  private scenarioStats: Map<string, ScenarioEffectivenessStat> = new Map();

  constructor() {
    this.initialize();
  }

  private async initialize() {
    const rawConversations = loadJsonFile<Record<string, CallRecord>>(CONVERSATIONS_FILE, {});
    this.conversations = new Map(Object.entries(rawConversations));
    this.humanFeedback = loadJsonFile<HumanFeedbackRecord[]>(FEEDBACK_FILE, this.getDefaultFeedback());
    
    const rawQuestions = loadJsonFile<Record<string, QuestionEffectivenessStat>>(QUESTION_STATS_FILE, this.getDefaultQuestionStats());
    this.questionStats = new Map(Object.entries(rawQuestions));

    const rawScenarios = loadJsonFile<Record<string, ScenarioEffectivenessStat>>(SCENARIO_STATS_FILE, this.getDefaultScenarioStats());
    this.scenarioStats = new Map(Object.entries(rawScenarios));
  }

  private getDefaultFeedback(): HumanFeedbackRecord[] {
    return [
      {
        id: 'fb-001',
        candidateId: 'cand-001',
        candidateName: 'Amit Sharma',
        conversationId: 'CALL-101',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        reviewerName: 'Rohit Verma (HR Lead)',
        changeType: 'QUALIFICATION_DECISION',
        aiRecommendation: {
          status: 'Interview Scheduled',
          qualification: 'Senior Fit',
          remark: 'Strong Gurgaon luxury residential candidate',
        },
        humanDecision: {
          status: 'Interview Scheduled',
          qualification: 'Priority Senior Leadership',
          reason: 'Amit has exceptional DLF luxury network and verified personal closures above 9 Cr. Prioritize for immediate squad lead role.',
        },
        learningGenerated: 'Candidate exhibits top-tier luxury developer competence. Assign leadership evaluation rubric.',
      },
    ];
  }

  private getDefaultQuestionStats(): Record<string, QuestionEffectivenessStat> {
    return {
      'q-personal-closure': {
        questionId: 'q-personal-closure',
        questionText: "What was your highest-ticket personal closure in Gurgaon or Dubai luxury residential?",
        topic: 'highest_personal_closure',
        roleTarget: 'Sales Manager (Luxury Real Estate)',
        experienceBracket: '4+ Years',
        timesAsked: 28,
        successfulAnswerRate: 0.93,
        followUpNeededCount: 4,
        averageAnswerQuality: 'HIGH',
        actionableInsightsYielded: 26,
        effectivenessRating: 'HIGH',
      },
      'q-inventory-handled': {
        questionId: 'q-inventory-handled',
        questionText: "Which specific developer projects have you actively sold (e.g. DLF, M3M, Godrej, Emaar)?",
        topic: 'developer_projects',
        roleTarget: 'Property Consultant',
        experienceBracket: '1-3 Years',
        timesAsked: 45,
        successfulAnswerRate: 0.96,
        followUpNeededCount: 3,
        averageAnswerQuality: 'HIGH',
        actionableInsightsYielded: 43,
        effectivenessRating: 'HIGH',
      },
      'q-team-vs-personal': {
        questionId: 'q-team-vs-personal',
        questionText: "How do you split your time between mentoring consultants and personally closing HNI leads?",
        topic: 'manager_personal_vs_team_closures',
        roleTarget: 'Sales Manager (Luxury Real Estate)',
        experienceBracket: '5+ Years',
        timesAsked: 19,
        successfulAnswerRate: 0.84,
        followUpNeededCount: 7,
        averageAnswerQuality: 'HIGH',
        actionableInsightsYielded: 18,
        effectivenessRating: 'HIGH',
      },
      'q-fixed-budget-check': {
        questionId: 'q-fixed-budget-check',
        questionText: "What is your current fixed in-hand salary and what are your CTC expectations for this role?",
        topic: 'current_expected_salary',
        roleTarget: 'All Roles',
        experienceBracket: 'All Brackets',
        timesAsked: 52,
        successfulAnswerRate: 0.88,
        followUpNeededCount: 9,
        averageAnswerQuality: 'MEDIUM',
        actionableInsightsYielded: 48,
        effectivenessRating: 'HIGH',
      },
    };
  }

  private getDefaultScenarioStats(): Record<string, ScenarioEffectivenessStat> {
    return {
      'sc-hni-discount': {
        scenarioId: 'sc-hni-discount',
        scenarioTitle: 'HNI Buyer Demanding 8% Developer Discount on Ultra-Luxury Unit',
        roleTarget: 'Sales Manager (Luxury Real Estate)',
        seniorityTier: 'SENIOR',
        timesPresented: 24,
        averageInformationValue: 'HIGH',
        differentiatesStrongCandidatesRate: 0.91,
        recommendedFor: ['Sales Manager (Luxury Real Estate)', 'Senior Property Consultant'],
      },
      'sc-site-visit-no-show': {
        scenarioId: 'sc-site-visit-no-show',
        scenarioTitle: 'High-Intent Investor Cancelling Golf Course Ext Site Visit Last Minute',
        roleTarget: 'Property Consultant',
        seniorityTier: 'INTERMEDIATE',
        timesPresented: 32,
        averageInformationValue: 'HIGH',
        differentiatesStrongCandidatesRate: 0.85,
        recommendedFor: ['Property Consultant', 'Business Development Executive'],
      },
    };
  }

  public saveConversation(record: CallRecord): void {
    this.conversations.set(record.id, record);

    const obj: Record<string, CallRecord> = {};
    for (const [k, v] of this.conversations.entries()) {
      obj[k] = v;
    }
    saveJsonFile(CONVERSATIONS_FILE, obj);
  }

  public getConversation(id: string): CallRecord | null {
    return this.conversations.get(id) || null;
  }

  public getConversationsForCandidate(candidateId: string): CallRecord[] {
    return Array.from(this.conversations.values())
      .filter((c) => c.candidateId === candidateId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public getAllConversations(): CallRecord[] {
    return Array.from(this.conversations.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public saveHumanFeedback(feedback: Omit<HumanFeedbackRecord, 'id' | 'timestamp'>): HumanFeedbackRecord {
    const record: HumanFeedbackRecord = {
      ...feedback,
      id: `fb-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    this.humanFeedback.unshift(record);

    saveJsonFile(FEEDBACK_FILE, this.humanFeedback);

    return record;
  }

  public getAllHumanFeedback(): HumanFeedbackRecord[] {
    return this.humanFeedback;
  }

  public getFeedbackForCandidate(candidateId: string): HumanFeedbackRecord[] {
    return this.humanFeedback.filter((f) => f.candidateId === candidateId);
  }

  public logQuestionOutcome(questionId: string, topic: string, role: string, success: boolean, neededFollowUp: boolean): void {
    let stat = this.questionStats.get(questionId);
    if (!stat) {
      stat = {
        questionId,
        questionText: questionId,
        topic,
        roleTarget: role,
        experienceBracket: 'General',
        timesAsked: 0,
        successfulAnswerRate: 1.0,
        followUpNeededCount: 0,
        averageAnswerQuality: 'HIGH',
        actionableInsightsYielded: 0,
        effectivenessRating: 'HIGH',
      };
    }

    stat.timesAsked += 1;
    if (neededFollowUp) stat.followUpNeededCount += 1;
    if (success) stat.actionableInsightsYielded += 1;

    stat.successfulAnswerRate = Number((stat.actionableInsightsYielded / stat.timesAsked).toFixed(2));
    stat.averageAnswerQuality = stat.successfulAnswerRate > 0.8 ? 'HIGH' : stat.successfulAnswerRate > 0.5 ? 'MEDIUM' : 'LOW';
    stat.effectivenessRating = stat.successfulAnswerRate >= 0.75 ? 'HIGH' : stat.successfulAnswerRate >= 0.5 ? 'MEDIUM' : 'LOW';

    this.questionStats.set(questionId, stat);
    
    const obj: Record<string, QuestionEffectivenessStat> = {};
    for (const [k, v] of this.questionStats.entries()) {
      obj[k] = v;
    }
    saveJsonFile(QUESTION_STATS_FILE, obj);
  }

  public getAllQuestionStats(): QuestionEffectivenessStat[] {
    return Array.from(this.questionStats.values());
  }

  public getAllScenarioStats(): ScenarioEffectivenessStat[] {
    return Array.from(this.scenarioStats.values());
  }
}

export const conversationRepository = new ConversationRepository();
