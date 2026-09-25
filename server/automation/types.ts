import { Candidate, CallRecord } from '../../src/types';

export type AutomationMode = 'DRY_RUN' | 'LIVE';
export type AutomationStatus = 'OFF' | 'RUNNING' | 'PAUSED';

export type QueueJobStatus =
  | 'QUEUED'
  | 'CALLING'
  | 'COMPLETED'
  | 'FAILED'
  | 'RETRY_SCHEDULED'
  | 'CANCELLED';

export type AutomationEventType =
  | 'AUTOMATION_STARTED'
  | 'AUTOMATION_STOPPED'
  | 'AUTOMATION_PAUSED'
  | 'AUTOMATION_RESUMED'
  | 'CANDIDATE_QUEUED'
  | 'CALLING_LOCK_ACQUIRED'
  | 'CALLING_LOCK_RELEASED'
  | 'CALL_STARTED'
  | 'CALL_COMPLETED'
  | 'CALL_FAILED'
  | 'NO_ANSWER'
  | 'BUSY'
  | 'CALLBACK_REQUESTED'
  | 'RETRY_SCHEDULED'
  | 'INTERVIEW_SCHEDULED'
  | 'AUTOMATION_LIMIT_REACHED'
  | 'DRY_TEST_EXECUTED';

export interface AutomationSettings {
  enabled: boolean;
  automationMode: AutomationMode;
  dailyTarget: number;
  maxConcurrentCalls: number;
  callingWindowStart: string; // "10:00"
  callingWindowEnd: string; // "19:00"
  timezone: string; // "Asia/Kolkata"
  allowedDays: string[]; // ["MON","TUE","WED","THU","FRI","SAT"]
  maxRetries: number;
  retryBackoffMinutes: number;
  simulatedCallDurationSeconds: number; // for dry-run speed
}

export interface CallingQueueJob {
  jobId: string;
  candidateId: string;
  candidateName: string;
  phone?: string;
  appliedRole: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  priorityScore: number;
  status: QueueJobStatus;
  attemptNumber: number;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  outcome?: string;
  failureReason?: string;
  automationMode: AutomationMode;
  callRecordId?: string;
  nextRetryAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationDailyStats {
  date: string; // YYYY-MM-DD in Asia/Kolkata
  target: number;
  attempted: number;
  completed: number;
  failed: number;
  noAnswer: number;
  busy: number;
  callbacks: number;
  qualified: number;
  notQualified: number;
  interviewsScheduled: number;
  updatedAt: string;
}

export interface AutomationEvent {
  eventId: string;
  type: AutomationEventType;
  candidateId?: string;
  candidateName?: string;
  queueJobId?: string;
  timestamp: string;
  automationMode: AutomationMode;
  metadata?: Record<string, any>;
}

export interface CandidateEligibilityResult {
  eligible: boolean;
  reason?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  priorityScore: number;
}

export interface CallSimulationResult {
  callId: string;
  durationSeconds: number;
  outcome: 'COMPLETED' | 'NO_ANSWER' | 'BUSY' | 'CALLBACK_REQUESTED' | 'FAILED';
  transcript: Array<{ id: string; sender: 'agent' | 'candidate'; text: string; timestamp: string }>;
  extractedFields: Record<string, any>;
  summary: string;
  qualificationStatus: string;
  callbackTime?: string;
  declineReason?: string;
}
