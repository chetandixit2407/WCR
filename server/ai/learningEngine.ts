import {
  CandidateLongTermMemory,
  LearningProposal,
  HumanFeedbackRecord,
  QuestionEffectivenessStat,
  ScenarioEffectivenessStat,
} from '../../src/types';
import { memoryRepository } from '../repositories/memoryRepository';
import { conversationRepository } from '../repositories/conversationRepository';

export interface InteractionLearningInput {
  candidateId: string;
  appliedRole: string;
  transcript: any[];
  candidateQuestions: string[];
  candidateObjections: string[];
  candidateConcerns: string[];
  candidateCorrections: any[];
  preferredLanguage?: string;
  responseStyle?: string;
  effectiveQuestions: string[];
  ineffectiveQuestions: string[];
  scenarioPresented?: string;
  scenarioOutcome?: string;
}

export class LearningEngine {
  /**
   * Process learnings from a completed interaction
   */
  public processInteractionLearnings(input: InteractionLearningInput): {
    candidateSpecificLearnings: string[];
    newProposalsGenerated: LearningProposal[];
  } {
    const memory = memoryRepository.getCandidateMemory(input.candidateId);
    const candidateLearnings: string[] = [];
    const newProposals: LearningProposal[] = [];

    // 1. Candidate-Specific Learning (Rule 14)
    if (memory) {
      if (input.preferredLanguage && input.preferredLanguage !== 'Auto (Hinglish/Hindi/English)') {
        memory.communicationPreferences.preferredLanguage = input.preferredLanguage as any;
        candidateLearnings.push(`Candidate prefers speaking in ${input.preferredLanguage}.`);
      }

      if (input.responseStyle) {
        memory.communicationPreferences.communicationStyle = input.responseStyle as any;
        candidateLearnings.push(`Candidate communicates with ${input.responseStyle} style.`);
      }

      for (const obj of input.candidateObjections) {
        if (!memory.communicationPreferences.objectionNotes) {
          memory.communicationPreferences.objectionNotes = [];
        }
        if (!memory.communicationPreferences.objectionNotes.includes(obj)) {
          memory.communicationPreferences.objectionNotes.push(obj);
          candidateLearnings.push(`Expressed concern/objection: "${obj}".`);
        }
      }

      for (const q of input.candidateQuestions) {
        const alreadyHas = memory.candidateQuestions.some((cq) => cq.question.toLowerCase() === q.toLowerCase());
        if (!alreadyHas) {
          memory.candidateQuestions.push({
            question: q,
            timestamp: new Date().toISOString(),
            conversationId: 'CALL-LATEST',
            answered: true,
            topicCategory: this.categorizeQuestion(q),
          });
        }
      }

      for (const cl of candidateLearnings) {
        if (!memory.candidateSpecificLearnings.includes(cl)) {
          memory.candidateSpecificLearnings.push(cl);
        }
      }

      memoryRepository.saveCandidateMemory(memory);
    }

    // 2. Question & Scenario Performance Logging (Rule 17 & 18)
    for (const qText of input.effectiveQuestions) {
      conversationRepository.logQuestionOutcome(qText, 'general', input.appliedRole, true, false);
    }
    for (const qText of input.ineffectiveQuestions) {
      conversationRepository.logQuestionOutcome(qText, 'general', input.appliedRole, false, true);
    }

    // 3. System-Wide Pattern Detection & Learning Proposals (Rule 15 & 16)
    this.checkForSystemLearningPatterns(input, newProposals);

    return {
      candidateSpecificLearnings: candidateLearnings,
      newProposalsGenerated: newProposals,
    };
  }

  /**
   * Scan memory repository for recurring candidate questions/objections and propose human-approved changes
   */
  private checkForSystemLearningPatterns(
    input: InteractionLearningInput,
    newProposals: LearningProposal[]
  ): void {
    const allMemories = memoryRepository.getAllCandidateMemories();
    const existingProposals = memoryRepository.getLearningProposals();

    // Check pattern 1: Candidates asking about DLF / Golf Course Extension luxury projects
    const luxuryInquiries = allMemories.flatMap((m) =>
      m.candidateQuestions.filter((q) =>
        /dlf|camellias|golf course|ultra-luxury|m3m golfestate/i.test(q.question)
      )
    );

    if (luxuryInquiries.length >= 3) {
      const alreadyProposed = existingProposals.some((p) => p.pattern.includes('DLF / luxury inventories'));
      if (!alreadyProposed) {
        const prop = memoryRepository.createLearningProposal({
          type: 'LEARNING_PROPOSAL',
          pattern: 'Candidates repeatedly inquire if White Collar Realty is directly empaneled for DLF & Golf Course Extension ultra-luxury inventories.',
          evidenceCount: luxuryInquiries.length,
          evidenceExamples: luxuryInquiries.slice(0, 3).map((q) => q.question),
          affectedRoles: ['Sales Manager (Luxury Real Estate)', 'Senior Property Consultant'],
          category: 'PROJECT_INQUIRY',
          suggestedChange: 'Mention direct empanelment with DLF Phase 5, M3M, and Golf Course Extension developer mandates upfront during role briefing.',
          risk: 'LOW',
          requiresHumanApproval: true,
          status: 'PENDING_REVIEW',
        });
        newProposals.push(prop);
      }
    }

    // Check pattern 2: Notice period buyout inquiries
    const noticeInquiries = allMemories.filter((m) => m.noticePeriod?.days?.value && m.noticePeriod.days.value > 30);
    if (noticeInquiries.length >= 4) {
      const alreadyProposed = existingProposals.some((p) => p.pattern.includes('notice period negotiation'));
      if (!alreadyProposed) {
        const prop = memoryRepository.createLearningProposal({
          type: 'LEARNING_PROPOSAL',
          pattern: 'Multiple strong candidates have 45–60 day notice periods and inquire about early release / notice buyout policies.',
          evidenceCount: noticeInquiries.length,
          evidenceExamples: noticeInquiries.slice(0, 3).map((m) => `${m.candidateName}: ${m.noticePeriod?.days?.value} days notice`),
          affectedRoles: ['Sales Manager (Luxury Real Estate)', 'Property Consultant'],
          category: 'SCHEDULE_OPTIMIZATION',
          suggestedChange: 'Inform qualified candidates that White Collar Realty considers notice period buyouts for immediate-impact sales leaders.',
          risk: 'MEDIUM',
          requiresHumanApproval: true,
          status: 'PENDING_REVIEW',
        });
        newProposals.push(prop);
      }
    }
  }

  /**
   * Record Human HR Feedback and update decision context (Rule 25)
   */
  public recordHumanFeedback(feedback: {
    candidateId: string;
    candidateName: string;
    conversationId?: string;
    reviewerName: string;
    changeType: any;
    aiRecommendation: any;
    humanDecision: any;
  }): HumanFeedbackRecord {
    // Generate learning statement
    const learningStatement = `Human reviewer (${feedback.reviewerName}) adjusted ${feedback.changeType}: ${feedback.humanDecision.reason}`;
    
    const record = conversationRepository.saveHumanFeedback({
      ...feedback,
      learningGenerated: learningStatement,
    });

    // Update candidate memory audit trail
    memoryRepository.logMemoryAudit({
      candidateId: feedback.candidateId,
      candidateName: feedback.candidateName,
      field: feedback.changeType,
      previousValue: JSON.stringify(feedback.aiRecommendation),
      newValue: JSON.stringify(feedback.humanDecision),
      source: 'human_hr_override',
      conversationId: feedback.conversationId,
      reason: feedback.humanDecision.reason,
      confidence: 1.0,
      timestamp: new Date().toISOString(),
    });

    // Update candidate long term memory if status was modified
    const memory = memoryRepository.getCandidateMemory(feedback.candidateId);
    if (memory) {
      if (feedback.humanDecision.status) {
        memory.nextAction.action = `HR Review Action: ${feedback.humanDecision.status} - ${feedback.humanDecision.reason}`;
      }
      memory.candidateSpecificLearnings.push(`HR Decision: ${feedback.humanDecision.reason}`);
      memoryRepository.saveCandidateMemory(memory);
    }

    return record;
  }

  private categorizeQuestion(q: string): string {
    if (/incentive|salary|ctc|package|commission/i.test(q)) return 'COMPENSATION';
    if (/dlf|project|inventory|builder|location|gurgaon|dubai/i.test(q)) return 'PROJECT_PORTFOLIO';
    if (/timing|leave|tuesday|shift|hours/i.test(q)) return 'OFFICE_POLICY';
    if (/lead|crm|portal|calling/i.test(q)) return 'LEAD_SUPPORT';
    return 'GENERAL';
  }
}

export const learningEngine = new LearningEngine();
