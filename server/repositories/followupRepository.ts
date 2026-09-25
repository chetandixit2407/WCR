export type FollowupType =
  | 'CALLBACK'
  | 'MISSED_CALL'
  | 'INTERVIEW_REMINDER'
  | 'MISSED_INTERVIEW'
  | 'WHATSAPP'
  | 'EMAIL'
  | 'RETRY';

export type FollowupStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface PersistentFollowupRecord {
  id: string;
  candidateId: string;
  candidateName: string;
  phone?: string;
  appliedRole?: string;
  type: FollowupType | string;
  scheduledAt: string;
  status: FollowupStatus;
  attemptNumber: number;
  reason?: string;
  channel?: string;
  lastAttemptAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export class FollowupRepository {
  private localCache: Map<string, PersistentFollowupRecord> = new Map();

  constructor() {
    this.seedInitial();
  }

  private seedInitial() {
    const now = new Date().toISOString();
    const seed1: PersistentFollowupRecord = {
      id: 'fol-seed-001',
      candidateId: 'cand-3',
      candidateName: 'Vikram Malhotra',
      phone: '+91 98112 00003',
      appliedRole: 'Sales Manager (Luxury Real Estate)',
      type: 'CALLBACK',
      scheduledAt: now,
      status: 'PENDING',
      attemptNumber: 1,
      reason: 'Candidate requested callback during afternoon hours',
      channel: 'AI Voice Calling',
      createdAt: now,
      updatedAt: now,
    };
    this.localCache.set(seed1.id, seed1);
  }

  public async createFollowup(
    item: Omit<PersistentFollowupRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<PersistentFollowupRecord> {
    const now = new Date().toISOString();
    const id = item.id || `fol-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const record: PersistentFollowupRecord = {
      ...item,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.localCache.set(record.id, record);
    return record;
  }

  public async getFollowupsForCandidate(candidateId: string): Promise<PersistentFollowupRecord[]> {
    return Array.from(this.localCache.values()).filter((f) => f.candidateId === candidateId);
  }

  public async getPendingFollowups(): Promise<PersistentFollowupRecord[]> {
    return Array.from(this.localCache.values()).filter((f) => f.status === 'PENDING');
  }

  public async updateFollowupStatus(
    id: string,
    status: FollowupStatus,
    completedAt?: string
  ): Promise<boolean> {
    const now = new Date().toISOString();
    const item = this.localCache.get(id);
    if (item) {
      item.status = status;
      item.updatedAt = now;
      if (completedAt) item.completedAt = completedAt;
      return true;
    }
    return false;
  }

  public async getAllFollowups(): Promise<PersistentFollowupRecord[]> {
    return Array.from(this.localCache.values());
  }
}

export const followupRepository = new FollowupRepository();
