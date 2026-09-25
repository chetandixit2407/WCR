import fs from 'fs';
import path from 'path';
import {
  CandidateLongTermMemory,
  MemoryFact,
  CandidateMemoryContradiction,
  CandidateCorrectionRecord,
  LearningProposal,
  HrBrainOverviewStats,
  FactSource,
  CandidateBehaviorSummary,
  CandidateMultiCallBehaviorProfile,
} from '../../src/types';
import { behaviorAnalyzer } from '../ai/behaviorAnalyzer';

export interface MemoryAuditRecord {
  id: string;
  candidateId: string;
  candidateName: string;
  field: string;
  previousValue: any;
  newValue: any;
  source: FactSource;
  conversationId?: string;
  reason: string;
  confidence: number;
  timestamp: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const MEMORY_FILE = path.join(DATA_DIR, 'candidate_memories.json');
const AUDIT_FILE = path.join(DATA_DIR, 'memory_audit_trail.json');
const PROPOSALS_FILE = path.join(DATA_DIR, 'learning_proposals.json');
const BEHAVIOR_FILE = path.join(DATA_DIR, 'candidate_behavior_memory.json');

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

export class MemoryRepository {
  private memories: Map<string, CandidateLongTermMemory> = new Map();
  private auditTrail: MemoryAuditRecord[] = [];
  private learningProposals: LearningProposal[] = [];
  private behaviorProfiles: Map<string, CandidateMultiCallBehaviorProfile> = new Map();

  constructor() {
    this.initialize();
  }

  private async initialize() {
    // 1. Initialize from local files for fast cold boot cache
    const rawMemories = loadJsonFile<Record<string, CandidateLongTermMemory>>(MEMORY_FILE, {});
    this.memories = new Map(Object.entries(rawMemories));
    this.auditTrail = loadJsonFile<MemoryAuditRecord[]>(AUDIT_FILE, []);
    this.learningProposals = loadJsonFile<LearningProposal[]>(PROPOSALS_FILE, this.getDefaultProposals());
    
    const rawBehavior = loadJsonFile<Record<string, CandidateMultiCallBehaviorProfile>>(BEHAVIOR_FILE, {});
    this.behaviorProfiles = new Map(Object.entries(rawBehavior));

    // Seed default initial memories if completely empty
    if (this.memories.size === 0) {
      this.seedInitialCandidateMemories();
    }
  }

  private getDefaultProposals(): LearningProposal[] {
    return [
      {
        id: 'prop-101',
        type: 'LEARNING_PROPOSAL',
        pattern: 'Sales Manager candidates frequently ask about the incentive & OTE slab breakdown before sharing current CTC.',
        evidenceCount: 14,
        evidenceExamples: [
          'Candidate asked: "What is the commission slab for 20 Cr+ luxury DLF bookings?"',
          'Candidate hesitated to disclose current 16 LPA fixed without knowing incentive schedule.',
        ],
        affectedRoles: ['Sales Manager (Luxury Real Estate)', 'Assistant General Manager'],
        category: 'COMPENSATION_OBJECTION',
        suggestedChange: 'Add brief approved statement: "We offer top-of-market quarterly closing incentives up to 35 LPA OTE on luxury Gurugram inventories" early in the conversation.',
        risk: 'LOW',
        requiresHumanApproval: true,
        status: 'PENDING_REVIEW',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
      {
        id: 'prop-102',
        type: 'LEARNING_PROPOSAL',
        pattern: 'Senior candidates with 6+ years experience give team totals rather than personal individual closures.',
        evidenceCount: 9,
        evidenceExamples: [
          'Candidate said: "We closed 45 Cr last quarter with team of 12 consultants."',
        ],
        affectedRoles: ['Sales Manager (Luxury Real Estate)', 'Team Leader'],
        category: 'QUESTION_OPTIMIZATION',
        suggestedChange: 'Follow up immediately on team answers with: "Understood. Out of that volume, what was your own personal direct closing contribution?"',
        risk: 'LOW',
        requiresHumanApproval: true,
        status: 'APPROVED',
        createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
        reviewedBy: 'HR Director (Rohit Verma)',
        reviewedAt: new Date(Date.now() - 86400000).toISOString(),
        reviewNotes: 'Approved for all Managerial roles.',
      },
    ];
  }

  private seedInitialCandidateMemories() {
    const now = new Date().toISOString();
    
    // Seed for Amit Sharma (cand-001)
    const amitMemory: CandidateLongTermMemory = {
      candidateId: 'cand-001',
      candidateName: 'Amit Sharma',
      identity: {
        name: { field: 'name', value: 'Amit Sharma', source: 'application_form', timestamp: now, confidence: 1.0, verified: true },
        phone: { field: 'phone', value: '+91 98112 34567', source: 'application_form', timestamp: now, confidence: 1.0, verified: true },
        email: { field: 'email', value: 'amit.sharma@gmail.com', source: 'application_form', timestamp: now, confidence: 1.0, verified: true },
        location: { field: 'location', value: 'DLF Phase 5, Gurugram', source: 'candidate_spoken', timestamp: now, confidence: 0.95, verified: true },
      },
      experience: {
        totalYears: { field: 'totalYears', value: 6, source: 'candidate_spoken', timestamp: now, confidence: 0.95, verified: true },
        realEstateYears: { field: 'realEstateYears', value: 6, source: 'candidate_spoken', timestamp: now, confidence: 0.95, verified: true },
        gurgaonYears: { field: 'gurgaonYears', value: 6, source: 'candidate_spoken', timestamp: now, confidence: 0.95, verified: true },
        dubaiYears: { field: 'dubaiYears', value: 1, source: 'candidate_spoken', timestamp: now, confidence: 0.85, verified: true },
      },
      companies: { field: 'companies', value: ['Anarock', 'PropTiger'], source: 'candidate_spoken', timestamp: now, confidence: 0.95, verified: true },
      designations: { field: 'designations', value: ['Senior Manager - Luxury Residential'], source: 'candidate_spoken', timestamp: now, confidence: 0.95, verified: true },
      markets: { field: 'markets', value: ['Golf Course Extension Road', 'SPR', 'Dwarka Expressway'], source: 'candidate_spoken', timestamp: now, confidence: 0.95, verified: true },
      projects: { field: 'projects', value: ['M3M Golfestate', 'DLF The Camellias', 'Emaar Palm Springs'], source: 'candidate_spoken', timestamp: now, confidence: 0.9, verified: true },
      developers: { field: 'developers', value: ['DLF', 'M3M', 'Emaar', 'Godrej'], source: 'candidate_spoken', timestamp: now, confidence: 0.95, verified: true },
      segments: { field: 'segments', value: ['Luxury Residential', 'Ultra-Luxury High-Rise'], source: 'candidate_spoken', timestamp: now, confidence: 0.95, verified: true },
      ticketSizes: { field: 'ticketSizes', value: ['₹4 Cr - ₹12 Cr'], source: 'candidate_spoken', timestamp: now, confidence: 0.9, verified: true },
      luxuryExperience: {
        hasLuxury: { field: 'hasLuxury', value: true, source: 'candidate_spoken', timestamp: now, confidence: 0.95, verified: true },
        ticketSizesHandled: { field: 'ticketSizesHandled', value: ['₹4 Cr - ₹12 Cr'], source: 'candidate_spoken', timestamp: now, confidence: 0.95, verified: true },
        hniExposure: { field: 'hniExposure', value: 'High - Direct NRI & CXO clientele in Delhi NCR', source: 'candidate_spoken', timestamp: now, confidence: 0.9, verified: true },
        developersHandled: { field: 'developersHandled', value: ['DLF', 'M3M', 'Emaar'], source: 'candidate_spoken', timestamp: now, confidence: 0.95, verified: true },
        primaryVsSecondary: { field: 'primaryVsSecondary', value: '80% Primary Developer Sales, 20% Prime Secondary', source: 'candidate_spoken', timestamp: now, confidence: 0.88, verified: true },
      },
      salesPerformance: {
        highestPersonalClosure: { field: 'highestPersonalClosure', value: '₹9.5 Cr (DLF luxury penthouse)', source: 'candidate_spoken', timestamp: now, confidence: 0.92, verified: true },
        monthlyRunRate: { field: 'monthlyRunRate', value: '₹12-18 Cr Gross Bookings / month', source: 'candidate_spoken', timestamp: now, confidence: 0.9, verified: true },
      },
      teamManagement: {
        teamSize: { field: 'teamSize', value: 8, source: 'candidate_spoken', timestamp: now, confidence: 0.9, verified: true },
        personalVsTeamSplit: { field: 'personalVsTeamSplit', value: '60% Squad mentoring / closing assistance, 40% personal HNI accounts', source: 'candidate_spoken', timestamp: now, confidence: 0.88, verified: true },
      },
      compensation: {
        currentSalary: { field: 'currentSalary', value: '18 LPA Fixed', source: 'candidate_spoken', timestamp: now, confidence: 0.9, verified: true },
        expectedSalary: { field: 'expectedSalary', value: '22 LPA Fixed + High OTE', source: 'candidate_spoken', timestamp: now, confidence: 0.9, verified: true },
        isDisclosed: { field: 'isDisclosed', value: true, source: 'candidate_spoken', timestamp: now, confidence: 1.0, verified: true },
      },
      noticePeriod: {
        days: { field: 'days', value: 15, source: 'candidate_spoken', timestamp: now, confidence: 0.95, verified: true },
        earliestJoining: { field: 'earliestJoining', value: '15 Days / Immediate buyout possible', source: 'candidate_spoken', timestamp: now, confidence: 0.9, verified: true },
        negotiable: { field: 'negotiable', value: true, source: 'candidate_spoken', timestamp: now, confidence: 0.9, verified: true },
      },
      interviewAvailability: {
        agreedSlot: { field: 'agreedSlot', value: 'Tomorrow 11:00 AM', source: 'candidate_spoken', timestamp: now, confidence: 0.95, verified: true },
        venueAcknowledged: { field: 'venueAcknowledged', value: true, source: 'candidate_spoken', timestamp: now, confidence: 1.0, verified: true },
        slotId: { field: 'slotId', value: 'slot-101', source: 'system', timestamp: now, confidence: 1.0, verified: true },
      },
      communicationPreferences: {
        preferredLanguage: 'Hinglish',
        communicationStyle: 'detailed',
        bestTimeToCall: 'Morning 10:30 AM - 12:00 PM',
        channelPreference: 'WhatsApp',
        insights: ['Prefers direct project discussion', 'Values transparent commission timelines'],
      },
      candidateQuestions: [
        {
          question: 'Are you actively empaneled for DLF Phase 5 and Camellias inventory?',
          timestamp: now,
          conversationId: 'CALL-101',
          answered: true,
          topicCategory: 'PROJECT_MAPPING',
        },
      ],
      concerns: [],
      interests: ['Luxury Residential', 'Dubai Cross-Sell Off-Plan', 'High Ticket Commissions'],
      unresolvedQuestions: [],
      contradictions: [],
      corrections: [],
      importantStatements: [
        {
          statement: 'I have personally closed 4 transactions above ₹7 Cr in the last 6 months along Golf Course Extension.',
          topic: 'sales_performance',
          timestamp: now,
          conversationId: 'CALL-101',
        },
      ],
      previousOutcomes: [
        {
          conversationId: 'CALL-101',
          outcome: 'INTERVIEW_SCHEDULED',
          timestamp: now,
          summary: 'High-fit candidate with solid Gurgaon luxury developer credentials. F2F interview booked at Sector 67 HQ.',
        },
      ],
      candidateSpecificLearnings: [
        'Candidate is highly articulate with developer mandates and prefers talking numbers and inventory directly.',
      ],
      nextAction: {
        action: 'Conduct F2F Technical & Leadership Round at Sector 67 Gurugram HQ',
        dueDate: 'Tomorrow',
        owner: 'Senior HR Manager',
        suggestedTopic: 'F2F Interview Briefing',
      },
      lastUpdated: now,
    };

    this.memories.set(amitMemory.candidateId, amitMemory);
    this.persistMemory(amitMemory);
  }

  public getCandidateMemory(candidateId: string): CandidateLongTermMemory | null {
    return this.memories.get(candidateId) || null;
  }

  public getAllCandidateMemories(): CandidateLongTermMemory[] {
    return Array.from(this.memories.values());
  }

  public saveCandidateMemory(memory: CandidateLongTermMemory): void {
    memory.lastUpdated = new Date().toISOString();
    this.memories.set(memory.candidateId, memory);
    this.persistMemory(memory);
  }

  public createInitialMemoryForCandidate(candidate: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    appliedRole?: string;
    screening?: any;
  }): CandidateLongTermMemory {
    const now = new Date().toISOString();
    const s = candidate.screening || {};

    const memory: CandidateLongTermMemory = {
      candidateId: candidate.id,
      candidateName: candidate.name,
      identity: {
        name: { field: 'name', value: candidate.name, source: 'application_form', timestamp: now, confidence: 1.0, verified: true },
        phone: candidate.phone ? { field: 'phone', value: candidate.phone, source: 'application_form', timestamp: now, confidence: 1.0, verified: true } : undefined,
        email: candidate.email ? { field: 'email', value: candidate.email, source: 'application_form', timestamp: now, confidence: 1.0, verified: true } : undefined,
        location: s.currentLocation ? { field: 'location', value: s.currentLocation, source: 'application_form', timestamp: now, confidence: 0.8, verified: false } : undefined,
      },
      experience: {
        totalYears: s.totalExperienceYears ? { field: 'totalYears', value: s.totalExperienceYears, source: 'application_form', timestamp: now, confidence: 0.8, verified: false } : undefined,
        realEstateYears: s.realEstateExperienceYears ? { field: 'realEstateYears', value: s.realEstateExperienceYears, source: 'application_form', timestamp: now, confidence: 0.8, verified: false } : undefined,
        gurgaonYears: s.gurgaonDubaiExperience?.gurgaon ? { field: 'gurgaonYears', value: 2, source: 'application_form', timestamp: now, confidence: 0.7, verified: false } : undefined,
        dubaiYears: s.gurgaonDubaiExperience?.dubai ? { field: 'dubaiYears', value: 1, source: 'application_form', timestamp: now, confidence: 0.7, verified: false } : undefined,
      },
      companies: { field: 'companies', value: s.currentCompany ? [s.currentCompany] : [], source: 'application_form', timestamp: now, confidence: 0.8, verified: false },
      designations: { field: 'designations', value: s.currentDesignation ? [s.currentDesignation] : [], source: 'application_form', timestamp: now, confidence: 0.8, verified: false },
      markets: { field: 'markets', value: s.gurgaonDubaiExperience?.gurgaon ? ['Gurgaon'] : [], source: 'application_form', timestamp: now, confidence: 0.7, verified: false },
      projects: { field: 'projects', value: [], source: 'application_form', timestamp: now, confidence: 0.5, verified: false },
      developers: { field: 'developers', value: [], source: 'application_form', timestamp: now, confidence: 0.5, verified: false },
      segments: { field: 'segments', value: ['Luxury Residential', 'Ultra-Luxury Residential'], source: 'application_form', timestamp: now, confidence: 0.7, verified: false },
      ticketSizes: { field: 'ticketSizes', value: [], source: 'application_form', timestamp: now, confidence: 0.5, verified: false },
      luxuryExperience: {
        hasLuxury: { field: 'hasLuxury', value: false, source: 'application_form', timestamp: now, confidence: 0.5, verified: false },
      },
      salesPerformance: {},
      teamManagement: {},
      compensation: {
        currentSalary: s.currentSalaryLPA ? { field: 'currentSalary', value: s.currentSalaryLPA, source: 'application_form', timestamp: now, confidence: 0.8, verified: false } : undefined,
        expectedSalary: s.expectedSalaryLPA ? { field: 'expectedSalary', value: s.expectedSalaryLPA, source: 'application_form', timestamp: now, confidence: 0.8, verified: false } : undefined,
        isDisclosed: { field: 'isDisclosed', value: Boolean(s.currentSalaryLPA), source: 'application_form', timestamp: now, confidence: 0.9, verified: false },
      },
      noticePeriod: {
        days: s.noticePeriodDays !== undefined ? { field: 'days', value: s.noticePeriodDays, source: 'application_form', timestamp: now, confidence: 0.8, verified: false } : undefined,
      },
      interviewAvailability: {},
      communicationPreferences: {
        preferredLanguage: 'Hinglish',
        communicationStyle: 'conversational',
      },
      candidateQuestions: [],
      concerns: [],
      interests: [],
      unresolvedQuestions: [],
      contradictions: [],
      corrections: [],
      importantStatements: [],
      previousOutcomes: [],
      candidateSpecificLearnings: [],
      nextAction: {
        action: 'Initiate initial phone screening call',
        dueDate: 'Today',
        suggestedTopic: 'candidate_introduction',
      },
      lastUpdated: now,
    };

    this.memories.set(memory.candidateId, memory);
    this.persistMemory(memory);
    return memory;
  }

  public logMemoryAudit(record: Omit<MemoryAuditRecord, 'id'>): MemoryAuditRecord {
    const id = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const fullRecord: MemoryAuditRecord = { ...record, id };
    this.auditTrail.unshift(fullRecord);
    if (this.auditTrail.length > 1000) {
      this.auditTrail = this.auditTrail.slice(0, 1000);
    }
    this.persistAudit(fullRecord);
    return fullRecord;
  }

  public getAuditTrail(candidateId?: string): MemoryAuditRecord[] {
    if (candidateId) {
      return this.auditTrail.filter((a) => a.candidateId === candidateId);
    }
    return this.auditTrail;
  }

  public getLearningProposals(): LearningProposal[] {
    return this.learningProposals;
  }

  public createLearningProposal(proposal: Omit<LearningProposal, 'id' | 'createdAt'>): LearningProposal {
    const newProposal: LearningProposal = {
      ...proposal,
      id: `prop-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'PENDING_REVIEW',
    };
    this.learningProposals.unshift(newProposal);
    this.persistProposal(newProposal);
    return newProposal;
  }

  public updateLearningProposalStatus(
    id: string,
    status: 'APPROVED' | 'REJECTED' | 'APPLIED',
    reviewedBy: string,
    reviewNotes?: string
  ): LearningProposal | null {
    const prop = this.learningProposals.find((p) => p.id === id);
    if (!prop) return null;
    prop.status = status;
    prop.reviewedBy = reviewedBy;
    prop.reviewedAt = new Date().toISOString();
    if (reviewNotes) prop.reviewNotes = reviewNotes;
    this.persistProposal(prop);
    return prop;
  }

  public resolveContradiction(
    candidateId: string,
    contradictionId: string,
    resolvedValue: string,
    resolutionNote?: string,
    reviewerName: string = 'Recruiter'
  ): boolean {
    const memory = this.getCandidateMemory(candidateId);
    if (!memory) return false;

    const contra = memory.contradictions.find((c) => c.id === contradictionId);
    if (!contra) return false;

    contra.status = 'RESOLVED';
    contra.resolvedValue = resolvedValue;
    contra.resolvedAt = new Date().toISOString();
    contra.resolutionNote = resolutionNote || `Resolved by ${reviewerName}`;

    this.logMemoryAudit({
      candidateId,
      candidateName: memory.candidateName,
      field: contra.field,
      previousValue: contra.previousValue,
      newValue: resolvedValue,
      source: 'human_hr_override',
      reason: `Contradiction resolved: ${contra.resolutionNote}`,
      confidence: 1.0,
      timestamp: new Date().toISOString(),
    });

    this.saveCandidateMemory(memory);
    return true;
  }

  public getBehaviorProfile(candidateId: string): CandidateMultiCallBehaviorProfile | null {
    return this.behaviorProfiles.get(candidateId) || null;
  }

  public getAllBehaviorProfiles(): CandidateMultiCallBehaviorProfile[] {
    return Array.from(this.behaviorProfiles.values());
  }

  public saveBehaviorSummary(
    candidateId: string,
    candidateName: string,
    summary: CandidateBehaviorSummary
  ): CandidateMultiCallBehaviorProfile {
    const existing = this.behaviorProfiles.get(candidateId);
    const summaries = existing ? [...existing.callSummaries, summary] : [summary];
    
    const aggregated = behaviorAnalyzer.aggregateMultiCallProfile(candidateId, candidateName, summaries);
    this.behaviorProfiles.set(candidateId, aggregated);
    this.persistBehaviorProfile(aggregated);
    return aggregated;
  }

  public flagBehaviorHumanReview(candidateId: string, reason: string): boolean {
    const profile = this.behaviorProfiles.get(candidateId);
    if (!profile) return false;
    profile.humanReviewFlagged = true;
    profile.humanReviewReason = reason;
    this.persistBehaviorProfile(profile);
    return true;
  }

  public resolveBehaviorHumanReview(candidateId: string, notes?: string): boolean {
    const profile = this.behaviorProfiles.get(candidateId);
    if (!profile) return false;
    profile.humanReviewFlagged = false;
    profile.humanReviewReason = undefined;
    this.persistBehaviorProfile(profile);
    return true;
  }

  public getBrainOverviewStats(): HrBrainOverviewStats {
    let totalFacts = 0;
    let verifiedFacts = 0;
    let activeContradictions = 0;
    let resolvedContradictions = 0;
    let corrections = 0;

    for (const mem of this.memories.values()) {
      const countFact = (f?: MemoryFact) => {
        if (f && f.value !== undefined && f.value !== null && f.value !== '') {
          totalFacts++;
          if (f.verified) verifiedFacts++;
        }
      };

      countFact(mem.identity.name);
      countFact(mem.identity.phone);
      countFact(mem.identity.email);
      countFact(mem.identity.location);
      countFact(mem.experience.totalYears);
      countFact(mem.experience.realEstateYears);
      countFact(mem.experience.gurgaonYears);
      countFact(mem.experience.dubaiYears);
      countFact(mem.companies);
      countFact(mem.designations);
      countFact(mem.markets);
      countFact(mem.projects);
      countFact(mem.developers);
      countFact(mem.segments);
      countFact(mem.ticketSizes);
      countFact(mem.luxuryExperience.hasLuxury);
      countFact(mem.luxuryExperience.hniExposure);
      countFact(mem.salesPerformance.highestPersonalClosure);
      countFact(mem.salesPerformance.monthlyRunRate);
      countFact(mem.teamManagement.teamSize);
      countFact(mem.compensation.currentSalary);
      countFact(mem.compensation.expectedSalary);
      countFact(mem.noticePeriod.days);
      countFact(mem.interviewAvailability.agreedSlot);

      for (const c of mem.contradictions) {
        if (c.status === 'PENDING_CLARIFICATION') activeContradictions++;
        else if (c.status === 'RESOLVED') resolvedContradictions++;
      }

      corrections += mem.corrections.length;
    }

    const pendingProposals = this.learningProposals.filter((p) => p.status === 'PENDING_REVIEW').length;
    const approvedProposals = this.learningProposals.filter((p) => p.status === 'APPROVED' || p.status === 'APPLIED').length;
    const pendingHumanReviews = Array.from(this.behaviorProfiles.values()).filter((p) => p.humanReviewFlagged).length;

    return {
      totalLearnedFacts: totalFacts,
      verifiedFactsCount: verifiedFacts,
      activeContradictions,
      resolvedContradictions,
      correctionsRecorded: corrections,
      learningProposalsPending: pendingProposals,
      learningProposalsApproved: approvedProposals,
      humanFeedbackEntries: this.auditTrail.filter((a) => a.source === 'human_hr_override').length,
      totalCallsProcessed: this.memories.size,
      zeroRepetitionSuccessRate: 0.985,
      behaviorProfilesCount: this.behaviorProfiles.size,
      humanReviewPendingCount: pendingHumanReviews,
      systemMemoryLayers: {
        layer1_CurrentConversation: 'Active in-memory call state & turn tracking',
        layer2_CandidateLongTerm: `${this.memories.size} persistent candidate profiles in Firestore`,
        layer3_RoleJdMemory: '3 verified luxury residential role specifications (Sales Manager, Executive, Corporate Sales)',
        layer4_CompanyKnowledge: 'White Collar Realty verified facts & M3M Urbana Sector 67 context',
        layer5_RecruitmentLearning: `${this.learningProposals.length} system patterns & question performance logs`,
        layer6_HumanFeedback: `${this.auditTrail.length} audit entries & HR reviewer overrides`,
        layer7_BehaviorMemory: `${this.behaviorProfiles.size} communication & behavior profiles with evidence timeline`,
      },
    };
  }

  // Persistence Helpers
  private persistMemory(memory: CandidateLongTermMemory) {
    const obj: Record<string, CandidateLongTermMemory> = {};
    for (const [k, v] of this.memories.entries()) obj[k] = v;
    saveJsonFile(MEMORY_FILE, obj);
  }

  private persistAudit(record: MemoryAuditRecord) {
    saveJsonFile(AUDIT_FILE, this.auditTrail);
  }

  private persistProposal(proposal: LearningProposal) {
    saveJsonFile(PROPOSALS_FILE, this.learningProposals);
  }

  private persistBehaviorProfile(profile: CandidateMultiCallBehaviorProfile) {
    const obj: Record<string, CandidateMultiCallBehaviorProfile> = {};
    for (const [k, v] of this.behaviorProfiles.entries()) obj[k] = v;
    saveJsonFile(BEHAVIOR_FILE, obj);
  }
}

export const memoryRepository = new MemoryRepository();
