import { Candidate, CallRecord } from '../../../src/types';
import { CallSimulationResult, AutomationMode } from '../types';
import { aiHrBrain } from '../../ai/hrBrain';
import { conversationRepository } from '../../repositories/conversationRepository';
import { followupRepository } from '../../repositories/followupRepository';

export interface CallProvider {
  name: string;
  mode: AutomationMode;
  startCall(candidate: Candidate, queueJobId: string): Promise<{ callId: string; status: string }>;
  executeCall(candidate: Candidate, queueJobId: string, customOutcome?: string): Promise<CallSimulationResult>;
}

export class DryRunCallProvider implements CallProvider {
  public name = 'DryRunCallProvider';
  public mode: AutomationMode = 'DRY_RUN';

  public async startCall(candidate: Candidate, queueJobId: string): Promise<{ callId: string; status: string }> {
    const callId = `SIM-CALL-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    return {
      callId,
      status: 'CONNECTED_SIMULATED',
    };
  }

  public async executeCall(
    candidate: Candidate,
    queueJobId: string,
    forcedOutcome?: string
  ): Promise<CallSimulationResult> {
    const callId = `SIM-CALL-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const role = candidate.appliedRole || 'Property Consultant (Luxury Residential)';
    const name = candidate.name;

    // Determine simulated conversation flow based on candidate status or forced outcome
    let outcome: 'COMPLETED' | 'NO_ANSWER' | 'BUSY' | 'CALLBACK_REQUESTED' | 'FAILED' = 'COMPLETED';
    if (forcedOutcome) {
      outcome = forcedOutcome as any;
    } else if (candidate.status === 'Callback Needed') {
      outcome = 'COMPLETED';
    } else if (candidate.unansweredAttempts === 1) {
      // 50% chance of successful answer on retry
      outcome = 'COMPLETED';
    }

    if (outcome === 'NO_ANSWER') {
      return {
        callId,
        durationSeconds: 18,
        outcome: 'NO_ANSWER',
        transcript: [
          { id: 't1', sender: 'agent', text: `Calling ${name}... Ringing.`, timestamp: '00:01' },
          { id: 't2', sender: 'agent', text: 'Call timed out. No answer received.', timestamp: '00:18' },
        ],
        extractedFields: {},
        summary: `Simulated call placed to ${name} (${candidate.phone}). Candidate did not answer after 4 rings.`,
        qualificationStatus: 'Unanswered - Retry Scheduled',
      };
    }

    if (outcome === 'BUSY') {
      return {
        callId,
        durationSeconds: 12,
        outcome: 'BUSY',
        transcript: [
          { id: 't1', sender: 'agent', text: `Calling ${name}... Ringing.`, timestamp: '00:01' },
          { id: 't2', sender: 'agent', text: 'Line busy / rejected by subscriber.', timestamp: '00:12' },
        ],
        extractedFields: {},
        summary: `Simulated call placed to ${name} (${candidate.phone}). Line was busy.`,
        qualificationStatus: 'Busy - Retry Scheduled',
      };
    }

    if (outcome === 'CALLBACK_REQUESTED') {
      return {
        callId,
        durationSeconds: 45,
        outcome: 'CALLBACK_REQUESTED',
        transcript: [
          { id: 't1', sender: 'agent', text: `Hello ${name}, this is Arjun calling from White Collar Realty regarding your application for ${role}. Is this a good time to speak?`, timestamp: '00:02' },
          { id: 't2', sender: 'candidate', text: 'Hi Arjun, I am currently in a client meeting right now. Can you please call me back around 4:30 PM today?', timestamp: '00:15' },
          { id: 't3', sender: 'agent', text: 'Certainly! I have scheduled a callback for 4:30 PM today. Thank you, talk to you then.', timestamp: '00:25' },
        ],
        extractedFields: {
          callbackTime: 'Today at 04:30 PM',
        },
        summary: `Candidate requested a callback at 4:30 PM today due to an ongoing client meeting.`,
        qualificationStatus: 'Callback Needed',
        callbackTime: '04:30 PM',
      };
    }

    // Standard high-quality simulated screening dialogue
    const s = candidate.screening || {};
    const expYears = s.realEstateExperienceYears || s.totalExperienceYears || 4;
    const currentComp = s.currentSalaryLPA || '14 LPA';
    const expectedComp = s.expectedSalaryLPA || '18 LPA';
    const notice = s.noticePeriodDays !== undefined ? `${s.noticePeriodDays} days` : '15 days';

    const transcript: Array<{ id: string; sender: 'agent' | 'candidate'; text: string; timestamp: string }> = [
      {
        id: 'turn-1',
        sender: 'agent',
        text: `Hello ${name}, good day! This is Arjun calling from the HR team at White Collar Realty. I am reaching out regarding your application for the ${role} position at our Sector 67 Gurugram headquarters. Do you have 3-4 minutes to speak?`,
        timestamp: '00:03',
      },
      {
        id: 'turn-2',
        sender: 'candidate',
        text: `Hi Arjun, yes absolutely! I was expecting your call. I am actively looking for luxury real estate opportunities in Gurugram.`,
        timestamp: '00:12',
      },
      {
        id: 'turn-3',
        sender: 'agent',
        text: `Excellent. To begin, could you briefly walk me through your experience in Gurugram luxury residential real estate, including ticket sizes and developers you have handled?`,
        timestamp: '00:20',
      },
      {
        id: 'turn-4',
        sender: 'candidate',
        text: `Sure Arjun. I have around ${expYears} years of experience in Golf Course Extension and Dwarka Expressway luxury projects. I have worked on DLF, M3M, and Godrej residential projects, typically handling ticket sizes between 3 Cr to 12 Cr.`,
        timestamp: '00:40',
      },
      {
        id: 'turn-5',
        sender: 'agent',
        text: `That aligns very well with our portfolio at White Collar Realty. What is your current fixed compensation and what are your CTC expectations for this role?`,
        timestamp: '00:52',
      },
      {
        id: 'turn-6',
        sender: 'candidate',
        text: `My current CTC is ${currentComp} and I am expecting around ${expectedComp}. My notice period is ${notice} and I can join immediately if needed.`,
        timestamp: '01:10',
      },
      {
        id: 'turn-7',
        sender: 'agent',
        text: `Wonderful. Based on your background, we would like to invite you for a face-to-face round at our office at 6th Floor, Tower-A, M3M Urbana Business Park, Sector 67, Gurugram. Tomorrow at 11:00 AM works well. Can we confirm this slot?`,
        timestamp: '01:25',
      },
      {
        id: 'turn-8',
        sender: 'candidate',
        text: `Yes, tomorrow at 11:00 AM at Sector 67 M3M Urbana works perfectly for me. Please send the confirmation details.`,
        timestamp: '01:38',
      },
      {
        id: 'turn-9',
        sender: 'agent',
        text: `Confirmed! Our team will send the official interview letter with venue directions. Thank you ${name}, we look forward to meeting you.`,
        timestamp: '01:48',
      },
    ];

    const extractedFields: Record<string, any> = {
      currentCompany: s.currentCompany || 'Luxury Realty Associates',
      currentDesignation: s.currentDesignation || 'Senior Sales Consultant',
      totalExperienceYears: expYears,
      realEstateExperienceYears: expYears,
      gurgaonExperience: 'Yes',
      dubaiExperience: s.gurgaonDubaiExperience?.dubai ? 'Yes' : 'No',
      currentSalaryLPA: currentComp,
      expectedSalaryLPA: expectedComp,
      currentLocation: 'Gurugram (Golf Course Extension)',
      noticePeriodDays: parseInt(notice, 10) || 15,
      earliestJoiningDate: 'Immediate (within 15 days)',
    };

    const summary = `Dry-run automated screening completed for ${name}. Candidate verified ${expYears} years Gurugram luxury real estate sales experience (DLF/M3M projects, 3-12 Cr ticket sizes). Confirmed F2F interview round at Sector 67 M3M Urbana HQ. Notice period: ${notice}, Expected CTC: ${expectedComp}.`;

    return {
      callId,
      durationSeconds: 110,
      outcome: 'COMPLETED',
      transcript,
      extractedFields,
      summary,
      qualificationStatus: 'Screened - Ready for Interview',
    };
  }
}

export const dryRunCallProvider = new DryRunCallProvider();
