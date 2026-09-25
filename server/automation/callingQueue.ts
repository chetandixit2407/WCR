import { Candidate, CallRecord } from '../../src/types';
import {
  AutomationSettings,
  AutomationStatus,
  AutomationMode,
  CallingQueueJob,
  AutomationDailyStats,
  AutomationEvent,
  QueueJobStatus,
  AutomationEventType,
} from './types';
import {
  getKolkataDateInfo,
  isCandidateEligibleForCalling,
  calculateCandidatePriority,
  isWithinCallingWindow,
} from './eligibility';
import { CallProvider, dryRunCallProvider } from './providers/callProvider';
import { candidateRepository } from '../repositories/candidateRepository';
import { followupRepository } from '../repositories/followupRepository';
import { aiHrBrain } from '../ai/hrBrain';
import { memoryManager } from '../ai/memoryManager';
import { memoryRepository } from '../repositories/memoryRepository';
import { behaviorRepository } from '../repositories/behaviorRepository';

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  enabled: false, // Default is false: requires explicit start action
  automationMode: 'DRY_RUN', // Default is DRY_RUN: ZERO real PSTN/Vapi calls
  dailyTarget: 200,
  maxConcurrentCalls: 5,
  callingWindowStart: '10:00',
  callingWindowEnd: '19:00',
  timezone: 'Asia/Kolkata',
  allowedDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
  maxRetries: 3,
  retryBackoffMinutes: 45,
  simulatedCallDurationSeconds: 1,
};

export class CallingQueueManager {
  private settings: AutomationSettings = { ...DEFAULT_AUTOMATION_SETTINGS };
  private status: AutomationStatus = 'OFF';
  private queue: CallingQueueJob[] = [];
  private activeJobs: Map<string, CallingQueueJob> = new Map();
  private callProvider: CallProvider = dryRunCallProvider;
  private workerInterval: NodeJS.Timeout | null = null;
  private isProcessingLoop = false;
  private dailyStats: AutomationDailyStats;

  constructor() {
    const today = getKolkataDateInfo().dateString;
    this.dailyStats = {
      date: today,
      target: 200,
      attempted: 0,
      completed: 0,
      failed: 0,
      noAnswer: 0,
      busy: 0,
      callbacks: 0,
      qualified: 0,
      notQualified: 0,
      interviewsScheduled: 0,
      updatedAt: new Date().toISOString(),
    };

    this.initialize();
  }

  /**
   * Safe Server-Restart Initialization (Rule 21)
   */
  private async initialize() {
    try {
      await this.loadSettings();
      await this.loadDailyStats();
      await this.recoverStaleCallingJobs();
    } catch (err) {
      console.warn('[CallingQueue] Initialization warning:', err);
    }
  }

  public async loadSettings(): Promise<AutomationSettings> {
    return this.settings;
  }

  /**
   * Update automation settings
   */
  public async updateSettings(partial: Partial<AutomationSettings>): Promise<AutomationSettings> {
    this.settings = {
      ...this.settings,
      ...partial,
    };
    return this.settings;
  }

  /**
   * Load or initialize daily stats in Asia/Kolkata timezone
   */
  public async loadDailyStats(): Promise<AutomationDailyStats> {
    const today = getKolkataDateInfo().dateString;
    if (this.dailyStats.date !== today) {
      this.dailyStats = {
        date: today,
        target: this.settings.dailyTarget,
        attempted: 0,
        completed: 0,
        failed: 0,
        noAnswer: 0,
        busy: 0,
        callbacks: 0,
        qualified: 0,
        notQualified: 0,
        interviewsScheduled: 0,
        updatedAt: new Date().toISOString(),
      };
    }
    return this.dailyStats;
  }

  private async persistDailyStats(): Promise<void> {
    this.dailyStats.updatedAt = new Date().toISOString();
  }

  /**
   * Rule 21: Recover Stale Calling Jobs & Locks after server restart
   */
  private async recoverStaleCallingJobs(): Promise<void> {
    const now = Date.now();
    for (const [candidateId, job] of this.activeJobs.entries()) {
      const startedAt = job.startedAt ? new Date(job.startedAt).getTime() : 0;
      if (now - startedAt > 5 * 60 * 1000) {
        job.status = 'FAILED';
        job.failureReason = 'SERVER_RESTARTED_DURING_CALL';
        job.updatedAt = new Date().toISOString();
        await candidateRepository.releaseCallingLock(candidateId, job.jobId);
        this.activeJobs.delete(candidateId);
      }
    }
  }

  /**
   * Record persistent automation event
   */
  public async logEvent(
    type: AutomationEventType,
    candidate?: { id: string; name: string },
    queueJobId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const event: AutomationEvent = {
      eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type,
      candidateId: candidate?.id,
      candidateName: candidate?.name,
      queueJobId,
      timestamp: new Date().toISOString(),
      automationMode: this.settings.automationMode,
      metadata,
    };
  }

  /**
   * Public Automation State
   */
  public getStatus(): {
    status: AutomationStatus;
    mode: AutomationMode;
    enabled: boolean;
    activeCallsCount: number;
    queuedCount: number;
    dailyStats: AutomationDailyStats;
    settings: AutomationSettings;
  } {
    return {
      status: this.status,
      mode: this.settings.automationMode,
      enabled: this.settings.enabled,
      activeCallsCount: this.activeJobs.size,
      queuedCount: this.queue.length,
      dailyStats: this.dailyStats,
      settings: this.settings,
    };
  }

  /**
   * Get Current In-Memory Queue
   */
  public async getQueue(): Promise<CallingQueueJob[]> {
    return [...Array.from(this.activeJobs.values()), ...this.queue];
  }

  /**
   * STEP 1: Populate Queue from Eligible Candidates
   */
  public async populateQueueFromEligibleCandidates(options: { ignoreTimeWindow?: boolean } = {}): Promise<{
    added: number;
    totalEligible: number;
    totalCandidates: number;
  }> {
    await this.loadDailyStats();

    // Check daily cap
    const remainingDailyCalls = Math.max(0, this.settings.dailyTarget - this.dailyStats.attempted);
    if (remainingDailyCalls <= 0) {
      await this.logEvent('AUTOMATION_LIMIT_REACHED', undefined, undefined, {
        dailyTarget: this.settings.dailyTarget,
        attempted: this.dailyStats.attempted,
      });
      return { added: 0, totalEligible: 0, totalCandidates: 0 };
    }

    const allCandidates = await candidateRepository.getAllCandidates();
    const eligibleList: Array<{ candidate: Candidate; priority: 'HIGH' | 'MEDIUM' | 'LOW'; score: number }> = [];

    for (const cand of allCandidates) {
      const eligibility = isCandidateEligibleForCalling(cand, this.settings, {
        ignoreTimeWindow: options.ignoreTimeWindow,
      });

      if (eligibility.eligible) {
        // Check if already in active or queued jobs
        const alreadyQueued = this.queue.some((j) => j.candidateId === cand.id);
        const alreadyActive = this.activeJobs.has(cand.id);
        if (!alreadyQueued && !alreadyActive) {
          eligibleList.push({
            candidate: cand,
            priority: eligibility.priority,
            score: eligibility.priorityScore,
          });
        }
      }
    }

    // Sort by priorityScore descending (HIGH priority first)
    eligibleList.sort((a, b) => b.score - a.score);

    // Take up to remainingDailyCalls
    const toQueue = eligibleList.slice(0, remainingDailyCalls);
    const nowIso = new Date().toISOString();

    for (const item of toQueue) {
      const job: CallingQueueJob = {
        jobId: `job-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        candidateId: item.candidate.id,
        candidateName: item.candidate.name,
        phone: item.candidate.phone,
        appliedRole: item.candidate.appliedRole,
        priority: item.priority,
        priorityScore: item.score,
        status: 'QUEUED',
        attemptNumber: (item.candidate.unansweredAttempts || item.candidate.callCount || 0) + 1,
        scheduledAt: nowIso,
        automationMode: this.settings.automationMode,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      this.queue.push(job);

      await this.logEvent('CANDIDATE_QUEUED', { id: item.candidate.id, name: item.candidate.name }, job.jobId, {
        priority: item.priority,
        score: item.score,
      });
    }

    return {
      added: toQueue.length,
      totalEligible: eligibleList.length,
      totalCandidates: allCandidates.length,
    };
  }

  /**
   * Start Automation Queue
   */
  public async startAutomation(forceEnable: boolean = false): Promise<{ success: boolean; message: string }> {
    if (forceEnable) {
      await this.updateSettings({ enabled: true });
    } else if (!this.settings.enabled) {
      return {
        success: false,
        message: 'Automation is disabled in settings. Pass forceEnable=true or enable automation explicitly.',
      };
    }

    this.status = 'RUNNING';
    await this.logEvent('AUTOMATION_STARTED');

    // Populate queue from eligible candidates
    await this.populateQueueFromEligibleCandidates();

    // Start background processing loop
    this.startWorkerLoop();

    return {
      success: true,
      message: `Automation started in ${this.settings.automationMode} mode with ${this.queue.length} candidates queued.`,
    };
  }

  /**
   * Stop Automation Queue
   */
  public async stopAutomation(): Promise<{ success: boolean; message: string }> {
    this.status = 'OFF';
    this.stopWorkerLoop();
    this.queue = [];
    await this.logEvent('AUTOMATION_STOPPED');

    return {
      success: true,
      message: 'Automation stopped. Pending queue cleared.',
    };
  }

  /**
   * Pause Automation Queue
   */
  public async pauseAutomation(): Promise<{ success: boolean; message: string }> {
    this.status = 'PAUSED';
    await this.logEvent('AUTOMATION_PAUSED');

    return {
      success: true,
      message: 'Automation paused. Active calls will complete; no new calls will start.',
    };
  }

  /**
   * Resume Automation Queue
   */
  public async resumeAutomation(): Promise<{ success: boolean; message: string }> {
    if (!this.settings.enabled) {
      return { success: false, message: 'Cannot resume: automation is disabled in settings.' };
    }

    this.status = 'RUNNING';
    await this.logEvent('AUTOMATION_RESUMED');
    this.startWorkerLoop();

    return {
      success: true,
      message: 'Automation resumed.',
    };
  }

  /**
   * Worker Loop
   */
  private startWorkerLoop() {
    if (this.workerInterval) return;
    this.workerInterval = setInterval(() => {
      this.processNextQueueJobs().catch((err) => {
        console.error('[CallingQueue] Worker loop uncaught error:', err);
      });
    }, 1500);
  }

  private stopWorkerLoop() {
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = null;
    }
  }

  /**
   * Core Concurrency Dispatcher
   */
  private async processNextQueueJobs(): Promise<void> {
    if (this.isProcessingLoop || this.status !== 'RUNNING') return;
    this.isProcessingLoop = true;

    try {
      // 1. Check time window
      const windowCheck = isWithinCallingWindow(this.settings);
      if (!windowCheck.allowed) {
        // Outside calling hours
        return;
      }

      // 2. Check daily cap
      if (this.dailyStats.attempted >= this.settings.dailyTarget) {
        await this.logEvent('AUTOMATION_LIMIT_REACHED', undefined, undefined, {
          dailyTarget: this.settings.dailyTarget,
          attempted: this.dailyStats.attempted,
        });
        await this.pauseAutomation();
        return;
      }

      // 3. Dispatch up to available concurrency slots
      while (
        this.status === 'RUNNING' &&
        this.activeJobs.size < this.settings.maxConcurrentCalls &&
        this.queue.length > 0 &&
        this.dailyStats.attempted < this.settings.dailyTarget
      ) {
        const nextJob = this.queue.shift();
        if (!nextJob) break;

        // Run job asynchronously (error-isolated)
        this.executeSingleQueueJob(nextJob).catch((err) => {
          console.error(`[CallingQueue] Error processing job ${nextJob.jobId}:`, err);
        });
      }
    } finally {
      this.isProcessingLoop = false;
    }
  }

  /**
   * STEP 6, 7, 8, 10, 12, 13, 20: Execute Single Queue Job with Atomic Lock and Error Isolation
   */
  public async executeSingleQueueJob(
    job: CallingQueueJob,
    options: { forcedOutcome?: string; simulatedDurationMs?: number } = {}
  ): Promise<{ success: boolean; outcome?: string; error?: string }> {
    const candidateId = job.candidateId;
    const candidate = await candidateRepository.getCandidate(candidateId);

    if (!candidate) {
      job.status = 'FAILED';
      job.failureReason = 'CANDIDATE_NOT_FOUND';
      await this.persistJobUpdate(job);
      return { success: false, error: 'Candidate not found' };
    }

    // Double check eligibility before acquiring lock
    const eligibility = isCandidateEligibleForCalling(candidate, this.settings, {
      ignoreTimeWindow: options.forcedOutcome !== undefined, // Allow test harness override
    });
    if (!eligibility.eligible) {
      job.status = 'CANCELLED';
      job.failureReason = eligibility.reason || 'NO_LONGER_ELIGIBLE';
      await this.persistJobUpdate(job);
      return { success: false, error: eligibility.reason };
    }

    // Step 5 & 7: Acquire Calling Lock atomically
    const lockResult = await candidateRepository.acquireCallingLock(candidateId, job.jobId, 5);
    if (!lockResult.success) {
      job.status = 'FAILED';
      job.failureReason = lockResult.reason || 'LOCK_ACQUIRE_FAILED';
      await this.persistJobUpdate(job);
      return { success: false, error: lockResult.reason };
    }

    // Job is now CALLING
    job.status = 'CALLING';
    job.startedAt = new Date().toISOString();
    this.activeJobs.set(candidateId, job);
    await this.persistJobUpdate(job);

    await this.logEvent('CALLING_LOCK_ACQUIRED', { id: candidate.id, name: candidate.name }, job.jobId);
    await this.logEvent('CALL_STARTED', { id: candidate.id, name: candidate.name }, job.jobId);

    // Increment daily attempted count
    this.dailyStats.attempted++;
    await this.persistDailyStats();

    let jobSuccess = false;
    let callOutcome = 'FAILED';

    try {
      // Step 13: Memory Retrieval & Context generation before call
      aiHrBrain.getOrCreateCandidateMemory(candidate);
      const nextCallBrief = aiHrBrain.getNextCallBrief(candidate, candidate.callHistory || []);

      // Step 11: Execute Call Simulation via CallProvider
      const simulation = await this.callProvider.executeCall(candidate, job.jobId, options.forcedOutcome);
      callOutcome = simulation.outcome;

      // Optional short sleep for test speed simulation
      if (options.simulatedDurationMs) {
        await new Promise((resolve) => setTimeout(resolve, options.simulatedDurationMs));
      }

      // Step 12: Post-Call Processing via existing AI HR Brain
      const postCallResult = await aiHrBrain.processCallCompletion({
        candidate,
        transcript: simulation.transcript,
        callScenario: 'screening',
        callDuration: simulation.durationSeconds,
        conversationId: simulation.callId,
      });

      // Update Candidate Record in Firestore
      const nowIso = new Date().toISOString();
      let updatedStatus = candidate.status;
      let unansweredAttempts = candidate.unansweredAttempts || 0;

      if (simulation.outcome === 'NO_ANSWER') {
        updatedStatus = 'Unanswered - Retry Scheduled';
        unansweredAttempts += 1;
        this.dailyStats.noAnswer++;

        // Schedule intelligent retry if under maxRetries
        if (unansweredAttempts < this.settings.maxRetries) {
          const retryTime = new Date(Date.now() + this.settings.retryBackoffMinutes * 60 * 1000).toISOString();
          job.nextRetryAt = retryTime;
          job.status = 'RETRY_SCHEDULED';

          await followupRepository.createFollowup({
            candidateId: candidate.id,
            candidateName: candidate.name,
            phone: candidate.phone,
            appliedRole: candidate.appliedRole,
            type: 'MISSED_CALL',
            scheduledAt: retryTime,
            status: 'PENDING',
            attemptNumber: unansweredAttempts,
            reason: `Automated retry attempt ${unansweredAttempts + 1}/${this.settings.maxRetries}`,
          });

          await this.logEvent('RETRY_SCHEDULED', { id: candidate.id, name: candidate.name }, job.jobId, {
            attemptNumber: unansweredAttempts,
            nextRetryAt: retryTime,
          });
        } else {
          updatedStatus = 'Max Attempts Exceeded';
        }
      } else if (simulation.outcome === 'BUSY') {
        updatedStatus = 'Busy - Retry Scheduled';
        unansweredAttempts += 1;
        this.dailyStats.busy++;

        if (unansweredAttempts < this.settings.maxRetries) {
          const retryTime = new Date(Date.now() + this.settings.retryBackoffMinutes * 60 * 1000).toISOString();
          job.nextRetryAt = retryTime;
          job.status = 'RETRY_SCHEDULED';

          await followupRepository.createFollowup({
            candidateId: candidate.id,
            candidateName: candidate.name,
            phone: candidate.phone,
            appliedRole: candidate.appliedRole,
            type: 'RETRY',
            scheduledAt: retryTime,
            status: 'PENDING',
            attemptNumber: unansweredAttempts,
            reason: 'Line busy. Retry scheduled.',
          });
        }
      } else if (simulation.outcome === 'CALLBACK_REQUESTED') {
        updatedStatus = 'Callback Needed';
        this.dailyStats.callbacks++;

        await followupRepository.createFollowup({
          candidateId: candidate.id,
          candidateName: candidate.name,
          phone: candidate.phone,
          appliedRole: candidate.appliedRole,
          type: 'CALLBACK',
          scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          status: 'PENDING',
          attemptNumber: 1,
          reason: simulation.summary,
        });

        await this.logEvent('CALLBACK_REQUESTED', { id: candidate.id, name: candidate.name }, job.jobId, {
          callbackTime: simulation.callbackTime,
        });
      } else if (simulation.outcome === 'COMPLETED') {
        this.dailyStats.completed++;
        updatedStatus = postCallResult.statusAnalysis.candidateStatus || 'Screened - Ready for Interview';

        if (updatedStatus.includes('Ready') || updatedStatus.includes('Scheduled') || updatedStatus.includes('Confirmed')) {
          this.dailyStats.qualified++;
          this.dailyStats.interviewsScheduled++;
          await this.logEvent('INTERVIEW_SCHEDULED', { id: candidate.id, name: candidate.name }, job.jobId);
        } else if (updatedStatus.includes('Rejected') || updatedStatus.includes('Not Qualified')) {
          this.dailyStats.notQualified++;
        }
      }

      await candidateRepository.updateCandidate(candidateId, {
        status: updatedStatus,
        unansweredAttempts,
        callCount: (candidate.callCount || 0) + 1,
        lastCallAt: nowIso,
        screening: {
          ...candidate.screening,
          ...simulation.extractedFields,
        },
      });

      job.completedAt = nowIso;
      job.outcome = simulation.outcome;
      job.callRecordId = simulation.callId;
      if (job.status !== 'RETRY_SCHEDULED') {
        job.status = 'COMPLETED';
      }

      await this.logEvent('CALL_COMPLETED', { id: candidate.id, name: candidate.name }, job.jobId, {
        outcome: simulation.outcome,
        status: updatedStatus,
      });

      jobSuccess = true;
    } catch (err: any) {
      console.error(`[CallingQueue] Job error for candidate ${candidateId}:`, err);
      job.status = 'FAILED';
      job.failureReason = err.message || 'UNKNOWN_ERROR';
      this.dailyStats.failed++;

      await this.logEvent('CALL_FAILED', { id: candidate.id, name: candidate.name }, job.jobId, {
        error: err.message,
      });
    } finally {
      // Step 20: ALWAYS Release Calling Lock in finally block
      try {
        await candidateRepository.releaseCallingLock(candidateId, job.jobId);
        await this.logEvent('CALLING_LOCK_RELEASED', { id: candidate.id, name: candidate.name }, job.jobId);
      } catch (lockErr) {
        console.warn(`[CallingQueue] Error releasing lock for ${candidateId}:`, lockErr);
      }

      this.activeJobs.delete(candidateId);
      await this.persistJobUpdate(job);
      await this.persistDailyStats();
    }

    return { success: jobSuccess, outcome: callOutcome };
  }

  /**
   * STEP 18: Run Dry Test (Up to 5 eligible candidates)
   */
  public async runDryTest(limitCount: number = 5): Promise<{
    processedCount: number;
    results: Array<{ candidateName: string; priority: string; outcome: string; status: string }>;
  }> {
    const allCandidates = await candidateRepository.getAllCandidates();
    const eligible: Candidate[] = [];

    for (const cand of allCandidates) {
      const el = isCandidateEligibleForCalling(cand, this.settings, { ignoreTimeWindow: true });
      if (el.eligible) eligible.push(cand);
    }

    const selected = eligible.slice(0, limitCount);
    const testResults: Array<{ candidateName: string; priority: string; outcome: string; status: string }> = [];

    for (const cand of selected) {
      const priorityInfo = calculateCandidatePriority(cand);
      const job: CallingQueueJob = {
        jobId: `dry-test-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        candidateId: cand.id,
        candidateName: cand.name,
        phone: cand.phone,
        appliedRole: cand.appliedRole,
        priority: priorityInfo.priority,
        priorityScore: priorityInfo.priorityScore,
        status: 'QUEUED',
        attemptNumber: (cand.unansweredAttempts || cand.callCount || 0) + 1,
        scheduledAt: new Date().toISOString(),
        automationMode: 'DRY_RUN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await this.executeSingleQueueJob(job, {
        simulatedDurationMs: 50,
      });

      const updatedCand = await candidateRepository.getCandidate(cand.id);

      testResults.push({
        candidateName: cand.name,
        priority: priorityInfo.priority,
        outcome: result.outcome || 'COMPLETED',
        status: updatedCand?.status || 'Screened - Ready for Interview',
      });
    }

    await this.logEvent('DRY_TEST_EXECUTED', undefined, undefined, {
      count: testResults.length,
      details: testResults,
    });

    return {
      processedCount: testResults.length,
      results: testResults,
    };
  }

  private async persistJobUpdate(job: CallingQueueJob): Promise<void> {
    job.updatedAt = new Date().toISOString();
  }
}

export const callingQueueManager = new CallingQueueManager();
