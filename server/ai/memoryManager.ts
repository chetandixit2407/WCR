import {
  CandidateLongTermMemory,
  MemoryFact,
  CandidateMemoryContradiction,
  CandidateCorrectionRecord,
  FactSource,
} from '../../src/types';
import { memoryRepository } from '../repositories/memoryRepository';

export interface FactExtractionUpdate {
  field: string;
  value: any;
  source: FactSource;
  conversationId: string;
  confidence?: number;
  notes?: string;
  isCorrection?: boolean;
}

export class MemoryManager {
  /**
   * Get or create candidate long term memory
   */
  public getOrCreateCandidateMemory(candidate: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    appliedRole?: string;
    screening?: any;
  }): CandidateLongTermMemory {
    let memory = memoryRepository.getCandidateMemory(candidate.id);
    if (!memory) {
      memory = memoryRepository.createInitialMemoryForCandidate(candidate);
    }
    return memory;
  }

  /**
   * Record a single fact with provenance, handling Rule 5 (Contradiction detection) and Rule 6 (Priority)
   */
  public updateFact(
    candidateId: string,
    update: FactExtractionUpdate
  ): {
    updated: boolean;
    contradictionLogged?: CandidateMemoryContradiction;
    correctionLogged?: CandidateCorrectionRecord;
  } {
    const memory = memoryRepository.getCandidateMemory(candidateId);
    if (!memory) return { updated: false };

    const { field, value, source, conversationId, notes, isCorrection } = update;
    const confidence = update.confidence ?? 0.9;
    const now = new Date().toISOString();

    // Check existing fact in memory
    const existingFact = this.getFactByPath(memory, field);

    if (isCorrection) {
      // Rule 10: Learn from Candidate Corrections
      const correction: CandidateCorrectionRecord = {
        id: `corr-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: source === 'candidate_spoken' ? 'CANDIDATE_CORRECTION' : 'AI_CORRECTION',
        field,
        previousValue: existingFact?.value !== undefined ? String(existingFact.value) : 'None',
        correctValue: String(value),
        source,
        conversationId,
        timestamp: now,
        context: notes,
      };

      memory.corrections.push(correction);

      // Overwrite with high priority because candidate explicitly corrected it
      this.setFactByPath(memory, field, {
        field,
        value,
        source,
        conversationId,
        timestamp: now,
        confidence: 1.0,
        verified: true,
        lastVerifiedAt: now,
        notes: `Corrected by candidate: ${notes || ''}`,
        history: [
          ...(existingFact?.history || []),
          {
            value: existingFact?.value,
            source: existingFact?.source || 'system',
            timestamp: existingFact?.timestamp || now,
            conversationId: existingFact?.conversationId,
            reason: 'Previous value before candidate correction',
          },
        ],
      });

      memoryRepository.logMemoryAudit({
        candidateId,
        candidateName: memory.candidateName,
        field,
        previousValue: existingFact?.value,
        newValue: value,
        source,
        conversationId,
        reason: `Explicit Candidate Correction (Rule 10): ${notes || ''}`,
        confidence: 1.0,
        timestamp: now,
      });

      memoryRepository.saveCandidateMemory(memory);
      return { updated: true, correctionLogged: correction };
    }

    // Check for contradiction (Rule 5: Never blindly overwrite)
    if (
      existingFact &&
      existingFact.value !== undefined &&
      existingFact.value !== null &&
      existingFact.value !== '' &&
      !this.areValuesEquivalent(existingFact.value, value)
    ) {
      // Compare priority (Rule 6)
      const existingPriority = this.getSourcePriority(existingFact.source, existingFact.verified);
      const newPriority = this.getSourcePriority(source, false);

      // If existing fact was verified candidate spoken and new value is significantly different, log contradiction
      const contradictionId = `contra-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const contradiction: CandidateMemoryContradiction = {
        id: contradictionId,
        field,
        topic: this.getTopicForField(field),
        previousValue: String(existingFact.value),
        previousSource: existingFact.source,
        previousTimestamp: existingFact.timestamp,
        newValue: String(value),
        newSource: source,
        newTimestamp: now,
        conversationId,
        status: 'PENDING_CLARIFICATION',
      };

      memory.contradictions.push(contradiction);

      // If new source has higher priority (e.g. candidate spoken vs old application form), we update with contradiction notice
      if (newPriority > existingPriority) {
        this.setFactByPath(memory, field, {
          field,
          value,
          source,
          conversationId,
          timestamp: now,
          confidence,
          verified: false,
          lastVerifiedAt: now,
          notes: `Updated from ${existingFact.value} -> ${value} (Contradiction pending clarification)`,
          history: [
            ...(existingFact.history || []),
            {
              value: existingFact.value,
              source: existingFact.source,
              timestamp: existingFact.timestamp,
              conversationId: existingFact.conversationId,
              reason: 'Previous value before conflicting statement',
            },
          ],
        });

        memoryRepository.logMemoryAudit({
          candidateId,
          candidateName: memory.candidateName,
          field,
          previousValue: existingFact.value,
          newValue: value,
          source,
          conversationId,
          reason: `Contradiction detected (Rule 5 & 6) - Updated with new statement pending clarification`,
          confidence,
          timestamp: now,
        });
      } else {
        // Keep existing, just record contradiction and audit
        memoryRepository.logMemoryAudit({
          candidateId,
          candidateName: memory.candidateName,
          field,
          previousValue: existingFact.value,
          newValue: value,
          source,
          conversationId,
          reason: `Contradiction detected (Rule 5) - Retained verified existing value pending clarification`,
          confidence,
          timestamp: now,
        });
      }

      memoryRepository.saveCandidateMemory(memory);
      return { updated: true, contradictionLogged: contradiction };
    }

    // Standard non-conflicting fact update
    this.setFactByPath(memory, field, {
      field,
      value,
      source,
      conversationId,
      timestamp: now,
      confidence,
      verified: source === 'candidate_spoken' || source === 'human_hr_override',
      lastVerifiedAt: now,
      notes,
      history: existingFact?.history || [],
    });

    memoryRepository.logMemoryAudit({
      candidateId,
      candidateName: memory.candidateName,
      field,
      previousValue: existingFact?.value,
      newValue: value,
      source,
      conversationId,
      reason: notes || 'Fact extracted from conversation',
      confidence,
      timestamp: now,
    });

    memoryRepository.saveCandidateMemory(memory);
    return { updated: true };
  }

  /**
   * Batch update multiple facts extracted from a conversation
   */
  public updateCandidateMemoryBatch(
    candidateId: string,
    conversationId: string,
    extractedFields: Record<string, any>,
    source: FactSource = 'candidate_spoken'
  ): {
    updatedFieldsCount: number;
    contradictions: CandidateMemoryContradiction[];
    corrections: CandidateCorrectionRecord[];
  } {
    const memory = memoryRepository.getCandidateMemory(candidateId);
    if (!memory) return { updatedFieldsCount: 0, contradictions: [], corrections: [] };

    const contradictions: CandidateMemoryContradiction[] = [];
    const corrections: CandidateCorrectionRecord[] = [];
    let count = 0;

    for (const [key, rawVal] of Object.entries(extractedFields)) {
      if (rawVal === undefined || rawVal === null || rawVal === '') continue;

      let fieldPath = key;
      let val = rawVal;

      if (key === 'totalExperienceYears') {
        fieldPath = 'experience.totalYears';
        val = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal) || rawVal;
      } else if (key === 'realEstateExperienceYears') {
        fieldPath = 'experience.realEstateYears';
        val = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal) || rawVal;
      } else if (key === 'currentCompany') {
        fieldPath = 'companies';
        val = Array.isArray(rawVal) ? rawVal : [rawVal];
      } else if (key === 'currentDesignation') {
        fieldPath = 'designations';
        val = Array.isArray(rawVal) ? rawVal : [rawVal];
      } else if (key === 'currentSalaryLPA') {
        fieldPath = 'compensation.currentSalary';
      } else if (key === 'expectedSalaryLPA') {
        fieldPath = 'compensation.expectedSalary';
      } else if (key === 'noticePeriodDays') {
        fieldPath = 'noticePeriod.days';
        val = typeof rawVal === 'number' ? rawVal : parseInt(rawVal, 10) || rawVal;
      } else if (key === 'currentLocation') {
        fieldPath = 'identity.location';
      } else if (key === 'preferredInterviewSlot') {
        fieldPath = 'interviewAvailability.agreedSlot';
      } else if (key === 'interviewVenueConfirmed') {
        fieldPath = 'interviewAvailability.venueAcknowledged';
      } else if (key === 'highestPersonalClosure') {
        fieldPath = 'salesPerformance.highestPersonalClosure';
      } else if (key === 'ticketSizes') {
        fieldPath = 'ticketSizes';
        val = Array.isArray(rawVal) ? rawVal : [rawVal];
      } else if (key === 'developers') {
        fieldPath = 'developers';
        val = Array.isArray(rawVal) ? rawVal : [rawVal];
      }

      const res = this.updateFact(candidateId, {
        field: fieldPath,
        value: val,
        source,
        conversationId,
        confidence: 0.95,
      });

      if (res.updated) count++;
      if (res.contradictionLogged) contradictions.push(res.contradictionLogged);
      if (res.correctionLogged) corrections.push(res.correctionLogged);
    }

    return { updatedFieldsCount: count, contradictions, corrections };
  }

  /**
   * Layered Memory Retrieval (Rules 30 & 31)
   * Retrieves strictly the relevant slices for the given conversation focus
   */
  public retrieveRelevantMemoryLayers(
    candidateId: string,
    contextType: 'general_screening' | 'salary_negotiation' | 'luxury_sales_scenario' | 'interview_scheduling'
  ): {
    layer1_CurrentConversation: string;
    layer2_CandidateLongTerm: Partial<CandidateLongTermMemory>;
    layer3_RoleJdMemory: string;
    layer4_CompanyKnowledge: string;
    layer5_RecruitmentLearning: string[];
    layer6_HumanFeedback: string[];
  } {
    const memory = memoryRepository.getCandidateMemory(candidateId);
    
    // Slice layer 2 based on context
    const slicedL2: Partial<CandidateLongTermMemory> = {};
    if (memory) {
      slicedL2.candidateId = memory.candidateId;
      slicedL2.candidateName = memory.candidateName;
      slicedL2.identity = memory.identity;
      slicedL2.experience = memory.experience;
      slicedL2.companies = memory.companies;
      slicedL2.designations = memory.designations;
      slicedL2.contradictions = memory.contradictions.filter((c) => c.status === 'PENDING_CLARIFICATION');
      slicedL2.corrections = memory.corrections.slice(-3);
      slicedL2.communicationPreferences = memory.communicationPreferences;

      if (contextType === 'salary_negotiation') {
        slicedL2.compensation = memory.compensation;
        slicedL2.noticePeriod = memory.noticePeriod;
      } else if (contextType === 'luxury_sales_scenario') {
        slicedL2.luxuryExperience = memory.luxuryExperience;
        slicedL2.salesPerformance = memory.salesPerformance;
        slicedL2.ticketSizes = memory.ticketSizes;
        slicedL2.developers = memory.developers;
        slicedL2.markets = memory.markets;
      } else if (contextType === 'interview_scheduling') {
        slicedL2.interviewAvailability = memory.interviewAvailability;
        slicedL2.noticePeriod = memory.noticePeriod;
      } else {
        slicedL2.compensation = memory.compensation;
        slicedL2.luxuryExperience = memory.luxuryExperience;
        slicedL2.salesPerformance = memory.salesPerformance;
      }
    }

    // Layer 4: Company Knowledge
    const layer4 = 'White Collar Realty | M3M Urbana Business Park, Sector 67, Gurugram | Luxury Residential (DLF, M3M, Godrej, Emaar, Sobha, SmartWorld) | Gurugram & Dubai Prime Freehold';

    // Layer 5: Recruitment Learning (Approved Proposals)
    const approvedProposals = memoryRepository
      .getLearningProposals()
      .filter((p) => p.status === 'APPROVED' || p.status === 'APPLIED')
      .map((p) => p.suggestedChange);

    // Layer 6: Human Feedback
    const humanFeedback = memoryRepository
      .getAuditTrail(candidateId)
      .filter((a) => a.source === 'human_hr_override')
      .map((a) => `${a.field}: ${a.previousValue} -> ${a.newValue} (${a.reason})`);

    return {
      layer1_CurrentConversation: 'Active phone session',
      layer2_CandidateLongTerm: slicedL2,
      layer3_RoleJdMemory: 'Standard Luxury Sales Spec',
      layer4_CompanyKnowledge: layer4,
      layer5_RecruitmentLearning: approvedProposals,
      layer6_HumanFeedback: humanFeedback,
    };
  }

  // Helper to check value equality
  private areValuesEquivalent(valA: any, valB: any): boolean {
    if (valA === valB) return true;
    if (typeof valA === 'number' && typeof valB === 'number') return Math.abs(valA - valB) < 0.1;
    if (typeof valA === 'string' && typeof valB === 'string') {
      const cleanA = valA.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanB = valB.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA);
    }
    if (Array.isArray(valA) && Array.isArray(valB)) {
      if (valA.length !== valB.length) return false;
      return valA.every((item) => valB.includes(item));
    }
    return false;
  }

  private getSourcePriority(source: FactSource, verified: boolean): number {
    if (source === 'human_hr_override') return 100;
    if (source === 'candidate_spoken' && verified) return 80;
    if (source === 'candidate_spoken') return 60;
    if (source === 'candidate_message') return 50;
    if (source === 'application_form') return 40;
    return 20;
  }

  private getTopicForField(field: string): string {
    if (field.includes('experience')) return 'Total & Real Estate Experience';
    if (field.includes('salary') || field.includes('compensation')) return 'Current & Expected Compensation';
    if (field.includes('notice')) return 'Notice Period & Joining Timeline';
    if (field.includes('ticket')) return 'Ticket Size & Closures';
    if (field.includes('location')) return 'Current Location';
    return field;
  }

  private getFactByPath(obj: any, pathStr: string): MemoryFact | undefined {
    const parts = pathStr.split('.');
    let curr = obj;
    for (const p of parts) {
      if (!curr) return undefined;
      curr = curr[p];
    }
    return curr;
  }

  private setFactByPath(obj: any, pathStr: string, fact: MemoryFact): void {
    const parts = pathStr.split('.');
    let curr = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!curr[p] || typeof curr[p] !== 'object') {
        curr[p] = {};
      }
      curr = curr[p];
    }
    curr[parts[parts.length - 1]] = fact;
  }
}

export const memoryManager = new MemoryManager();
