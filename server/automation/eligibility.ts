import { Candidate } from '../../src/types';
import { AutomationSettings, CandidateEligibilityResult } from './types';

/**
 * Convert Date to Asia/Kolkata components
 */
export function getKolkataDateInfo(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  dayOfWeek: string;
  hours: number;
  minutes: number;
  dateString: string; // YYYY-MM-DD
  timeString: string; // HH:MM
} {
  // Format in Asia/Kolkata
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });

  const parts = formatter.formatToParts(date);
  let year = 2026;
  let month = 1;
  let day = 1;
  let hours = 10;
  let minutes = 0;
  let weekdayStr = 'Mon';

  for (const p of parts) {
    if (p.type === 'year') year = parseInt(p.value, 10);
    if (p.type === 'month') month = parseInt(p.value, 10);
    if (p.type === 'day') day = parseInt(p.value, 10);
    if (p.type === 'hour') hours = parseInt(p.value, 10);
    if (p.type === 'minute') minutes = parseInt(p.value, 10);
    if (p.type === 'weekday') weekdayStr = p.value;
  }

  const dayMap: Record<string, string> = {
    Mon: 'MON',
    Tue: 'TUE',
    Wed: 'WED',
    Thu: 'THU',
    Fri: 'FRI',
    Sat: 'SAT',
    Sun: 'SUN',
  };

  const dayOfWeek = dayMap[weekdayStr] || 'MON';
  const monthStr = String(month).padStart(2, '0');
  const dayStr = String(day).padStart(2, '0');
  const dateString = `${year}-${monthStr}-${dayStr}`;
  const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  return {
    year,
    month,
    day,
    dayOfWeek,
    hours,
    minutes,
    dateString,
    timeString,
  };
}

/**
 * Check if the current time in Asia/Kolkata falls within the permitted calling window and allowed days
 */
export function isWithinCallingWindow(
  settings: AutomationSettings,
  now: Date = new Date()
): { allowed: boolean; reason?: string } {
  const info = getKolkataDateInfo(now);

  // 1. Check allowed day
  if (!settings.allowedDays.includes(info.dayOfWeek)) {
    return {
      allowed: false,
      reason: `Day ${info.dayOfWeek} is outside permitted calling days (${settings.allowedDays.join(', ')})`,
    };
  }

  // 2. Check time window
  const currentMinutes = info.hours * 60 + info.minutes;
  const [startH, startM] = settings.callingWindowStart.split(':').map((v) => parseInt(v, 10));
  const [endH, endM] = settings.callingWindowEnd.split(':').map((v) => parseInt(v, 10));

  const startMinutes = startH * 60 + (startM || 0);
  const endMinutes = endH * 60 + (endM || 0);

  if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
    return {
      allowed: false,
      reason: `Current time (${info.timeString} IST) is outside permitted calling hours (${settings.callingWindowStart} - ${settings.callingWindowEnd} IST)`,
    };
  }

  return { allowed: true };
}

/**
 * Calculate recruitment prioritization score (0 - 100) and tier (HIGH, MEDIUM, LOW)
 */
export function calculateCandidatePriority(candidate: Candidate): {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  priorityScore: number;
  factors: string[];
} {
  let score = 10; // Base score
  const factors: string[] = [];

  const status = candidate.status;
  const s = candidate.screening || {};

  // Status weight
  if (status === 'Callback Needed') {
    score += 35;
    factors.push('Requested Callback (+35)');
  } else if (status === 'Missed Interview - Followup') {
    score += 30;
    factors.push('Missed Interview Followup (+30)');
  } else if (status === 'Screening Pending') {
    score += 25;
    factors.push('Screening Pending (+25)');
  } else if (status === 'Under Review') {
    score += 15;
    factors.push('Under Review (+15)');
  }

  // Candidate existing priority flag
  if (candidate.priority === 'HIGH') {
    score += 15;
    factors.push('Candidate Marked High Priority (+15)');
  } else if (candidate.priority === 'LOW') {
    score -= 5;
    factors.push('Candidate Marked Low Priority (-5)');
  }

  // Real estate experience
  const reExp = s.realEstateExperienceYears || s.totalExperienceYears || 0;
  if (reExp >= 5) {
    score += 20;
    factors.push('5+ Years Real Estate Exp (+20)');
  } else if (reExp >= 3) {
    score += 15;
    factors.push('3-4 Years Real Estate Exp (+15)');
  } else if (reExp >= 1) {
    score += 10;
    factors.push('1-2 Years Real Estate Exp (+10)');
  }

  // Gurugram / Dubai Luxury Market Exposure
  if (s.gurgaonDubaiExperience?.gurgaon) {
    score += 10;
    factors.push('Gurgaon Market Experience (+10)');
  }
  if (s.gurgaonDubaiExperience?.dubai) {
    score += 10;
    factors.push('Dubai Freehold Experience (+10)');
  }
  if ((s.currentLocation || '').toLowerCase().includes('gurgaon') || (s.currentLocation || '').toLowerCase().includes('delhi')) {
    score += 5;
    factors.push('Local NCR Location (+5)');
  }

  // Notice Period / Immediate Joiner
  const notice = s.noticePeriodDays;
  if (notice !== undefined && notice <= 15) {
    score += 10;
    factors.push('Immediate / 15-Day Notice (+10)');
  } else if (notice !== undefined && notice <= 30) {
    score += 5;
    factors.push('30-Day Notice (+5)');
  }

  // Cap between 0 and 100
  const finalScore = Math.min(100, Math.max(0, score));

  let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  if (finalScore >= 60) {
    priority = 'HIGH';
  } else if (finalScore >= 40) {
    priority = 'MEDIUM';
  } else {
    priority = 'LOW';
  }

  return { priority, priorityScore: finalScore, factors };
}

/**
 * STEP 2: Centralized Candidate Eligibility Function
 */
export function isCandidateEligibleForCalling(
  candidate: Candidate,
  settings: AutomationSettings,
  options: {
    now?: Date;
    ignoreTimeWindow?: boolean;
    ignoreDailyCap?: boolean;
  } = {}
): CandidateEligibilityResult {
  const now = options.now || new Date();
  const { priority, priorityScore } = calculateCandidatePriority(candidate);

  // 1. DO NOT CALL Check
  if (
    candidate.doNotCall === true ||
    candidate.status === 'Declined - Do Not Call' ||
    (candidate.status as string) === 'Do Not Call'
  ) {
    return {
      eligible: false,
      reason: 'Candidate is marked as DO NOT CALL or explicitly opted out',
      priority,
      priorityScore,
    };
  }

  // 2. Already being called / active lock
  if (candidate.isCalling === true) {
    const callStartedAt = candidate.callStartedAt ? new Date(candidate.callStartedAt).getTime() : 0;
    const lockDuration = now.getTime() - callStartedAt;
    // Lock expires after 5 minutes
    if (lockDuration < 5 * 60 * 1000) {
      return {
        eligible: false,
        reason: 'Candidate currently has an active calling lock in progress',
        priority,
        priorityScore,
      };
    }
  }

  // 3. Already scheduled for interview or attendance confirmed
  if (
    candidate.status === 'Interview Scheduled' ||
    candidate.status === 'Attendance Confirmed' ||
    Boolean(candidate.interviewSlotId)
  ) {
    return {
      eligible: false,
      reason: 'Candidate already has a confirmed face-to-face interview slot; no outbound screening required',
      priority,
      priorityScore,
    };
  }

  // 4. Rejected / Not Qualified (unless manually reactivated to Screening Pending)
  if (candidate.status === 'Rejected - Not Qualified' || (candidate.status as string) === 'Not Qualified') {
    return {
      eligible: false,
      reason: 'Candidate status is Not Qualified',
      priority,
      priorityScore,
    };
  }

  // 5. Check if retry count exceeded
  const attempts = candidate.unansweredAttempts || candidate.callCount || 0;
  if (attempts >= settings.maxRetries) {
    return {
      eligible: false,
      reason: `Max retry attempts reached (${attempts}/${settings.maxRetries})`,
      priority,
      priorityScore,
    };
  }

  // 6. Check retry backoff window
  if (candidate.lastCallAt) {
    const lastCallMs = new Date(candidate.lastCallAt).getTime();
    const elapsedMinutes = (now.getTime() - lastCallMs) / (60 * 1000);
    if (elapsedMinutes < settings.retryBackoffMinutes && candidate.status !== 'Callback Needed') {
      return {
        eligible: false,
        reason: `Retry backoff active (${Math.round(settings.retryBackoffMinutes - elapsedMinutes)} min remaining)`,
        priority,
        priorityScore,
      };
    }
  }

  // 7. Check if future scheduled callback time has not arrived yet
  if (candidate.scheduledCall && candidate.scheduledCall.status === 'pending') {
    const scheduledDateStr = `${candidate.scheduledCall.date} ${candidate.scheduledCall.time}`;
    const scheduledTimestamp = new Date(scheduledDateStr).getTime();
    if (!isNaN(scheduledTimestamp) && scheduledTimestamp > now.getTime()) {
      return {
        eligible: false,
        reason: `Scheduled callback time (${candidate.scheduledCall.time}) is in the future`,
        priority,
        priorityScore,
      };
    }
  }

  // 8. Check Time Window & Allowed Calling Days (unless ignored for dry test simulation)
  if (!options.ignoreTimeWindow) {
    const windowCheck = isWithinCallingWindow(settings, now);
    if (!windowCheck.allowed) {
      return {
        eligible: false,
        reason: windowCheck.reason,
        priority,
        priorityScore,
      };
    }
  }

  return {
    eligible: true,
    priority,
    priorityScore,
  };
}
