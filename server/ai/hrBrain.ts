import { GoogleGenAI } from '@google/genai';
import {
  CandidateLongTermMemory,
  NextCallBrief,
  LearningProposal,
  HumanFeedbackRecord,
  HrBrainOverviewStats,
  CallRecord,
  CandidateBehaviorReport,
  RealTimeBehaviorState,
} from '../../src/types';
import { memoryRepository } from '../repositories/memoryRepository';
import { conversationRepository } from '../repositories/conversationRepository';
import { behaviorRepository } from '../repositories/behaviorRepository';
import { memoryManager } from './memoryManager';
import { conversationAnalyzer, PostCallAnalysisResult } from './conversationAnalyzer';
import { candidateBehaviorAnalyzer } from './behaviorAnalyzer';
import { decisionEngine } from './decisionEngine';
import { learningEngine } from './learningEngine';

export class SingleAiHrBrain {
  /**
   * 1. Get or initialize long term memory for a candidate
   */
  public getCandidateMemory(candidateId: string): CandidateLongTermMemory | null {
    return memoryRepository.getCandidateMemory(candidateId);
  }

  public getOrCreateCandidateMemory(candidate: any): CandidateLongTermMemory {
    return memoryManager.getOrCreateCandidateMemory(candidate);
  }

  /**
   * 2. Generate Next Call Brief (Rule 8, 9, 33, 34)
   */
  public getNextCallBrief(candidate: any, callHistory: CallRecord[] = []): NextCallBrief {
    // Ensure memory exists
    memoryManager.getOrCreateCandidateMemory(candidate);
    return decisionEngine.generateNextCallBrief(candidate, callHistory);
  }

  /**
   * 3. Sliced Memory Retrieval (Rule 30 & 31)
   */
  public getRelevantMemoryLayers(
    candidateId: string,
    contextType: 'general_screening' | 'salary_negotiation' | 'luxury_sales_scenario' | 'interview_scheduling' = 'general_screening'
  ) {
    return memoryManager.retrieveRelevantMemoryLayers(candidateId, contextType);
  }

  /**
   * 4. Post-Call Analysis & Fact Persistence (Rule 1, 4, 5, 41)
   */
  public async processCallCompletion(params: {
    candidate: any;
    transcript: any[];
    callScenario: string;
    callDuration?: number;
    availableSlots?: any[];
    bookedSlotId?: string;
    conversationId?: string;
    genAIClient?: GoogleGenAI | null;
  }): Promise<PostCallAnalysisResult> {
    const result = await conversationAnalyzer.analyzeCompletedCall(params);

    // Persist conversation record in repository
    const record: CallRecord = {
      id: params.conversationId || `CALL-${Date.now()}`,
      candidateId: params.candidate?.id || 'cand-unknown',
      candidateName: params.candidate?.name || 'Candidate',
      timestamp: new Date().toISOString(),
      scenario: (params.callScenario as any) || 'screening',
      durationSeconds: params.callDuration || 60,
      transcript: params.transcript || [],
      summary: result.summary,
      outcome: result.statusAnalysis.candidateStatus,
      extractedFields: result.extractedFields,
      callbackTime: result.statusAnalysis.callbackTime,
      declineReason: result.statusAnalysis.declineReason,
      conversationMemory: {
        candidate_name: params.candidate?.name || '',
        target_role: params.candidate?.appliedRole || '',
        current_company: result.extractedFields['currentCompany'] || '',
        designation: result.extractedFields['currentDesignation'] || '',
        total_experience: `${result.extractedFields['totalExperienceYears'] || 3} years`,
        real_estate_experience: `${result.extractedFields['realEstateExperienceYears'] || 2} years`,
        gurgaon_experience: 'Yes',
        dubai_experience: 'Unconfirmed',
        current_salary: result.extractedFields['currentSalaryLPA'] || '',
        expected_salary: result.extractedFields['expectedSalaryLPA'] || '',
        salary_not_disclosed: false,
        current_location: result.extractedFields['currentLocation'] || 'Gurgaon',
        notice_period: `${result.extractedFields['noticePeriodDays'] || 30} days`,
        earliest_joining_date: 'Immediate',
        interested: result.statusAnalysis.candidateStatus === 'Declined - Do Not Call' ? 'No' : 'Yes',
        interview_date: result.afterCallAction.interview_date,
        interview_time: result.afterCallAction.interview_time,
        conversation_status: result.statusAnalysis.candidateStatus,
        missing_information: result.afterCallAction.missing_information,
        next_action: result.afterCallAction.next_action,
      },
      hrDecisionOutcome: result.statusAnalysis.hrDecisionOutcome as any,
      afterCallAction: result.afterCallAction as any,
      behaviorReport: result.behaviorReport,
    };

    conversationRepository.saveConversation(record);
    return result;
  }

  /**
   * 5. Record Human HR Feedback (Rule 25)
   */
  public submitHumanFeedback(feedback: {
    candidateId: string;
    candidateName: string;
    conversationId?: string;
    reviewerName: string;
    changeType: any;
    aiRecommendation: any;
    humanDecision: any;
  }): HumanFeedbackRecord {
    return learningEngine.recordHumanFeedback(feedback);
  }

  /**
   * 6. Resolve Contradiction (Rule 5)
   */
  public resolveCandidateContradiction(
    candidateId: string,
    contradictionId: string,
    resolvedValue: string,
    resolutionNote?: string,
    reviewerName?: string
  ): boolean {
    return memoryRepository.resolveContradiction(
      candidateId,
      contradictionId,
      resolvedValue,
      resolutionNote,
      reviewerName
    );
  }

  /**
   * 7. Learning Proposals Management (Rule 16 & 26)
   */
  public getLearningProposals(): LearningProposal[] {
    return memoryRepository.getLearningProposals();
  }

  public reviewLearningProposal(
    proposalId: string,
    status: 'APPROVED' | 'REJECTED' | 'APPLIED',
    reviewerName: string,
    reviewNotes?: string
  ): LearningProposal | null {
    return memoryRepository.updateLearningProposalStatus(
      proposalId,
      status,
      reviewerName,
      reviewNotes
    );
  }

  /**
   * 8. Candidate Behavior & Conversation Intelligence (Rules 1–43)
   */
  public getCandidateBehaviorHistory(candidateId: string): CandidateBehaviorReport[] {
    return behaviorRepository.getCandidateBehaviorHistory(candidateId);
  }

  public getLatestBehaviorReport(candidateId: string): CandidateBehaviorReport | null {
    return behaviorRepository.getLatestBehaviorReport(candidateId);
  }

  public getFlaggedForHumanReview(): CandidateBehaviorReport[] {
    return behaviorRepository.getFlaggedForHumanReview();
  }

  public analyzeCandidateTurn(params: {
    turnText: string;
    previousAgentText?: string;
    turnIndex: number;
    callStage?: string;
    candidateName?: string;
    callId?: string;
    existingState?: RealTimeBehaviorState;
  }): RealTimeBehaviorState {
    return candidateBehaviorAnalyzer.analyzeCandidateTurn(params);
  }

  /**
   * 9. Brain Overview & System Metrics
   */
  public getBrainOverviewStats(): HrBrainOverviewStats {
    const baseStats = memoryRepository.getBrainOverviewStats();
    const allBehaviors = behaviorRepository.getAllCandidateBehaviorReports();
    const flagged = behaviorRepository.getFlaggedForHumanReview();
    return {
      ...baseStats,
      behaviorInsightsCount: allBehaviors.length,
      humanReviewRequiredCount: flagged.length,
    };
  }

  public getQuestionStats() {
    return conversationRepository.getAllQuestionStats();
  }

  public getScenarioStats() {
    return conversationRepository.getAllScenarioStats();
  }

  public getAuditTrail(candidateId?: string) {
    return memoryRepository.getAuditTrail(candidateId);
  }
}

export const aiHrBrain = new SingleAiHrBrain();
