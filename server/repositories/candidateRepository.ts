import { Candidate } from '../../src/types';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const LOCAL_JSON_FILE = path.join(DATA_DIR, 'candidates.json');

export interface CallingLockResult {
  success: boolean;
  reason?: string;
  activeCallId?: string;
  candidate?: Candidate;
}

export class CandidateRepository {
  private localCache: Map<string, Candidate> = new Map();
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    this.loadFromLocalJson();
    this.isInitialized = true;
  }

  private loadFromLocalJson() {
    try {
      if (fs.existsSync(LOCAL_JSON_FILE)) {
        const raw = fs.readFileSync(LOCAL_JSON_FILE, 'utf-8');
        const list: Candidate[] = JSON.parse(raw);
        for (const c of list) {
          this.localCache.set(c.id, c);
        }
      }
    } catch (e) {
      console.warn('[CandidateRepository] Local JSON load error:', e);
    }
  }

  private saveToLocalJson() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const list = Array.from(this.localCache.values());
      fs.writeFileSync(LOCAL_JSON_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[CandidateRepository] Local JSON save error:', e);
    }
  }

  /**
   * Retrieve a candidate by stable ID
   */
  public async getCandidate(candidateId: string): Promise<Candidate | null> {
    if (this.localCache.has(candidateId)) {
      return this.localCache.get(candidateId)!;
    }
    return null;
  }

  /**
   * Retrieve all candidates
   */
  public async getAllCandidates(): Promise<Candidate[]> {
    return Array.from(this.localCache.values());
  }

  /**
   * Save or overwrite a candidate document
   */
  public async saveCandidate(candidate: Candidate): Promise<void> {
    const updatedCandidate: Candidate = {
      ...candidate,
    };

    this.localCache.set(candidate.id, updatedCandidate);
    this.saveToLocalJson();
  }

  /**
   * Partial update for a candidate
   */
  public async updateCandidate(candidateId: string, partial: Partial<Candidate>): Promise<Candidate | null> {
    let candidate = await this.getCandidate(candidateId);
    if (!candidate) return null;

    const merged: Candidate = {
      ...candidate,
      ...partial,
      id: candidateId, // Guarantee immutable ID
    };

    await this.saveCandidate(merged);
    return merged;
  }

  /**
   * Delete a candidate
   */
  public async deleteCandidate(candidateId: string): Promise<boolean> {
    const deleted = this.localCache.delete(candidateId);
    this.saveToLocalJson();
    return deleted;
  }

  /**
   * Rule 16 Calling Lock: Atomically acquire lock before initiating an AI or Vapi call
   */
  public async acquireCallingLock(
    candidateId: string,
    callId: string,
    lockTimeoutMinutes: number = 10
  ): Promise<CallingLockResult> {
    const now = new Date();
    const nowIso = now.toISOString();

    const local = this.localCache.get(candidateId);
    if (local) {
      const isCurrentlyCalling = (local as any).isCalling === true;
      const callStartedAt = (local as any).callStartedAt ? new Date((local as any).callStartedAt).getTime() : 0;
      const lockExpired = now.getTime() - callStartedAt > lockTimeoutMinutes * 60 * 1000;

      if (isCurrentlyCalling && !lockExpired && (local as any).activeCallId !== callId) {
        return { success: false, reason: 'ALREADY_IN_CALL', activeCallId: (local as any).activeCallId };
      }

      (local as any).isCalling = true;
      (local as any).activeCallId = callId;
      (local as any).callStartedAt = nowIso;
      this.saveToLocalJson();
      return { success: true, candidate: local };
    }

    return { success: true };
  }

  /**
   * Rule 16 Calling Lock: Atomically release lock after call ends
   */
  public async releaseCallingLock(candidateId: string, callId?: string): Promise<boolean> {
    const nowIso = new Date().toISOString();

    const local = this.localCache.get(candidateId);
    if (local) {
      if (!callId || (local as any).activeCallId === callId || !(local as any).activeCallId) {
        (local as any).isCalling = false;
        (local as any).activeCallId = null;
        (local as any).callEndedAt = nowIso;
        this.saveToLocalJson();
      }
    }

    return true;
  }
}

export const candidateRepository = new CandidateRepository();
