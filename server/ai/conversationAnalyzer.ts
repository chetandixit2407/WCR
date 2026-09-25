import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import {
  CandidateLongTermMemory,
  CandidateMemoryContradiction,
  CandidateCorrectionRecord,
  LearningProposal,
  CandidateBehaviorReport,
} from '../../src/types';
import { memoryManager } from './memoryManager';
import { memoryRepository } from '../repositories/memoryRepository';
import { conversationRepository } from '../repositories/conversationRepository';
import { learningEngine } from './learningEngine';
import { candidateBehaviorAnalyzer } from './behaviorAnalyzer';

export interface PostCallAnalysisResult {
  extractedFields: Record<string, any>;
  detectedContradictions: CandidateMemoryContradiction[];
  detectedCorrections: CandidateCorrectionRecord[];
  candidateQuestions: string[];
  candidateObjections: string[];
  candidateConcerns: string[];
  behaviorReport: CandidateBehaviorReport;
  statusAnalysis: {
    candidateStatus: string;
    interviewStatus: string;
    hrDecisionOutcome: string;
    callbackTime?: string;
    declineReason?: string;
    bookedSlotId?: string;
  };
  factBasedRemark: {
    text: string;
    priority: string;
    category: string;
    actionDueDate: string;
  };
  scorecard: {
    gurgaonDubaiScore: string;
    experienceFit: string;
    budgetAlignment: string;
    joiningTimeline: string;
    recommendation: string;
  };
  summary: string;
  keyHighlights: string[];
  communicationDecision: {
    whatsApp: {
      shouldSend: boolean;
      template: string;
      reason: string;
      recommendedMessage: string;
    };
    email: {
      shouldSend: boolean;
      subject: string;
      reason: string;
      recommendedBody: string;
    };
  };
  afterCallAction: {
    candidate_id: string;
    call_status: string;
    screening_status: string;
    target_role: string;
    screening_summary: string;
    candidate_answers: Record<string, any>;
    missing_information: string[];
    interview_status: string;
    interview_date: string;
    interview_time: string;
    follow_up_required: boolean;
    follow_up_date: string;
    hr_remarks: string;
    next_action: string;
    next_action_owner: string;
  };
}

export class ConversationAnalyzer {
  public async analyzeCompletedCall(params: {
    candidate: any;
    transcript: any[];
    callScenario: string;
    callDuration?: number;
    availableSlots?: any[];
    bookedSlotId?: string;
    conversationId?: string;
    genAIClient?: GoogleGenAI | null;
  }): Promise<PostCallAnalysisResult> {
    const {
      candidate,
      transcript = [],
      callScenario = 'screening',
      callDuration = 0,
      availableSlots = [],
      bookedSlotId,
      conversationId = `CALL-${Date.now()}`,
      genAIClient,
    } = params;

    const candId = candidate?.id || 'cand-temp';
    const candName = candidate?.name || 'Candidate';
    const candRole = candidate?.appliedRole || 'Sales Manager (Luxury Real Estate)';

    // Retrieve existing memory
    const existingMemory = memoryManager.getOrCreateCandidateMemory(candidate);

    // Rule-based fact parsing from transcript
    const candidateText = transcript
      .filter((m) => m.sender === 'candidate' || m.sender === 'user')
      .map((m) => m.text)
      .join(' ');

    const fullSpoken = transcript.map((m) => `${m.sender.toUpperCase()}: ${m.text}`).join('\n');

    // Experience extraction
    let totalExp: number | undefined;
    let reExp: number | undefined;
    const expMatch = candidateText.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?|saal)/i);
    if (expMatch) {
      totalExp = parseFloat(expMatch[1]);
      reExp = totalExp;
    }

    // Company extraction
    let mentionedCompany: string | undefined;
    const compMatch = candidateText.match(/(?:at|with|in|from)\s+([A-Z][A-Za-z0-9\s&]{2,25})/);
    if (compMatch && !/white collar|gurgaon|sector|luxury|yes|no/i.test(compMatch[1])) {
      mentionedCompany = compMatch[1].trim();
    }

    // Salary extraction
    let currentSalary: string | undefined;
    let expectedSalary: string | undefined;
    const ctcMatch = candidateText.match(/(\d+(?:\.\d+)?)\s*(?:lpa|lakh|lac|cr|fixed)/i);
    if (ctcMatch) {
      currentSalary = `${ctcMatch[1]} LPA`;
    }

    // Notice period extraction
    let noticeDays: number | undefined;
    const noticeMatch = candidateText.match(/(\d+)\s*(?:days?|din|months?|mahina)/i);
    if (noticeMatch) {
      const num = parseInt(noticeMatch[1], 10);
      noticeDays = /month/i.test(noticeMatch[0]) ? num * 30 : num;
    }

    // Territory & Luxury detection
    const hasGurgaon = /gurgaon|gurugram|golf course|spr|sohna|dwarka expressway|sector 67|m3m|dlf/i.test(candidateText);
    const hasDubai = /dubai|emaar|damac|sobha|uae|off-plan/i.test(candidateText);
    const hasLuxury = /luxury|high-ticket|cr|crore|hni|penthouse|dlf the camellias|m3m golfestate/i.test(candidateText);

    // Intent detection
    const isDeclined = /not interested|nahi chahiye|dont call|not looking|already joined/i.test(candidateText);
    const isCallback = /call (?:me )?later|busy (?:right )?now|baad mein|driving|meeting mein/i.test(candidateText);
    const isAgreedSlot = /confirm|friday|tomorrow|kal|11 am|3 pm|agree|aunga|aaunga|okay done/i.test(candidateText) || Boolean(bookedSlotId);

    // Candidate questions detection
    const candidateQuestions: string[] = [];
    const questionMatches = candidateText.match(/[^.!?]+\?/g) || [];
    for (const q of questionMatches) {
      if (q.trim().length > 10) {
        candidateQuestions.push(q.trim());
      }
    }

    // Candidate objections / concerns detection
    const candidateObjections: string[] = [];
    if (/target|pressure|pressure zyada|incentive clear nahi|cut-off/i.test(candidateText)) {
      candidateObjections.push('Target structure and incentive clarity inquiry');
    }
    if (/travel|conveyance|petrol|cab/i.test(candidateText)) {
      candidateObjections.push('Site visit travel & conveyance allowance inquiry');
    }
    if (/tuesday off|sunday off|weekend/i.test(candidateText)) {
      candidateObjections.push('6 days working / Tuesday off structure inquiry');
    }

    // Status classification
    let candStatus = candidate?.status || 'Screening Pending';
    let intStatus = candidate?.interviewStatus || 'Not Scheduled';
    let hrOutcome = 'SCREENING_COMPLETED';
    let prio = 'Medium';
    let cat = 'Screening Follow-up';
    let actionDue = 'Today';
    let declineReason = '';
    let callbackTime = '';

    let chosenSlot = availableSlots.find((s: any) => s.id === bookedSlotId);
    if (!chosenSlot && isAgreedSlot && availableSlots.length > 0) {
      chosenSlot = availableSlots.find((s: any) => s.isAvailable) || availableSlots[0];
    }

    if (isDeclined) {
      candStatus = 'Declined - Do Not Call';
      intStatus = 'Declined';
      hrOutcome = 'NOT_INTERESTED';
      prio = 'Low';
      cat = 'Declined - Do Not Call';
      actionDue = 'In 30 Days';
      declineReason = 'Candidate indicated not currently exploring opportunities';
    } else if (isCallback) {
      candStatus = 'Callback Needed';
      hrOutcome = 'CALL_BACK_REQUESTED';
      prio = 'High';
      cat = 'Callback Due';
      actionDue = 'Today';
      callbackTime = 'Today within 2-4 hours';
    } else if (callScenario === 'reminder' && isAgreedSlot) {
      candStatus = 'Attendance Confirmed';
      intStatus = 'Confirmed';
      hrOutcome = 'INTERVIEW_SCHEDULED';
      prio = 'High';
      cat = 'Attendance Reconfirmation';
      actionDue = 'Tomorrow';
    } else if (isAgreedSlot || chosenSlot) {
      candStatus = 'Interview Scheduled';
      intStatus = 'Scheduled';
      hrOutcome = 'INTERVIEW_SCHEDULED';
      prio = 'High';
      cat = 'Interview Scheduled';
      actionDue = 'Tomorrow';
    } else if (transcript.length > 4) {
      candStatus = 'Screened - Ready for Interview';
      hrOutcome = 'INTERVIEW_ELIGIBLE';
      prio = 'Medium';
      cat = 'Notice Period Evaluation';
      actionDue = 'Tomorrow';
    }

    // Fact-based remark (Zero generic fluff)
    let factRemark = '';
    if (isDeclined) {
      factRemark = `Candidate declined discussion for ${candRole} (${declineReason}). Logged in talent pool.`;
    } else if (isCallback) {
      factRemark = `Candidate requested callback (${callbackTime || 'Later Today'}). Priority follow-up alert created.`;
    } else if (chosenSlot) {
      factRemark = `F2F Interview confirmed for ${chosenSlot.displayLabel || chosenSlot.date} at Sector 67 Gurugram HQ. Total Exp: ${totalExp || existingMemory.experience.totalYears?.value || '3+'} Yrs, RE Exp: ${reExp || existingMemory.experience.realEstateYears?.value || '2+'} Yrs.`;
    } else {
      factRemark = `Screening completed for ${candRole}. Total Exp: ${totalExp || existingMemory.experience.totalYears?.value || 'Relevant'}, RE Exp: ${reExp || existingMemory.experience.realEstateYears?.value || 'Active'}. Ready for interview scheduling.`;
    }

    const missingInfo: string[] = [];
    if (!currentSalary && !existingMemory.compensation.currentSalary?.value) missingInfo.push('Current CTC');
    if (!expectedSalary && !existingMemory.compensation.expectedSalary?.value) missingInfo.push('Expected CTC');
    if (noticeDays === undefined && existingMemory.noticePeriod.days?.value === undefined) missingInfo.push('Notice Period');
    if (!chosenSlot && candStatus !== 'Interview Scheduled') missingInfo.push('F2F Interview Slot Booking');

    const venue = '6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram, Haryana 122101';
    const shouldSendWA = candStatus === 'Interview Scheduled' || candStatus === 'Attendance Confirmed' || isCallback || transcript.length <= 2;
    const shouldSendMail = candStatus === 'Interview Scheduled' || candStatus === 'Attendance Confirmed';

    // Update candidate memory facts with provenance (Rule 1 & 4)
    const rawExtracted: Record<string, any> = {};
    if (totalExp) rawExtracted['totalExperienceYears'] = totalExp;
    if (reExp) rawExtracted['realEstateExperienceYears'] = reExp;
    if (mentionedCompany) rawExtracted['currentCompany'] = mentionedCompany;
    if (currentSalary) rawExtracted['currentSalaryLPA'] = currentSalary;
    if (expectedSalary) rawExtracted['expectedSalaryLPA'] = expectedSalary;
    if (noticeDays !== undefined) rawExtracted['noticePeriodDays'] = noticeDays;
    if (chosenSlot) rawExtracted['preferredInterviewSlot'] = `${chosenSlot.date} ${chosenSlot.time}`;

    const memoryUpdate = memoryManager.updateCandidateMemoryBatch(
      candId,
      conversationId,
      rawExtracted,
      'candidate_spoken'
    );

    // Process learnings into LearningEngine (Rule 13, 14, 15)
    learningEngine.processInteractionLearnings({
      candidateId: candId,
      appliedRole: candRole,
      transcript,
      candidateQuestions,
      candidateObjections,
      candidateConcerns: [],
      candidateCorrections: memoryUpdate.corrections,
      preferredLanguage: candidate?.languagePreference || 'Auto (Hinglish/Hindi/English)',
      effectiveQuestions: transcript.filter((m) => m.sender === 'agent').slice(0, 3).map((m) => m.text),
      ineffectiveQuestions: [],
    });

    // Run Candidate Behavior & Conversation Intelligence Analysis (Rules 1-43)
    const behaviorReport = await candidateBehaviorAnalyzer.analyzeCallBehavior({
      candidate,
      transcript,
      callScenario,
      callDuration,
      conversationId,
      genAIClient,
    });

    const result: PostCallAnalysisResult = {
      extractedFields: rawExtracted,
      detectedContradictions: memoryUpdate.contradictions,
      detectedCorrections: memoryUpdate.corrections,
      candidateQuestions,
      candidateObjections,
      candidateConcerns: [],
      behaviorReport,
      statusAnalysis: {
        candidateStatus: candStatus,
        interviewStatus: intStatus,
        hrDecisionOutcome: hrOutcome,
        callbackTime,
        declineReason,
        bookedSlotId: chosenSlot?.id,
      },
      factBasedRemark: {
        text: factRemark,
        priority: prio,
        category: cat,
        actionDueDate: actionDue,
      },
      scorecard: {
        gurgaonDubaiScore: hasGurgaon || hasDubai ? 'High' : 'Medium',
        experienceFit: (totalExp || 3) >= 4 ? 'Senior Fit' : 'Mid Fit',
        budgetAlignment: 'Within Budget',
        joiningTimeline: noticeDays !== undefined && noticeDays <= 15 ? 'Immediate (<15 days)' : '30 Days',
        recommendation: isDeclined ? 'Not Selected' : chosenSlot ? 'Priority Interview' : 'Proceed',
      },
      summary: `Conducted ${callScenario} screening with ${candName} for ${candRole}. ${factRemark}`,
      keyHighlights: [
        `Extracted and verified ${memoryUpdate.updatedFieldsCount} memory facts with timestamp provenance`,
        `Outcome recorded as ${candStatus} (${hrOutcome}) with priority ${prio}`,
      ],
      communicationDecision: {
        whatsApp: {
          shouldSend: shouldSendWA,
          template: chosenSlot ? 'interview_reminder' : 'unanswered',
          reason: chosenSlot
            ? 'Confirm F2F interview date, time, and Sector 67 Gurugram location on WhatsApp'
            : 'Recruiter follow-up notification on WhatsApp',
          recommendedMessage: `Hello ${candName}, thank you for speaking with White Collar Realty regarding the ${candRole} position. We look forward to meeting you at our Sector 67 Gurugram HQ.`,
        },
        email: {
          shouldSend: shouldSendMail,
          subject: `Interview Call Letter: ${candRole} - White Collar Realty Gurugram`,
          reason: 'Official call letter containing Sector 67 M3M Urbana venue details and required documents',
          recommendedBody: `Dear ${candName},\n\nWe are pleased to confirm your face-to-face interview for the ${candRole} role at White Collar Realty Gurugram.\n\nVenue: ${venue}\n\nPlease carry an updated CV and government ID.`,
        },
      },
      afterCallAction: {
        candidate_id: candId,
        call_status: 'COMPLETED',
        screening_status: hrOutcome,
        target_role: candRole,
        screening_summary: factRemark,
        candidate_answers: rawExtracted,
        missing_information: missingInfo,
        interview_status: intStatus,
        interview_date: chosenSlot?.date || candidate?.interviewDate || '',
        interview_time: chosenSlot?.time || candidate?.interviewTime || '',
        follow_up_required: candStatus === 'Callback Needed' || candStatus === 'Missed Interview - Followup',
        follow_up_date: actionDue,
        hr_remarks: factRemark,
        next_action: chosenSlot ? 'Dispatch official interview invitation' : 'Follow up for slot confirmation',
        next_action_owner: 'Arjun (Virtual AI HR Desk)',
      },
    };

    return result;
  }
}

export const conversationAnalyzer = new ConversationAnalyzer();
