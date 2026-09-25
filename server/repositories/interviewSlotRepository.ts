import { InterviewSlot } from '../../src/types';
import { INITIAL_INTERVIEW_SLOTS } from '../../src/data/mockCandidates';

export interface SlotBookingResult {
  success: boolean;
  reason?: 'SLOT_NOT_FOUND' | 'ALREADY_BOOKED' | 'CAPACITY_REACHED' | 'TRANSACTION_FAILED';
  slot?: InterviewSlot;
}

export class InterviewSlotRepository {
  private localCache: Map<string, InterviewSlot> = new Map();

  constructor() {
    this.initialize();
  }

  private initialize() {
    for (const slot of INITIAL_INTERVIEW_SLOTS) {
      this.localCache.set(slot.id, { ...slot });
    }
  }

  public async getAllSlots(): Promise<InterviewSlot[]> {
    return Array.from(this.localCache.values());
  }

  public async getSlot(slotId: string): Promise<InterviewSlot | null> {
    if (this.localCache.has(slotId)) {
      return this.localCache.get(slotId)!;
    }
    return null;
  }

  /**
   * Atomically book an interview slot
   */
  public async bookSlot(
    slotId: string,
    candidateId: string,
    candidateName: string
  ): Promise<SlotBookingResult> {
    const local = this.localCache.get(slotId);
    if (!local) return { success: false, reason: 'SLOT_NOT_FOUND' };
    if (!local.isAvailable || (local.bookedCount || 0) >= (local.maxCapacity || 1)) {
      return { success: false, reason: 'ALREADY_BOOKED' };
    }

    local.bookedCandidateId = candidateId;
    local.bookedCandidateName = candidateName;
    local.bookedCount = (local.bookedCount || 0) + 1;
    local.isAvailable = false;
    return { success: true, slot: local };
  }

  /**
   * Release or cancel an interview slot reservation
   */
  public async releaseSlot(slotId: string, candidateId?: string): Promise<boolean> {
    const local = this.localCache.get(slotId);
    if (local) {
      if (!candidateId || local.bookedCandidateId === candidateId) {
        local.bookedCandidateId = undefined;
        local.bookedCandidateName = undefined;
        local.bookedCount = 0;
        local.isAvailable = true;
      }
    }
    return true;
  }

  /**
   * Save or update an interview slot
   */
  public async saveSlot(slot: InterviewSlot): Promise<void> {
    this.localCache.set(slot.id, { ...slot });
  }
}

export const interviewSlotRepository = new InterviewSlotRepository();
