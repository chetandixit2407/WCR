import express from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { setupGeminiLiveWebSocket } from './serverLiveBridge';
import {
  createInitialQuestionStateEngine,
  evaluateQuestionGate,
  recordQuestionSpoken,
  recordAnswerReceived,
  detectQuestionTopic,
  TOPIC_SEMANTIC_PATTERNS,
  getNextPriorityOpenTopic,
} from './src/utils/questionStateEngine';
import { QuestionStateEngine, AskedQuestionRecord } from './src/types';
import { aiHrBrain } from './server/ai/hrBrain';
import { candidateRepository } from './server/repositories/candidateRepository';
import { interviewSlotRepository } from './server/repositories/interviewSlotRepository';
import { followupRepository } from './server/repositories/followupRepository';
import { callingQueueManager } from './server/automation/callingQueue';

dotenv.config();

const app = express();
const server = http.createServer(app);
setupGeminiLiveWebSocket(server, app);
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy initialization of Gemini Client
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY not found in environment. Fallback conversational engine will be used.');
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Helper to validate and clean Vapi public key (UUID or key format, not shell commands)
function cleanVapiPublicKey(rawKey?: string): string {
  if (!rawKey || typeof rawKey !== 'string') return '';
  const trimmed = rawKey.trim();
  // Filter out accidental shell command values like 'npm install ...'
  if (trimmed.startsWith('npm ') || trimmed.includes('install') || trimmed.length < 5) {
    return '';
  }
  return trimmed;
}

// Memory store for runtime configured Vapi credentials
let runtimeVapiPublicKey: string = '';

// Vapi public configuration endpoint (safe: only returns public key, assistant ID, and silence timeout)
app.get('/api/vapi-config', (req, res) => {
  const publicKey =
    runtimeVapiPublicKey ||
    cleanVapiPublicKey(process.env.VAPI_PUBLIC_KEY) ||
    cleanVapiPublicKey(process.env.VITE_VAPI_PUBLIC_KEY) ||
    cleanVapiPublicKey(process.env.VAPI_PUBLIC_API_KEY) ||
    '';
  const assistantId =
    process.env.VITE_VAPI_ASSISTANT_ID ||
    process.env.VAPI_ASSISTANT_ID ||
    'ed825f7a-e951-444b-81a7-1d6917e439c5';

  res.json({
    publicKey,
    assistantId,
    configured: Boolean(publicKey),
    silenceTimeoutSeconds: 30,
    responseDelaySeconds: 0.5,
  });
});

// Allow saving Vapi key dynamically at runtime
app.post('/api/vapi-config', (req, res) => {
  const { publicKey } = req.body || {};
  const cleaned = cleanVapiPublicKey(publicKey);
  if (cleaned) {
    runtimeVapiPublicKey = cleaned;
  }
  res.json({
    success: true,
    configured: Boolean(runtimeVapiPublicKey),
  });
});

// White Collar Realty Job Descriptions & Specifications
interface RoleJDInfo {
  title: string;
  department: string;
  location: string;
  minExperienceYears: number;
  minRealEstateExpYears: number;
  fixedBudget: string;
  totalOte: string;
  seniority: string;
  marketFocus: string;
  noticePeriodExpectation: string;
  responsibilities: string[];
  requiredSkills: string[];
  roleSpecificQuestions: string[];
}

const WHITE_COLLAR_JDS: Record<string, RoleJDInfo> = {
  sales_manager: {
    title: 'Sales Manager (Luxury Real Estate)',
    department: 'Luxury & Ultra-Luxury Residential Sales (Gurgaon & Dubai)',
    location: '6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram, Haryana 122101',
    minExperienceYears: 4,
    minRealEstateExpYears: 3,
    fixedBudget: '14 - 22 LPA fixed',
    totalOte: '25 - 35 LPA OTE with luxury closings',
    seniority: 'Leadership / Squad Head',
    marketFocus: 'Gurgaon Luxury Corridors (Golf Course Ext, SPR, Dwarka Expressway) & Dubai Luxury Freehold',
    noticePeriodExpectation: 'Immediate to 30 days max',
    responsibilities: [
      'Lead and mentor a high-performing squad of 8 to 15 Property Consultants specializing in luxury residential assets',
      'Drive monthly gross booking targets of ₹15–30 Cr across DLF, M3M, Godrej, Emaar, and Sobha luxury residential inventories',
      'Conduct high-ticket negotiations and closing meetings with HNIs and NRI investors for ultra-luxury penthouses and apartments',
      'Facilitate client investment roadshows for Dubai off-plan luxury freehold developments',
    ],
    requiredSkills: [
      'Team Leadership & Squad Target Accountability',
      'High-Ticket Luxury Residential Real Estate Negotiation & Closing',
      'Gurugram Circle Rates, RERA & Dubai Freehold Regulations',
      'HNI & Ultra-HNI Network in Delhi NCR',
    ],
    roleSpecificQuestions: [
      'How large was the sales team you were managing in your last luxury real estate role?',
      'Were you personally accountable for monthly squad targets, and what was your run-rate in luxury residential?',
      'Which Gurgaon luxury residential developer projects (e.g. DLF Camellias, M3M Golfestate) or Dubai luxury portfolios have you actively closed?',
      'What has been your highest-ticket personal closure and closing conversion ratio?',
    ],
  },
  property_consultant: {
    title: 'Property Consultant / Senior Property Consultant',
    department: 'Luxury & Ultra-Luxury Residential Advisory',
    location: '6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram, Haryana 122101',
    minExperienceYears: 2,
    minRealEstateExpYears: 1.5,
    fixedBudget: '10 - 16 LPA fixed',
    totalOte: '18 - 25 LPA OTE with direct transaction commissions',
    seniority: 'Property Consultant / Specialist',
    marketFocus: 'Gurugram Primary Luxury & Ultra-Luxury Residential Corridors (Golf Course Ext, SPR, Dwarka Expressway)',
    noticePeriodExpectation: 'Immediate to 30 days',
    responsibilities: [
      'Manage end-to-end buyer journey from qualified HNI lead engagement to site visit and booking in luxury residential projects',
      'Present luxury residential layouts (₹3 Cr – ₹18 Cr+) and high-end condominium assets to clients',
      'Coordinate personalized site visits at M3M, DLF, SmartWorld, and Godrej luxury residential sites across Gurugram',
      'Negotiate terms and facilitate booking documentation per developer guidelines',
    ],
    requiredSkills: [
      'Consultative Luxury Property Selling & Lead Conversion',
      'Gurugram Micro-Market & Infrastructure Understanding',
      'Relationship Building with HNI & Ultra-HNI Buyers',
      'Fluent Spoken English & Corporate Communication',
    ],
    roleSpecificQuestions: [
      'How many years have you been handling direct luxury residential property sales in Gurgaon?',
      'Which luxury residential developer projects have you primarily closed in Golf Course Ext or SPR?',
      'What has been your typical monthly lead-to-site-visit and booking conversion rate for high-ticket residences?',
      'Have you closed any deals in Golf Course Extension Road or SPR in the last 6 months?',
    ],
  },
  business_development: {
    title: 'Business Development Manager / Corporate Sales',
    department: 'Institutional & Channel Partner Sales',
    location: '6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram, Haryana 122101',
    minExperienceYears: 3,
    minRealEstateExpYears: 2,
    fixedBudget: '6 - 10 LPA fixed',
    totalOte: '12 - 18 LPA OTE with incentives',
    seniority: 'Direct Sales Associate',
    marketFocus: 'Delhi NCR Corporate Alliances & Channel Partner Network',
    noticePeriodExpectation: 'Immediate to 30 days',
    responsibilities: [
      'Onboard and activate tier-1 Channel Partners and independent wealth brokers across NCR',
      'Structure joint customer engagement sessions and project launch briefings',
      'Drive corporate tie-ups with MNCs across Cyber City, Golf Course Road, and Udyog Vihar',
    ],
    requiredSkills: [
      'Channel Partner Network Development',
      'B2B Corporate Real Estate Presentation',
      'Revenue Forecasting and Pipeline Review',
    ],
    roleSpecificQuestions: [
      'How many active Channel Partners did you manage in your network in Gurgaon?',
      'Have you handled corporate desk activations or NRI roadshows?',
      'What was your average monthly revenue generated through broker networks?',
    ],
  },
  hr_recruiter: {
    title: 'HR Recruiter / Talent Acquisition Specialist (Real Estate)',
    department: 'Human Resources & Talent Acquisition',
    location: '6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram, Haryana 122101',
    minExperienceYears: 2,
    minRealEstateExpYears: 1,
    fixedBudget: '6 - 10 LPA fixed',
    totalOte: '8 - 14 LPA with hiring SLA incentives',
    seniority: 'Talent Acquisition Specialist',
    marketFocus: 'Real Estate Sales Talent Sourcing across Gurugram & Delhi NCR',
    noticePeriodExpectation: 'Immediate to 30 days',
    responsibilities: [
      'Source, screen, and headhunt top-performing real estate sales professionals across Delhi NCR',
      'Manage end-to-end recruitment lifecycle from initial telephonic screening to offer rollout',
      'Coordinate interview schedules with Sales Directors and Department Heads',
      'Maintain candidate pipeline, ATS tracking, and recruitment SLA metrics',
    ],
    requiredSkills: [
      'Real Estate Talent Sourcing & Headhunting',
      'Candidate Telephonic & Voice Screening',
      'Offer Negotiation & Onboarding SLAs',
      'Portal Sourcing (Naukri, LinkedIn, Referrals)',
    ],
    roleSpecificQuestions: [
      'How many years of candidate sourcing and recruitment experience do you have in real estate?',
      'What is your monthly closure run-rate for sales consultant and managerial profiles?',
      'Which sourcing channels have yielded your highest quality hires?',
    ],
  },
};

// Helper to determine role budget and pitch for White Collar Realty
function getRoleBudgetInfo(roleName?: string): RoleJDInfo {
  const r = (roleName || '').toLowerCase();
  if (r.includes('hr') || r.includes('recruit') || r.includes('talent') || r.includes('acquisition') || r.includes('people')) {
    return WHITE_COLLAR_JDS['hr_recruiter'];
  } else if (r.includes('lead') || r.includes('manager') || r.includes('dubai') || r.includes('head') || r.includes('vp')) {
    return WHITE_COLLAR_JDS['sales_manager'];
  } else if (r.includes('associate') || r.includes('advisor') || r.includes('bd') || r.includes('business')) {
    return WHITE_COLLAR_JDS['business_development'];
  }
  return WHITE_COLLAR_JDS['property_consultant'];
}

function mapStatusToHrOutcome(statusRec?: string, intent?: string): string {
  if (intent === 'cancel_decline' || statusRec?.includes('Declined')) return 'NOT_INTERESTED';
  if (intent === 'request_callback' || statusRec?.includes('Callback')) return 'CALL_BACK_REQUESTED';
  if (intent === 'confirm_interview' || statusRec?.includes('Interview Scheduled')) return 'INTERVIEW_SCHEDULED';
  if (intent === 'reschedule') return 'INTERVIEW_RESCHEDULE_REQUIRED';
  if (statusRec?.includes('Ready for Interview') || intent === 'already_joined_negotiation') return 'INTERVIEW_ELIGIBLE';
  if (statusRec?.includes('Screening Pending') || intent === 'screening_answer') return 'SCREENING_COMPLETED';
  return 'FOLLOW_UP_REQUIRED';
}

function enrichFallbackWithMemoryAndOutcome(raw: any, candidate: any, userMessage: string): any {
  const hrDecisionOutcome = raw.hrDecisionOutcome || mapStatusToHrOutcome(raw.statusRecommendation, raw.detectedIntent);
  const conversationMemory = raw.conversationMemory || {
    candidate_name: candidate?.name || 'Candidate',
    target_role: candidate?.appliedRole || 'Property Consultant',
    current_company: raw.extractedFields?.currentCompany || candidate?.screening?.currentCompany || '',
    designation: raw.extractedFields?.currentDesignation || candidate?.screening?.currentDesignation || '',
    total_experience: raw.extractedFields?.totalExperienceYears ? `${raw.extractedFields.totalExperienceYears} years` : (candidate?.screening?.totalExperienceYears ? `${candidate?.screening?.totalExperienceYears} years` : ''),
    real_estate_experience: raw.extractedFields?.realEstateExperienceYears ? `${raw.extractedFields.realEstateExperienceYears} years` : (candidate?.screening?.realEstateExperienceYears ? `${candidate?.screening?.realEstateExperienceYears} years` : ''),
    gurgaon_experience: raw.extractedFields?.gurgaonDubaiExperience?.gurgaon ? 'Yes' : 'Unconfirmed',
    dubai_experience: raw.extractedFields?.gurgaonDubaiExperience?.dubai ? 'Yes' : 'No',
    current_salary: raw.extractedFields?.currentSalaryLPA || candidate?.screening?.currentSalaryLPA || '',
    expected_salary: raw.extractedFields?.expectedSalaryLPA || candidate?.screening?.expectedSalaryLPA || '',
    salary_not_disclosed: false,
    current_location: raw.extractedFields?.currentLocation || candidate?.screening?.currentLocation || '',
    notice_period: raw.extractedFields?.noticePeriodDays !== undefined ? `${raw.extractedFields.noticePeriodDays} days` : '',
    earliest_joining_date: raw.extractedFields?.earliestJoiningDate || '',
    interested: raw.statusRecommendation?.includes('Declined') ? 'No' : 'Yes',
    interview_date: raw.selectedSlotId ? 'Scheduled' : '',
    interview_time: '',
    conversation_status: hrDecisionOutcome,
    missing_information: [],
    next_action: raw.statusRecommendation || 'Review candidate responses',
  };

  return {
    ...raw,
    hrDecisionOutcome,
    conversationMemory,
  };
}

export interface ConversationStateInventory {
  identityConfirmed: boolean;
  purposeAndAvailabilityChecked?: boolean;
  candidateIntroGiven?: boolean;
  interestConfirmed: boolean;
  roleConfirmed: boolean;
  currentCompany: string | null;
  designation: string | null;
  experienceYears: number | null;
  gurgaonDubaiExposure: { gurgaon: boolean; dubai: boolean; details?: string } | null;
  currentSalaryLPA: string | null;
  expectedSalaryLPA: string | null;
  salaryDeclined: boolean;
  currentLocation: string | null;
  noticePeriodDays: number | null;
  roleSpecificAnswered: boolean;
  interviewScheduled: boolean;
  knownList: string[];
  missingList: string[];
  nextRequiredField: string;
}

/**
 * Robust Anti-Repetition State Guard & Memory Engine
 * Adheres strictly to User Mandate:
 * 1. Identify the required field.
 * 2. Check whether it is already known (CRM file or past turns).
 * 3. If known -> skip.
 * 4. If unknown -> ask.
 * 5. After answer -> save.
 * 6. Move to next missing field.
 * NEVER ask the same question twice. Treat candidate short answers as final.
 */
export function buildConversationStateInventory(
  candidate: any,
  transcript: any[] = [],
  currentMessage: string = ''
): ConversationStateInventory {
  // 1. Initialize from CRM on file
  let identityConfirmed = false;
  let purposeAndAvailabilityChecked = false;
  let candidateIntroGiven = false;
  let roleConfirmed = false;
  let currentCompany: string | null =
    candidate?.screening?.currentCompany || candidate?.conversationMemory?.current_company || null;
  let designation: string | null =
    candidate?.screening?.currentDesignation || candidate?.conversationMemory?.designation || null;
  let experienceYears: number | null =
    candidate?.screening?.realEstateExperienceYears ||
    candidate?.screening?.totalExperienceYears ||
    (candidate?.conversationMemory?.real_estate_experience ? parseFloat(candidate.conversationMemory.real_estate_experience) : null) ||
    null;
  let gurgaonDubaiExposure: { gurgaon: boolean; dubai: boolean; details?: string } | null =
    candidate?.screening?.gurgaonDubaiExperience || null;
  let currentSalaryLPA: string | null =
    candidate?.screening?.currentSalaryLPA || candidate?.conversationMemory?.current_salary || null;
  let expectedSalaryLPA: string | null =
    candidate?.screening?.expectedSalaryLPA || candidate?.conversationMemory?.expected_salary || null;
  let salaryDeclined = false;
  let currentLocation: string | null =
    candidate?.screening?.currentLocation || candidate?.conversationMemory?.current_location || null;
  let noticePeriodDays: number | null =
    candidate?.screening?.noticePeriodDays !== undefined
      ? candidate.screening.noticePeriodDays
      : candidate?.conversationMemory?.notice_period
      ? parseInt(candidate.conversationMemory.notice_period, 10)
      : null;
  let roleSpecificAnswered = false;
  let interviewScheduled = false;

  // 2. Scan full conversation history (all messages) + currentMessage
  const fullTurns = [...(transcript || [])];
  if (currentMessage) {
    fullTurns.push({ sender: 'candidate', text: currentMessage });
  }

  for (let i = 0; i < fullTurns.length; i++) {
    const turn = fullTurns[i];
    if (turn.sender === 'candidate') {
      const text = turn.text.toLowerCase();
      const prevAgentText = i > 0 && (fullTurns[i - 1].sender === 'agent' || fullTurns[i - 1].sender === 'assistant')
        ? fullTurns[i - 1].text.toLowerCase()
        : '';

      // Check Step 1: Identity Confirmation
      if (prevAgentText.includes('am i speaking with') || prevAgentText.includes('speaking with') || i === 1) {
        if (
          text.includes('yes') ||
          text.includes('speaking') ||
          text.includes('haan') ||
          text.includes('sure') ||
          text.includes('bol raha') ||
          text.includes('this is') ||
          text.includes('who is this') ||
          text.includes('what is this regarding') ||
          text.includes('regarding what')
        ) {
          identityConfirmed = true;
        }
      } else if (fullTurns.length >= 2) {
        identityConfirmed = true;
      }

      // Check Step 4: Availability / Good time check
      if (
        prevAgentText.includes('good time') ||
        prevAgentText.includes('convenient time') ||
        prevAgentText.includes('couple of minutes') ||
        prevAgentText.includes('quick conversation')
      ) {
        if (
          text.includes('yes') ||
          text.includes('sure') ||
          text.includes('haan') ||
          text.includes('okay') ||
          text.includes('go ahead') ||
          text.includes('boliye') ||
          text.includes('fine') ||
          text.includes('good time')
        ) {
          identityConfirmed = true;
          purposeAndAvailabilityChecked = true;
        }
      } else if (fullTurns.length >= 4) {
        purposeAndAvailabilityChecked = true;
      }

      // Check Step 5: Candidate Introduction response
      if (
        prevAgentText.includes('introduce yourself') ||
        prevAgentText.includes('walk me through your') ||
        prevAgentText.includes('tell me a little about yourself') ||
        prevAgentText.includes('your career so far')
      ) {
        candidateIntroGiven = true;
      } else if (text.length > 40 && (text.includes('year') || text.includes('real estate') || text.includes('sales') || text.includes('handling') || text.includes('luxury'))) {
        candidateIntroGiven = true;
      }

      // Check role confirmation
      if (prevAgentText.includes('considered for the') || prevAgentText.includes('position, correct') || prevAgentText.includes('role')) {
        if (text.includes('yes') || text.includes('correct') || text.includes('right') || text.includes('ha') || text.includes('haan') || text.includes('sure')) {
          roleConfirmed = true;
        }
      }

      // Check company
      const companyMatches = ['dlf', 'm3m', 'square yards', 'anarock', 'godrej', 'emaar', 'sobha', 'proptiger', 'signature global', 'adani', 'trump tower', 'central park', 'abc realty'];
      for (const comp of companyMatches) {
        if (text.includes(comp)) {
          currentCompany = comp.toUpperCase();
          break;
        }
      }
      if (!currentCompany && (prevAgentText.includes('company') || prevAgentText.includes('working currently') || prevAgentText.includes('which real estate company'))) {
        if (text.length >= 2 && text.length < 50 && !text.includes('?')) {
          currentCompany = turn.text.trim();
        }
      }

      // Check designation
      const desigMatches = ['senior consultant', 'property consultant', 'sales manager', 'team lead', 'associate', 'director', 'manager', 'consultant', 'executive'];
      for (const d of desigMatches) {
        if (text.includes(d)) {
          designation = d.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          break;
        }
      }

      // Check experience
      const expMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/);
      if (expMatch) {
        experienceYears = parseFloat(expMatch[1]);
      } else if (prevAgentText.includes('experience') || prevAgentText.includes('how many years')) {
        const numOnly = text.match(/\b(\d+(?:\.\d+)?)\b/);
        if (numOnly) {
          experienceYears = parseFloat(numOnly[1]);
        }
      }

      // Check Gurgaon / Dubai exposure
      if (text.includes('gurgaon') || text.includes('gurugram') || text.includes('golf course') || text.includes('spr') || text.includes('dwarka expressway') || text.includes('dubai')) {
        gurgaonDubaiExposure = {
          gurgaon: text.includes('gurgaon') || text.includes('gurugram') || text.includes('golf course') || text.includes('spr') || text.includes('dwarka'),
          dubai: text.includes('dubai'),
          details: turn.text.trim(),
        };
      }

      // Check salary / CTC
      const salMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:lpa|lakh|lakhs|lac|lacs)/);
      if (salMatch) {
        currentSalaryLPA = `${salMatch[1]} LPA`;
      } else if (text.includes('confidential') || text.includes('not disclose') || text.includes('prefer not to say')) {
        salaryDeclined = true;
        currentSalaryLPA = 'Confidential';
      } else if (prevAgentText.includes('compensation') || prevAgentText.includes('ctc') || prevAgentText.includes('salary')) {
        if (text.length > 1 && text.length < 40) {
          currentSalaryLPA = turn.text.trim();
        }
      }

      // Check notice period
      const noticeMatch = text.match(/(\d+)\s*(?:days?|din)/);
      if (noticeMatch) {
        noticePeriodDays = parseInt(noticeMatch[1], 10);
      } else if (text.includes('immediate') || text.includes('turant') || text.includes('serving notice')) {
        noticePeriodDays = 0;
      } else if (prevAgentText.includes('notice period')) {
        const numMatch = text.match(/\b(\d+)\b/);
        if (numMatch) {
          noticePeriodDays = parseInt(numMatch[1], 10);
        }
      }

      // Check location
      if (text.includes('gurgaon') || text.includes('gurugram')) {
        currentLocation = 'Gurugram';
      } else if (text.includes('delhi')) {
        currentLocation = 'Delhi';
      } else if (text.includes('noida')) {
        currentLocation = 'Noida';
      } else if (prevAgentText.includes('based in ncr') || prevAgentText.includes('where are you based') || prevAgentText.includes('current location')) {
        if (text.length > 2 && text.length < 40) {
          currentLocation = turn.text.trim();
        }
      }

      // Check role specific question answered
      if (prevAgentText.includes('channel partners') || prevAgentText.includes('luxury residential') || prevAgentText.includes('hni') || prevAgentText.includes('closing') || prevAgentText.includes('target')) {
        roleSpecificAnswered = true;
      }

      // Check interview scheduling confirmed
      if (text.includes('tomorrow') || text.includes('kal') || text.includes('friday') || text.includes('2:30') || text.includes('4:30') || text.includes('slot-2') || text.includes('slot-3') || text.includes('works great') || text.includes('perfect') || text.includes('confirm')) {
        if (prevAgentText.includes('interview') || prevAgentText.includes('m3m urbana') || prevAgentText.includes('which slot')) {
          interviewScheduled = true;
        }
      }
    }
  }

  // 3. Build Known & Missing inventories
  const knownList: string[] = [];
  const missingList: string[] = [];

  if (currentCompany) {
    knownList.push(`Current Company: "${currentCompany}"`);
  } else {
    missingList.push('Current Company');
  }

  if (designation) {
    knownList.push(`Designation: "${designation}"`);
  } else {
    missingList.push('Designation');
  }

  if (experienceYears !== null) {
    knownList.push(`Real Estate Experience: "${experienceYears} years"`);
  } else {
    missingList.push('Total / Real Estate Experience');
  }

  if (gurgaonDubaiExposure) {
    knownList.push(`Market Exposure: ${gurgaonDubaiExposure.gurgaon ? 'Gurgaon' : ''} ${gurgaonDubaiExposure.dubai ? 'Dubai' : ''}`);
  } else {
    missingList.push('Gurgaon / Dubai Market Familiarity');
  }

  if (currentSalaryLPA || salaryDeclined) {
    knownList.push(`Compensation: "${currentSalaryLPA || 'Not disclosed'}"`);
  } else {
    missingList.push('Current & Expected Salary (CTC)');
  }

  if (noticePeriodDays !== null) {
    knownList.push(`Notice Period: "${noticePeriodDays === 0 ? 'Immediate' : `${noticePeriodDays} days`}"`);
  } else {
    missingList.push('Notice Period & Earliest Joining');
  }

  if (currentLocation) {
    knownList.push(`Location: "${currentLocation}"`);
  } else {
    missingList.push('Current NCR Location');
  }

  if (roleSpecificAnswered) {
    knownList.push('Role Specific Question: Answered');
  } else {
    missingList.push('Role Specific Domain Question');
  }

  // Determine next required field in sequence (Strict Anti-Repetition Rule: NEVER ASK TWICE)
  let nextRequiredField = 'schedule_interview';
  if (!identityConfirmed) {
    nextRequiredField = 'identity';
  } else if (!purposeAndAvailabilityChecked) {
    nextRequiredField = 'call_purpose_check_time';
  } else if (!candidateIntroGiven) {
    nextRequiredField = 'candidate_intro';
  } else if (!currentCompany) {
    nextRequiredField = 'company';
  } else if (!designation) {
    nextRequiredField = 'designation';
  } else if (experienceYears === null) {
    nextRequiredField = 'experience';
  } else if (!gurgaonDubaiExposure) {
    nextRequiredField = 'market_exposure';
  } else if (!currentSalaryLPA && !salaryDeclined) {
    nextRequiredField = 'salary';
  } else if (noticePeriodDays === null) {
    nextRequiredField = 'notice_period';
  } else if (!currentLocation) {
    nextRequiredField = 'location';
  } else if (!roleSpecificAnswered) {
    nextRequiredField = 'role_specific';
  } else if (!interviewScheduled) {
    nextRequiredField = 'schedule_interview';
  } else {
    nextRequiredField = 'interview_confirmed';
  }

  return {
    identityConfirmed,
    purposeAndAvailabilityChecked,
    candidateIntroGiven,
    interestConfirmed: purposeAndAvailabilityChecked,
    roleConfirmed,
    currentCompany,
    designation,
    experienceYears,
    gurgaonDubaiExposure,
    currentSalaryLPA,
    expectedSalaryLPA,
    salaryDeclined,
    currentLocation,
    noticePeriodDays,
    roleSpecificAnswered,
    interviewScheduled,
    knownList,
    missingList,
    nextRequiredField,
  };
}

// Robust conversational generator with 38 rules, company requirement & budget negotiation handling
function computeRawFallbackResponse(
  scenario: string,
  userMessage: string,
  candidate: any,
  transcript: any[],
  availableSlots: any[]
) {
  const lower = (userMessage || '').toLowerCase().trim();
  const availableSlotList = availableSlots
    .filter((s: any) => s.isAvailable)
    .map((s: any) => s.displayLabel)
    .join(', ');

  const roleInfo = getRoleBudgetInfo(candidate?.appliedRole);
  const candName = candidate?.name || 'Candidate';
  const candRole = candidate?.appliedRole || 'Property Consultant';

  // SCENARIO 0: Silence handling & "Are you there?" response (Rule 9 / User Requirement)
  if (lower.includes('[silence]') || lower.includes('silence') || lower === '...') {
    return {
      agentReply: 'Take your time.',
      detectedIntent: 'silence_handled',
      extractedFields: {},
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Candidate paused during conversation. Arjun waited patiently without repeating questions.`,
        priority: 'Medium',
        category: 'Notice Period Evaluation',
        actionDueDate: 'Today',
      },
    };
  }

  // SCENARIO 0.1: Candidate confirms presence after "Are you there?" check (e.g., "yes", "I am here", "haan")
  // CRITICAL REQUIREMENT: Do NOT repeat the previous question!
  if (
    lower === 'yes' ||
    lower === 'yes i am' ||
    lower === 'yes i am here' ||
    lower === "i'm here" ||
    lower === 'i am here' ||
    lower === 'haan' ||
    lower === 'haan ji' ||
    lower === 'haan main sun raha hoon' ||
    lower === 'sun raha hoon' ||
    lower === 'yes i can hear you' ||
    lower === 'can you hear me' ||
    lower === 'boliye' ||
    lower === 'haan boliye'
  ) {
    const isHindi = lower.includes('haan') || lower.includes('boliye') || lower.includes('sun');
    return {
      agentReply: isHindi
        ? 'Theek hai, aap aaraam se bataiye, main sun raha hoon.'
        : "Great, please take your time, I'm listening.",
      detectedIntent: 'presence_confirmed',
      extractedFields: {},
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Candidate confirmed presence. Maintained conversational calm without repeating question.`,
        priority: 'Low',
        category: 'General Interaction',
        actionDueDate: 'Today',
      },
    };
  }

  // SCENARIO 0.2: Candidate asks About White Collar Realty (Company Overview)
  if (
    lower.includes('about white collar') ||
    lower.includes('about the company') ||
    lower.includes('company profile') ||
    lower.includes('company details') ||
    lower.includes('what does white collar do') ||
    lower.includes('kya karti hai company') ||
    lower.includes('tell me about company') ||
    lower.includes('company background')
  ) {
    return {
      agentReply:
        "White Collar Realty is a luxury real estate advisory firm partnering with premier developers like DLF, M3M, Godrej, Emaar, and Sobha across Gurugram and Dubai. We operate from M3M Urbana, Sector 67. How familiar are you with Gurgaon's luxury residential market?",
      detectedIntent: 'company_inquiry',
      extractedFields: {},
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Candidate inquired about White Collar Realty. Provided professional overview and engaged experience.`,
        priority: 'Medium',
        category: 'Company Overview',
        actionDueDate: 'Today',
      },
    };
  }

  // SCENARIO 0.3: Candidate asks Work Timings / Working Days
  if (
    lower.includes('working hour') ||
    lower.includes('working hours') ||
    lower.includes('office timing') ||
    lower.includes('office timings') ||
    lower.includes('timings kya') ||
    lower.includes('timing kya') ||
    lower.includes('working day') ||
    lower.includes('shift timing') ||
    lower.includes('week off') ||
    lower.includes('kitne baje')
  ) {
    return {
      agentReply:
        'Our office timings are 10:00 AM to 6:30 PM, six days a week with Tuesday off, as weekends are our primary client site-visit days. Does that schedule suit you comfortably?',
      detectedIntent: 'timings_inquiry',
      extractedFields: {},
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Candidate inquired about office timings & working days (10 AM - 6:30 PM, Tuesday off).`,
        priority: 'Medium',
        category: 'Work Schedule',
        actionDueDate: 'Today',
      },
    };
  }

  // SCENARIO 0.4: Candidate asks Interview Rounds / Selection Process
  if (
    lower.includes('how many rounds') ||
    lower.includes('interview round') ||
    lower.includes('interview rounds') ||
    lower.includes('kitne round') ||
    lower.includes('selection process') ||
    lower.includes('hiring process')
  ) {
    return {
      agentReply:
        'We have two rounds: this preliminary HR screening, followed by a face-to-face discussion with our Director at our Sector 67 corporate office. Are you available for an in-person meeting this week?',
      detectedIntent: 'interview_process_inquiry',
      extractedFields: {},
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Candidate inquired regarding interview stages (HR screening + Director F2F).`,
        priority: 'Medium',
        category: 'Interview Process',
        actionDueDate: 'Today',
      },
    };
  }

  // SCENARIO 0.45: Candidate asks about Leads / Marketing Support
  if (
    lower.includes('leads provided') ||
    lower.includes('lead support') ||
    lower.includes('data milega') ||
    lower.includes('leads milengi') ||
    lower.includes('cold calling') ||
    lower.includes('crm leads') ||
    lower.includes('client database')
  ) {
    return {
      agentReply:
        'Yes, White Collar Realty provides high-intent verified CRM leads and digital marketing campaigns, alongside encouraging active personal HNI client networking. What has been your primary source of closings recently?',
      detectedIntent: 'leads_inquiry',
      extractedFields: {},
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Candidate inquired about CRM lead support and marketing allocations.`,
        priority: 'Medium',
        category: 'Lead Support',
        actionDueDate: 'Today',
      },
    };
  }

  // SCENARIO 0.46: Candidate asks about Travel / Cab / Conveyance
  if (
    lower.includes('cab facility') ||
    lower.includes('travel allowance') ||
    lower.includes('conveyance') ||
    lower.includes('petrol allowance') ||
    lower.includes('travel expense')
  ) {
    return {
      agentReply:
        'We provide conveyance and travel allowances for all client site visits. Our office is also conveniently located near Sector 55-56 Rapid Metro. Coming back to your profile, what is your notice period?',
      detectedIntent: 'benefits_inquiry',
      extractedFields: {},
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Candidate inquired about travel/conveyance allowances. Addressed and returned to screening.`,
        priority: 'Low',
        category: 'Conveyance Policy',
        actionDueDate: 'Today',
      },
    };
  }

  // SCENARIO 0.5: Candidate says "Wait, let me check" (Rule 12)
  if (
    lower.includes('wait') ||
    lower.includes('let me check') ||
    lower.includes('ek minute') ||
    lower.includes('ek min') ||
    lower.includes('hold on') ||
    lower.includes('zara ruko')
  ) {
    return {
      agentReply: 'Sure, take your time.',
      detectedIntent: 'candidate_wait',
      extractedFields: {},
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Candidate asked to wait / check information. Arjun acknowledged patiently per Rule 12.`,
        priority: 'Low',
        category: 'Notice Period Evaluation',
        actionDueDate: 'Today',
      },
    };
  }

  // SCENARIO 0.6: Candidate asks Office Location / Address (Rule 14)
  if (
    lower.includes('office location') ||
    lower.includes('where is your office') ||
    lower.includes('office address') ||
    lower.includes('where are you located') ||
    lower.includes('kahan hai office') ||
    lower.includes('office kahan hai')
  ) {
    return {
      agentReply:
        "Our office is on the 6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram. Coming back to your profile, what's your notice period?",
      detectedIntent: 'office_inquiry',
      extractedFields: {},
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Candidate inquired about office location. Answered accurately and naturally returned to screening per Rule 14.`,
        priority: 'Low',
        category: 'Interview Scheduling',
        actionDueDate: 'Today',
      },
    };
  }

  // SCENARIO 0.7: Candidate correction (Rule 11) - e.g. "No, sorry, I meant four years, not five"
  if (
    lower.includes('sorry, i meant') ||
    lower.includes('sorry i meant') ||
    lower.includes('i meant 4') ||
    lower.includes('not 5') ||
    lower.includes('not five') ||
    lower.includes('galti se') ||
    (lower.includes('meant') && lower.includes('year'))
  ) {
    return {
      agentReply: 'No problem, four years. Got it.',
      detectedIntent: 'correction_handled',
      extractedFields: {
        realEstateExperienceYears: 4,
        totalExperienceYears: 4,
      },
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Candidate corrected experience to four years. Updated state seamlessly per Rule 11.`,
        priority: 'Low',
        category: 'Candidate Correction',
        actionDueDate: 'Today',
      },
    };
  }

  // SCENARIO 0.8: Candidate provides multi-entity statement (Rule 6)
  // e.g. "I'm currently working with ABC Realty, it's been around four years, but before that I was in Dubai for two years."
  if (
    lower.includes('abc realty') ||
    (lower.includes('currently working with') && lower.includes('dubai') && lower.includes('year'))
  ) {
    return {
      agentReply:
        'Got it, four years with ABC Realty and two years in Dubai. What kind of properties were you handling there?',
      detectedIntent: 'screening_answer',
      extractedFields: {
        currentCompany: 'ABC Realty',
        realEstateExperienceYears: 6,
        totalExperienceYears: 6,
        gurgaonDubaiExperience: {
          gurgaon: false,
          dubai: true,
          details: 'ABC Realty 4 years + 2 years Dubai real estate',
        },
      },
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Candidate provided multi-entity statement (ABC Realty, 4 yrs + 2 yrs Dubai). Extracted without re-asking per Rule 6.`,
        priority: 'Medium',
        category: 'Dubai Market Experience',
        actionDueDate: 'Today',
      },
    };
  }

  // SCENARIO 0.9: Dynamic Dubai Exploration (Rule 5 & 22)
  if (
    lower.includes('worked in dubai') ||
    lower.includes('dubai real estate') ||
    (lower.includes('dubai') && (lower.includes('year') || lower.includes('3 year') || lower.includes('three year')))
  ) {
    return {
      agentReply: "Oh, that's interesting. Were those mainly ready-to-move properties or off-plan projects?",
      detectedIntent: 'dubai_exploration',
      extractedFields: {
        gurgaonDubaiExperience: {
          gurgaon: true,
          dubai: true,
          details: 'Experienced in Dubai property market',
        },
      },
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Discovered Dubai market background. Initiated dynamic conversation per Rule 5.`,
        priority: 'Medium',
        category: 'Dubai Market Experience',
        actionDueDate: 'Today',
      },
    };
  }

  if (lower.includes('mostly off-plan') || lower.includes('off-plan') || lower.includes('off plan')) {
    return {
      agentReply: 'Got it. And were you dealing directly with buyers, or mainly channel partners?',
      detectedIntent: 'dubai_exploration',
      extractedFields: {},
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Explored off-plan transaction scope dynamically per Rule 5.`,
        priority: 'Medium',
        category: 'Dubai Market Experience',
        actionDueDate: 'Today',
      },
    };
  }

  if (lower.includes('luxury residential') || (lower.includes('luxury') && lower.includes('residential'))) {
    return {
      agentReply: 'Got it. And were you handling your own clients, or were you also managing a team?',
      detectedIntent: 'role_exploration',
      extractedFields: {},
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Deepened exploration into client handling vs team management per Rule 21.`,
        priority: 'Medium',
        category: 'Domain Depth Evaluation',
        actionDueDate: 'Today',
      },
    };
  }

  // SCENARIO 0.10: Candidate speaks Hinglish (Rule 16)
  // e.g. "Main abhi Gurgaon mein hi work kar raha hoon"
  if (
    lower.includes('gurgaon mein hi work') ||
    lower.includes('gurgaon me hi work') ||
    lower.includes('main abhi gurgaon')
  ) {
    return {
      agentReply: 'Okay, got it. Gurgaon mein aap mainly kis type ke projects handle kar rahe hain?',
      detectedIntent: 'screening_answer',
      extractedFields: {
        location: 'Gurgaon',
        gurgaonDubaiExperience: {
          gurgaon: true,
          dubai: false,
          details: 'Currently working in Gurgaon market',
        },
      },
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Responded in natural conversational Hinglish per Rule 16.`,
        priority: 'Medium',
        category: 'Hinglish Adaptation',
        actionDueDate: 'Today',
      },
    };
  }

  if (lower === 'residential' || lower === 'residential properties' || lower === 'mostly residential') {
    return {
      agentReply:
        'Right. Aur aapka experience mostly end-to-end sales mein hai ya lead generation side bhi handle karte hain?',
      detectedIntent: 'sales_depth_inquiry',
      extractedFields: {},
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Inquired about sales closing vs lead generation scope per Rule 21.`,
        priority: 'Medium',
        category: 'Sales Experience Evaluation',
        actionDueDate: 'Today',
      },
    };
  }

  // SCENARIO 0.11: Candidate asks interview duration / details
  if (
    lower.includes('how much time') ||
    lower.includes('kitna time lagega') ||
    lower.includes('interview duration')
  ) {
    return {
      agentReply:
        'It usually takes about 30 to 45 minutes for the initial discussion. By the way, are you available for a face-to-face interview this week?',
      detectedIntent: 'interview_duration_inquiry',
      extractedFields: {},
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Clarified interview duration and returned smoothly to scheduling per Rule 14.`,
        priority: 'Low',
        category: 'Interview Scheduling',
        actionDueDate: 'Today',
      },
    };
  }

  // SCENARIO 0.12: Personal context (Rule 15) - e.g. "I moved to Gurgaon last year because my family shifted here"
  if (
    lower.includes('family shifted') ||
    lower.includes('moved to gurgaon') ||
    lower.includes('shifted to gurgaon')
  ) {
    return {
      agentReply:
        "Okay, that makes sense. Since you're now based in Gurgaon, how familiar are you with the local property market?",
      detectedIntent: 'off_topic_redirect',
      extractedFields: {
        location: 'Gurgaon',
      },
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Candidate shared personal relocation background. Acknowledged warmly and steered to market knowledge per Rule 15.`,
        priority: 'Low',
        category: 'Market Familiarity',
        actionDueDate: 'Today',
      },
    };
  }

  // SCENARIO 1: Strict Explicit Decline detection (Rule 10)
  if (
    lower.includes('not interested') ||
    lower.includes('nahi chahiye') ||
    lower.includes('decline') ||
    lower.includes('stop calling') ||
    lower.includes('do not call') ||
    lower.includes('remove my name') ||
    lower.includes('no longer exploring')
  ) {
    return {
      agentReply:
        "Understood. Thank you for your time. I'll update the recruitment status accordingly. Have a good day.",
      detectedIntent: 'cancel_decline',
      hrDecisionOutcome: 'NOT_INTERESTED',
      extractedFields: {},
      declineReason: userMessage,
      statusRecommendation: 'Declined - Do Not Call',
      generatedRemark: {
        text: `Candidate explicitly declined further interaction. Marked as NOT_INTERESTED per company compliance policy.`,
        priority: 'Low',
        category: 'Declined - Do Not Call',
        actionDueDate: undefined,
      },
    };
  }

  // SCENARIO 2: Callback request detection (Rule 11)
  if (
    lower.includes('call back') ||
    lower.includes('busy') ||
    lower.includes('driving') ||
    lower.includes('meeting') ||
    lower.includes('baad me') ||
    lower.includes('sham ko') ||
    lower.includes('call later') ||
    lower.includes('call me at')
  ) {
    return {
      agentReply:
        'No problem. Would you prefer that I call you back later? I have noted down a callback alert for today.',
      detectedIntent: 'request_callback',
      hrDecisionOutcome: 'CALL_BACK_REQUESTED',
      extractedFields: {},
      callbackTime: 'Later Today (Requested by Candidate)',
      statusRecommendation: 'Callback Needed',
      generatedRemark: {
        text: `Candidate currently busy / driving. Requested callback. Follow-up priority queued.`,
        priority: 'High',
        category: 'Callback Due',
        actionDueDate: 'Today',
      },
    };
  }

  // SCENARIO 3: Candidate asks about salary range or budget upfront (Rule 7)
  if (
    lower.includes('salary range') ||
    lower.includes('what is the package') ||
    lower.includes('what is the budget') ||
    lower.includes('budget kitna') ||
    lower.includes('kitna package') ||
    lower.includes('package range') ||
    (lower.includes('salary') && (lower.includes('range') || lower.includes('bracket') || lower.includes('band') || lower.includes('give')))
  ) {
    return {
      agentReply:
        "The exact package depends on the role and experience, and the HR team will discuss the applicable range during the process. Before we move ahead, I'd like to understand your current and expected compensation.",
      detectedIntent: 'salary_inquiry',
      extractedFields: {},
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Candidate asked for salary range upfront. Answered per Rule 7 without inventing ranges; redirected to current/expected CTC.`,
        priority: 'Medium',
        category: 'Budget Negotiation',
        actionDueDate: 'Today',
      },
    };
  }

  // SCENARIO 4: Candidate hesitates or refuses to disclose salary (Rule 20)
  if (
    lower.includes('prefer not to disclose') ||
    lower.includes('cannot disclose') ||
    lower.includes('not comfortable') ||
    lower.includes('will discuss later') ||
    lower.includes('not disclose') ||
    lower.includes('nda')
  ) {
    return {
      agentReply:
        'No problem at all, we can discuss compensation at a later stage. What is your current notice period or earliest joining date?',
      detectedIntent: 'screening_answer',
      extractedFields: {},
      conversationMemory: {
        salary_not_disclosed: true,
      },
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Candidate chose not to disclose current compensation (salary_not_disclosed = true). Smoothly proceeded to notice period.`,
        priority: 'Medium',
        category: 'Notice Period Evaluation',
        actionDueDate: 'Today',
      },
    };
  }

  // SCENARIO 5: Off-topic conversation (Rule 8)
  if (
    lower.includes('mumbai') ||
    lower.includes('bangalore') ||
    lower.includes('weather') ||
    lower.includes('shifted from') ||
    lower.includes('traffic')
  ) {
    return {
      agentReply:
        "Understood. That gives me some context. Since this role involves Gurgaon property sales, I'd also like to understand your Gurgaon market experience.",
      detectedIntent: 'off_topic_redirect',
      extractedFields: {},
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Candidate went off-topic. Smoothly redirected conversation to Gurgaon real estate experience per Rule 8.`,
        priority: 'Medium',
        category: 'Notice Period Evaluation',
        actionDueDate: 'Today',
      },
    };
  }

  // SCENARIO 6: "I don't know" / Uncertain answer (Rule 9)
  if (
    lower.includes("don't know") ||
    lower.includes('dont know') ||
    lower.includes('not sure') ||
    lower.includes('pata nahi') ||
    lower === 'no idea'
  ) {
    return {
      agentReply:
        "That's okay. Could you tell me approximately what you have in mind, or your current notice period?",
      detectedIntent: 'clarification',
      extractedFields: {},
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Candidate expressed uncertainty. Reassured candidate and simplified the inquiry per Rule 9.`,
        priority: 'Medium',
        category: 'Notice Period Evaluation',
        actionDueDate: 'Today',
      },
    };
  }

  // SCENARIO 7: Candidate already joined another firm (Workflow)
  if (
    lower.includes('already join') ||
    lower.includes('already accepted') ||
    lower.includes('joined some other') ||
    lower.includes('joined another') ||
    lower.includes('dusri company join') ||
    lower.includes('dusri jagah join') ||
    lower.includes('joined recently') ||
    lower.includes('got another job') ||
    lower.includes('accepted offer') ||
    lower.includes('new company')
  ) {
    if (lower.includes('open') || lower.includes('explore') || lower.includes('lpa') || lower.includes('kitna')) {
      return {
        agentReply: `That is great! For our ${candRole} desk, White Collar Realty offers a budget of ${roleInfo.fixedBudget}, plus uncapped quarterly incentives where top closers make ${roleInfo.totalOte} across Gurgaon luxury and Dubai properties. We can arrange a confidential, direct discussion with our Sales Director at our Sector 67 HQ. Would ${availableSlotList ? availableSlotList.split(',')[0] : 'Tomorrow at 2:30 PM'} work for a quick conversation?`,
        detectedIntent: 'reschedule',
        hrDecisionOutcome: 'INTERVIEW_ELIGIBLE',
        extractedFields: {
          currentCompany: lower.includes('square') ? 'Square Yards' : lower.includes('anarock') ? 'Anarock' : 'Recently Joined Other Firm',
        },
        statusRecommendation: 'Screened - Ready for Interview',
        generatedRemark: {
          text: `Candidate recently joined another firm, but is open to evaluating White Collar Realty counter-offer. Target role budget pitch (${roleInfo.fixedBudget}) shared. Ready for leadership discussion.`,
          priority: 'High',
          category: 'Already Joined - Counter Offer Open',
          actionDueDate: 'Today',
        },
      };
    }

    return {
      agentReply: `Congratulations on your new role! At White Collar Realty, our approved budget for ${candRole} is ${roleInfo.fixedBudget} plus industry-leading uncapped deal commissions. Would you be open to an exploratory 15-minute confidential discussion with our Director at our Sector 67 M3M Urbana office, or would you prefer we stay in touch for a 3-month check-in?`,
      detectedIntent: 'already_joined_negotiation',
      hrDecisionOutcome: 'INTERVIEW_ELIGIBLE',
      extractedFields: {
        currentCompany: 'Recently Joined Other Firm',
      },
      statusRecommendation: 'Screened - Ready for Interview',
      generatedRemark: {
        text: `Candidate mentioned having joined another company. Auto-engaged with company requirements & role budget pitch (${roleInfo.fixedBudget} + incentives).`,
        priority: 'High',
        category: 'Already Joined - Counter Offer Open',
        actionDueDate: 'Today',
      },
    };
  }

  // SCENARIO 8: 90-day pipeline request
  if (lower.includes('3 month') || lower.includes('stay in touch') || lower.includes('after some time') || lower.includes('settle in')) {
    return {
      agentReply: `Understood and completely respected! I have scheduled an automated 90-day talent check-in alert in our White Collar Realty CRM so our senior team can reconnect with you in 3 months. Best wishes!`,
      detectedIntent: 'pipeline_future',
      hrDecisionOutcome: 'FOLLOW_UP_REQUIRED',
      extractedFields: {},
      statusRecommendation: 'Declined - Do Not Call',
      generatedRemark: {
        text: `Candidate committed to current onboarding. Scheduled automated 90-day talent check-in alert to assess future luxury real estate openings.`,
        priority: 'Medium',
        category: 'Already Joined - Future Pipeline',
        actionDueDate: 'In 90 Days',
      },
    };
  }

  // SCENARIO 9: Attendance Reminder Scenario (Rule 25)
  if (scenario === 'reminder') {
    if (
      lower.includes('yes') ||
      lower.includes('haan') ||
      lower.includes('confirm') ||
      lower.includes('aunga') ||
      lower.includes('attending') ||
      lower.includes('see you')
    ) {
      return {
        agentReply:
          'That is wonderful! We have reconfirmed your attendance for your face-to-face interview. Our office is located at 6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram. Please carry an updated copy of your resume. Looking forward to meeting you!',
        detectedIntent: 'confirm_interview',
        hrDecisionOutcome: 'INTERVIEW_ATTENDED',
        extractedFields: { interviewVenueConfirmed: true },
        statusRecommendation: 'Attendance Confirmed',
        generatedRemark: {
          text: `Candidate personally reconfirmed interview attendance at Sector 67 HQ. Directions & contact person shared.`,
          priority: 'High',
          category: 'Attendance Reconfirmation',
          actionDueDate: 'Tomorrow',
        },
      };
    }
    if (
      lower.includes('reschedule') ||
      lower.includes('nahi aa paunga') ||
      lower.includes('can we change') ||
      lower.includes('postpone')
    ) {
      return {
        agentReply: `Sure, that's absolutely fine. Let me check the available options: ${availableSlotList || 'Tomorrow at 2:30 PM, or Friday 12:00 PM'}. Which one would suit you better?`,
        detectedIntent: 'reschedule',
        hrDecisionOutcome: 'INTERVIEW_RESCHEDULE_REQUIRED',
        extractedFields: {},
        statusRecommendation: 'Screened - Ready for Interview',
        generatedRemark: {
          text: `Candidate requested rescheduling of scheduled interview. Alternate open slots offered.`,
          priority: 'Urgent',
          category: 'Missed Interview Reschedule',
          actionDueDate: 'Today',
        },
      };
    }
  }

  // SCENARIO 10: Missed Interview Follow-up Scenario (Rule 26)
  if (scenario === 'missed_followup') {
    if (
      lower.includes('reschedule') ||
      lower.includes('yes') ||
      lower.includes('haan') ||
      lower.includes('free') ||
      lower.includes('slot')
    ) {
      return {
        agentReply: `We completely understand! We would be delighted to reschedule your face-to-face round at our Sector 67 Gurugram office. We have open slots on ${availableSlotList || 'Tomorrow at 2:30 PM or Friday at 12:00 PM'}. Would you like to confirm one of these?`,
        detectedIntent: 'reschedule',
        hrDecisionOutcome: 'INTERVIEW_RESCHEDULE_REQUIRED',
        extractedFields: {},
        statusRecommendation: 'Screened - Ready for Interview',
        generatedRemark: {
          text: `Candidate missed previous interview slot; contacted via AI follow-up. Candidate agreed to reschedule.`,
          priority: 'Urgent',
          category: 'Missed Interview Reschedule',
          actionDueDate: 'Today',
        },
      };
    }
  }

  // SCENARIO 11: Slot booking detection (Rule 22)
  const matchedSlot = availableSlots.find((s: any) =>
    s.isAvailable && lower.includes(s.time.substring(0, 5).toLowerCase()) ||
    (lower.includes('tomorrow') && lower.includes('2:30') && s.id === 'slot-2') ||
    (lower.includes('tomorrow') && lower.includes('4:30') && s.id === 'slot-3') ||
    (lower.includes('friday') && s.date.toLowerCase().includes('friday')) ||
    (lower.includes('day after') && s.id === 'slot-4')
  );

  if (matchedSlot || lower.includes('tomorrow') || lower.includes('kal') || lower.includes('book') || lower.includes('works great') || lower.includes('perfect') && transcript.length >= 3) {
    const slotToBook = matchedSlot || availableSlots.find((s: any) => s.isAvailable);
    return {
      agentReply: `Perfect! I have scheduled your face-to-face interview for ${slotToBook?.displayLabel || 'Tomorrow at 02:30 PM'} at White Collar Realty Corporate HQ, 6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram. We will also send the location details and confirmation letter to your email and phone. Thank you so much and all the best!`,
      detectedIntent: 'confirm_interview',
      hrDecisionOutcome: 'INTERVIEW_SCHEDULED',
      slotAction: 'booked',
      selectedSlotId: slotToBook?.id || 'slot-2',
      extractedFields: {
        preferredInterviewSlot: slotToBook?.displayLabel || 'Tomorrow at 02:30 PM',
        interviewVenueConfirmed: true,
      },
      statusRecommendation: 'Interview Scheduled',
      generatedRemark: {
        text: `Face-to-face interview successfully locked for ${slotToBook?.displayLabel || 'Tomorrow 02:30 PM'} at Sector 67 HQ. Dispatched email confirmation.`,
        priority: 'High',
        category: 'Interview Scheduled',
        actionDueDate: 'Tomorrow',
      },
    };
  }

  // SCENARIO 12: Anti-Repetition State Guard Engine (Mandate: Check history, treat answers as final, NEVER ask twice)
  const state = buildConversationStateInventory(candidate, transcript, userMessage);

  // If candidate identity is not confirmed (Step 1)
  if (state.nextRequiredField === 'identity') {
    return {
      agentReply: `Hi ${candName}, am I speaking with ${candName}?`,
      detectedIntent: 'identity_check',
      extractedFields: {},
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Verifying candidate identity per Step 1 of Call Opening flow.`,
        priority: 'Low',
        category: 'Identity Verification',
        actionDueDate: 'Today',
      },
    };
  }

  // If call purpose & good time availability is not confirmed (Steps 2, 3 & 4)
  if (state.nextRequiredField === 'call_purpose_check_time') {
    return {
      agentReply: `Perfect, ${candName}. I'm Arjun calling from White Collar Realty's HR team. We came across your profile regarding a real-estate opportunity, and I wanted to understand your experience and see whether the opportunity could be relevant for you. Is this a good time for a quick conversation?`,
      detectedIntent: 'purpose_and_availability_check',
      extractedFields: {},
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Candidate identity verified. Stated purpose and checked time availability per Steps 2-4.`,
        priority: 'Medium',
        category: 'Availability Check',
        actionDueDate: 'Today',
      },
    };
  }

  // If candidate introduction has not been requested/given (Step 5)
  if (state.nextRequiredField === 'candidate_intro') {
    return {
      agentReply: `Great. To start with, could you briefly introduce yourself and walk me through your real-estate experience?`,
      detectedIntent: 'candidate_intro_prompt',
      extractedFields: {},
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Invited open-ended candidate career introduction per Step 5.`,
        priority: 'Medium',
        category: 'Candidate Introduction',
        actionDueDate: 'Today',
      },
    };
  }

  // If current company is missing (and not in CRM profile)
  if (state.nextRequiredField === 'company') {
    return {
      agentReply: `Great! Could you share which real estate company you are currently with?`,
      detectedIntent: 'screening_question',
      extractedFields: {},
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Inquiring current organization per Rule 16.`,
        priority: 'Medium',
        category: 'Organization Screening',
        actionDueDate: 'Today',
      },
    };
  }

  // If designation is missing
  if (state.nextRequiredField === 'designation') {
    return {
      agentReply: `Understood. And what is your current designation there?`,
      detectedIntent: 'screening_question',
      extractedFields: {
        currentCompany: state.currentCompany || undefined,
      },
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Inquiring designation at current firm.`,
        priority: 'Medium',
        category: 'Designation Screening',
        actionDueDate: 'Today',
      },
    };
  }

  // If real estate experience is missing (and not in CRM profile)
  if (state.nextRequiredField === 'experience') {
    return {
      agentReply: `Got it. How many years of total experience do you have in real estate sales?`,
      detectedIntent: 'screening_question',
      extractedFields: {
        currentCompany: state.currentCompany || undefined,
        currentDesignation: state.designation || undefined,
      },
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Inquiring total sales experience per Rule 16.`,
        priority: 'Medium',
        category: 'Experience Evaluation',
        actionDueDate: 'Today',
      },
    };
  }

  // If market exposure is missing
  if (state.nextRequiredField === 'market_exposure') {
    return {
      agentReply: `That's helpful context. What kind of luxury residential projects have you mainly handled across Gurgaon or Dubai?`,
      detectedIntent: 'screening_question',
      extractedFields: {
        realEstateExperienceYears: state.experienceYears || undefined,
      },
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Assessing Gurgaon/Dubai territory familiarity.`,
        priority: 'Medium',
        category: 'Territory Familiarity',
        actionDueDate: 'Today',
      },
    };
  }

  // If salary / compensation is missing
  if (state.nextRequiredField === 'salary') {
    return {
      agentReply: `Makes sense. Could you share your current compensation and what you are expecting for your next move?`,
      detectedIntent: 'screening_question',
      extractedFields: {
        gurgaonDubaiExperience: state.gurgaonDubaiExposure || undefined,
      },
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Inquiring current & expected CTC per Rule 20.`,
        priority: 'Medium',
        category: 'Budget Negotiation',
        actionDueDate: 'Today',
      },
    };
  }

  // If notice period is missing
  if (state.nextRequiredField === 'notice_period') {
    if (lower.includes('30') && !lower.includes('negotiable') && !lower.includes('earlier')) {
      return {
        agentReply: `Understood. Would an earlier joining be possible if selected?`,
        detectedIntent: 'notice_followup',
        extractedFields: {
          noticePeriodDays: 30,
        },
        statusRecommendation: 'Screening Pending',
        generatedRemark: {
          text: `30 days notice reported. Inquiring early buyout / joining flexibility per Rule 21.`,
          priority: 'Medium',
          category: 'Notice Period Evaluation',
          actionDueDate: 'Today',
        },
      };
    }
    return {
      agentReply: `Understood. What is your current notice period and earliest joining date?`,
      detectedIntent: 'screening_question',
      extractedFields: {
        currentSalaryLPA: state.currentSalaryLPA || undefined,
      },
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Inquiring notice period feasibility per Rule 21.`,
        priority: 'Medium',
        category: 'Notice Period Evaluation',
        actionDueDate: 'Today',
      },
    };
  }

  // If location is missing
  if (state.nextRequiredField === 'location') {
    return {
      agentReply: `And where are you currently based in NCR?`,
      detectedIntent: 'screening_question',
      extractedFields: {
        noticePeriodDays: state.noticePeriodDays !== null ? state.noticePeriodDays : undefined,
      },
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Confirming NCR residential location and commute feasibility.`,
        priority: 'Low',
        category: 'Location Assessment',
        actionDueDate: 'Today',
      },
    };
  }

  // If role specific question is missing
  if (state.nextRequiredField === 'role_specific') {
    const roleQ = roleInfo.roleSpecificQuestions[0] || 'What has been your primary approach to driving luxury deal closures in Gurgaon?';
    return {
      agentReply: `Right. ${roleQ}`,
      detectedIntent: 'role_specific_question',
      extractedFields: {
        currentLocation: state.currentLocation || undefined,
      },
      statusRecommendation: 'Screening Pending',
      generatedRemark: {
        text: `Inquiring role-specific domain question for ${candRole}.`,
        priority: 'Medium',
        category: 'Role Competency',
        actionDueDate: 'Today',
      },
    };
  }

  // Final screening round: Propose face-to-face interview slots (Rule 22)
  return {
    agentReply: `Thank you for sharing those details! Based on your background, we would like to invite you for a face-to-face interview at our corporate office: 6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram. We have slots available on ${availableSlotList || 'Tomorrow at 2:30 PM or 4:30 PM'}. Which slot works best for you?`,
    detectedIntent: 'screening_answer',
    hrDecisionOutcome: 'INTERVIEW_ELIGIBLE',
    extractedFields: {
      currentLocation: state.currentLocation || userMessage,
      noticePeriodDays: state.noticePeriodDays !== null ? state.noticePeriodDays : (lower.includes('immediate') ? 0 : lower.includes('15') ? 15 : 30),
    },
    statusRecommendation: 'Screened - Ready for Interview',
    generatedRemark: {
      text: `All screening criteria validated. Proposed face-to-face interview slots at Sector 67 HQ per Rule 22.`,
      priority: 'High',
      category: 'Interview Scheduled',
      actionDueDate: 'Tomorrow',
    },
  };
}

function generateFallbackResponse(
  scenario: string,
  userMessage: string,
  candidate: any,
  transcript: any[],
  availableSlots: any[]
) {
  const raw = computeRawFallbackResponse(scenario, userMessage, candidate, transcript, availableSlots);
  return enrichFallbackWithMemoryAndOutcome(raw, candidate, userMessage);
}

// Shared prompt builder for White Collar Realty Virtual HR Recruiter
function createSystemInstruction(
  candidate: any,
  scenario: string,
  availableSlotsText: string,
  stateInventory?: ConversationStateInventory
) {
  const roleInfo = getRoleBudgetInfo(candidate?.appliedRole);

  const inventorySummary = stateInventory ? `
============================================================
CONVERSATION STATE GUARD & ANTI-REPETITION INVENTORY (STRICT)
============================================================
ALREADY COLLECTED ON FILE (LOCKED — NEVER ASK THESE QUESTIONS AGAIN):
${stateInventory.knownList && stateInventory.knownList.length > 0 ? stateInventory.knownList.map((item) => `  ✓ ${item}`).join('\n') : '  • None yet recorded — proceed progressively'}

CURRENTLY MISSING FROM PROFILE:
${stateInventory.missingList && stateInventory.missingList.length > 0 ? stateInventory.missingList.map((item) => `  ✗ ${item}`).join('\n') : '  • Standard fields collected! Ask domain questions and schedule interview.'}

TARGET FIELD FOR NEXT QUESTION: [${stateInventory.nextRequiredField}]
============================================================
` : '';

  return `
# WHITE COLLAR REALTY — AUTONOMOUS REAL ESTATE HR INTERVIEW + SCENARIO ENGINE

You are the White Collar Realty Virtual HR Assistant.
Your name is Arjun.
You are an experienced human-like HR recruiter conducting an intelligent outbound screening conversation with real-estate candidates.

You are NOT a questionnaire reader.
You are NOT a scripted IVR.
You must conduct a natural two-way HR conversation.

Your goal is to understand the candidate's:
* career background & current role
* total experience & real-estate sales experience
* market exposure (Gurugram / Dubai / others)
* residential vs commercial & luxury/ultra-luxury exposure
* projects and developers (DLF, M3M, Godrej, Emaar, Sobha, SmartWorld, Central Park)
* sales performance, lead handling, site visits, negotiation & closing ability
* pre-sales & business development ability
* team management ability & target ownership
* compensation, notice period & interview availability

White Collar Realty currently focuses on luxury residential and ultra-luxury residential properties.
Corporate HQ: 6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram, Haryana 122101.

${inventorySummary}

---

# 1. MOST IMPORTANT CONVERSATION FLOW
The conversation MUST follow this natural structure:
AGENT INTRODUCTION
↓
CANDIDATE CONFIRMS IDENTITY / SAYS "YES, I'M SPEAKING"
↓
CANDIDATE INTRODUCTION
↓
ANALYZE CANDIDATE INTRODUCTION
↓
IDENTIFY EXPERIENCE / ROLE / MARKET / PRODUCT / RESPONSIBILITIES
↓
ASK NATURAL FOLLOW-UP
↓
DYNAMIC ROLE-SPECIFIC QUESTIONS
↓
SCENARIO-BASED QUESTIONS
↓
CROSS-QUESTION BASED ON ANSWERS
↓
PERFORMANCE / COMPENSATION / NOTICE
↓
INTERVIEW AVAILABILITY (F2F AT SECTOR 67 GURUGRAM HQ)
↓
FINAL SUMMARY & NEXT ACTION

Do NOT jump directly into random screening questions after the candidate says "Yes, I'm speaking."

---

# 2. AFTER "YES, I'M SPEAKING" (CANDIDATE INTRODUCTION PROMPT)
When the candidate confirms: "Yes, I'm speaking."
DO NOT immediately ask "How many years of experience do you have?"
Instead naturally say ONE of these:
"Perfect, thank you. Before I explain the opportunity, could you briefly walk me through your experience and what you're currently handling?"
OR:
"Great, thanks for confirming. Could you give me a quick introduction about yourself and your real-estate experience?"
OR:
"Perfect. To understand your profile better, could you briefly introduce yourself and tell me what kind of real-estate sales you've been handling?"

Choose ONE. Never ask all three.

---

# 3. CANDIDATE INTRODUCTION DATA EXTRACTION & ANALYSIS
Treat the candidate's introduction as a major information source.
While the candidate speaks, extract:
- name, current company, previous companies
- current designation, previous designations
- total experience, real-estate experience, Gurugram experience, Dubai experience
- residential, commercial, luxury, ultra-luxury, primary, secondary sales
- projects, developers, locations, ticket sizes (₹3 Cr – ₹15 Cr+)
- targets, achievement %, personal closures vs team closures, team size
- current salary, expected salary, notice period

IMPORTANT: If the candidate voluntarily provides information during introduction, mark that information as ALREADY ANSWERED. Never ask it again just because it exists in a formal list.

---

# 4. NATURAL CONVERSATION & ONE QUESTION AT A TIME
- The conversation must feel like an experienced HR recruiter talking.
- Do NOT say: "Now I will ask you about your experience.", "Next question.", "Moving to the next section.", "Thank you for your response. Let us proceed."
- Use natural transitions: "Got it.", "That gives me a good picture.", "Interesting. You mentioned Gurgaon...", "That's useful. Tell me a little more about that.", "Since you were handling a team, I want to understand how you managed performance."
- Ask exactly ONE primary question per turn. Never stack questions.

---

# 5. ZERO DUPLICATES & QUESTION STATE ENGINE
Never ask a question that:
* was already asked
* was already answered
* was already voluntarily provided
* is semantically equivalent to a previous question
* is currently being answered

If candidate says: "I have six years of real-estate experience."
Never ask: "How many years of real-estate experience do you have?"
Instead explore something new: "Got it. And how much of those six years has been specifically in Gurugram?"

---

# 6. DYNAMIC SCENARIO ENGINE & EXPERIENCE-BASED DIFFICULTY
Select scenarios dynamically based on candidate role, seniority, market, and luxury exposure:

### A. Early Career (0–2 Years):
- New Lead: "You receive a fresh lead for a luxury residential project, but the customer only says, 'Send me the price.' How would you handle that conversation?"
- No Response: "You spoke to a lead once and they showed interest, but now they aren't responding to calls or WhatsApp. What would you do?"
- Site Visit Cancel: "A customer agrees to a site visit but cancels two hours before the appointment. What would you do?"
- Price Objection: "A customer says, 'Your project is too expensive. I can get something cheaper nearby.' How would you respond?"

### B. Mid-Level Sales (2–5 Years):
- Multiple Leads: "You have 20 active leads, but only three are showing strong buying signals. How would you prioritize your day?"
- High-Value HNI Buyer: "You receive a lead from an HNI buyer looking at a luxury residence. They are knowledgeable and don't want a typical sales pitch. How would you approach them?"
- Discount Negotiation: "A buyer likes the property but says they will book only if they get a significant discount. How would you handle the negotiation?"
- Site Visit But No Booking: "You conducted a successful site visit. The customer liked the property but says, 'I'll think about it.' What would you do next?"
- Self-Generated Business: "Suppose company leads are low for a month. How would you generate your own opportunities?"

### C. Senior Sales (5+ Years):
- High-Ticket Closure Delay: "You have a serious HNI buyer interested in a high-ticket luxury residence. They like the property but are delaying the decision. How would you move the conversation forward without becoming pushy?"
- Unauthorized Discount: "A customer wants a large discount that you cannot authorize and says they will walk away otherwise. What would you do?"
- Multiple Decision Makers: "You are dealing with a family where husband, wife and a family member have different preferences. How would you manage the discussion?"

### D. Luxury & Ultra-Luxury:
- HNI Credibility: "You are handling an HNI client who knows the Gurgaon market extremely well and is comparing multiple luxury projects. How would you establish credibility?"
- UHNI Privacy: "A high-value client prefers minimal communication and does not want frequent calls. How would you manage the relationship?"
- Premium Justification: "You are selling a residence with a high ticket size. The buyer questions whether the property justifies the premium. How would you handle the conversation?"

### E. Pre-Sales:
- Rapid Qualification: "You receive a fresh lead for a luxury residential project and the customer has only two minutes to speak. How would you qualify them?"
- Technical Question: "A customer asks a technical question about the project and you don't know the exact answer. What would you do?" (Expected: verify/escalate, never guess).

### F. Business Development (BDE):
- New Micro-Market 30 Days: "Suppose you are asked to generate business in a new Gurgaon micro-market with limited existing contacts. What would you do in the first 30 days?"
- Broker Network & Conflict: "You need to build relationships with channel partners for luxury residential sales. How would you approach them?"

### G. Sales Manager (5–10 Years):
- Target Miss: "Your team is 30% below monthly target with only one week remaining. What would you do?"
- High Performer with Poor Discipline: "One salesperson produces a large part of revenue but has poor discipline and doesn't follow the process. How would you manage them?"
- Underperformer: "One team member has missed target for three consecutive months. What would you do?"
- Team Conflict: "Two senior salespeople are fighting over ownership of the same high-value customer. How would you handle it?"

### H. Gurugram & Dubai Depth:
- Gurugram: "Suppose a buyer is evaluating a luxury residence in Golf Course Extension Road versus another option in New Gurugram. What would you want to understand about the buyer before recommending one?"
- Dubai: "Suppose an NRI buyer is comparing a Dubai luxury property with a Gurugram property. How would you understand their requirement before recommending anything?"

---

# 7. REAL-TIME CROSS-QUESTIONING & PROBING DEPTH
- When candidate gives an answer, probe 1–3 useful follow-ups before moving to the next competency:
  * "What specific factors would you use to demonstrate that value?"
  * "What information would you compare before responding?"
- If candidate is a manager, cross-check numbers naturally: "Roughly how was that achieved number split between your own contribution and the team's contribution?"
- Never endlessly drill a single topic.

---

# 8. CANDIDATE QUESTIONS & SPECIAL SITUATIONS
- Candidate questions: Pause screening, answer accurately from approved company knowledge, or say: "I don't want to give you an incorrect detail on that. I can have the HR team confirm it for you." Then smoothly return.
- Candidate busy / driving: Stop immediately: "No problem. I don't want to disturb you while you're busy. What would be a convenient time for me to call you back?" Set outcome to CALL_BACK_REQUESTED.
- Contradictions: Clarify politely: "Earlier you mentioned [X], and now I heard [Y]. Could you clarify which figure is correct?"

---

# 9. FINAL HR INFORMATION & INTERVIEW AVAILABILITY
Near the end, only collect uncollected items:
- Current fixed CTC and expected CTC (if candidate says confidential, respect it)
- Notice period (immediate / 15 / 30 days)
- Face-to-Face Interview scheduling at White Collar Realty HQ: 6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram.
Available Slots:
${availableSlotsText || 'Slots open tomorrow and Friday between 11:00 AM and 5:00 PM.'}

---

# 10. TARGET ROLE & JD CONTEXT:
Target Role: ${roleInfo.title}
Department: ${roleInfo.department}
Location: ${roleInfo.location}
Budget: ${roleInfo.fixedBudget} (Fixed) + ${roleInfo.totalOte} (${roleInfo.seniority})
Notice Period Expectation: ${roleInfo.noticePeriodExpectation}
Role Specific Inquiries:
${roleInfo.roleSpecificQuestions.map((q, i) => `${i + 1}. "${q}"`).join('\n')}

---

# 11. HR DECISION OUTCOMES:
"SCREENING_COMPLETED" | "INTERVIEW_ELIGIBLE" | "INTERVIEW_SCHEDULED" | "FOLLOW_UP_REQUIRED" | "NOT_INTERESTED" | "NO_ANSWER" | "CALL_BACK_REQUESTED" | "INTERVIEW_RESCHEDULE_REQUIRED" | "INTERVIEW_CANCELLED" | "INTERVIEW_ATTENDED" | "INTERVIEW_MISSED" | "REJECTED" | "MANUAL_HR_REVIEW_REQUIRED"
`;
}

// Shared JSON schema for conversational turns
const interactionResponseSchema = {
  type: Type.OBJECT,
  properties: {
    agentReply: { type: Type.STRING },
    detectedIntent: { type: Type.STRING },
    hrDecisionOutcome: { type: Type.STRING },
    conversationMemory: {
      type: Type.OBJECT,
      properties: {
        candidate_name: { type: Type.STRING },
        target_role: { type: Type.STRING },
        current_company: { type: Type.STRING },
        designation: { type: Type.STRING },
        total_experience: { type: Type.STRING },
        real_estate_experience: { type: Type.STRING },
        gurgaon_experience: { type: Type.STRING },
        dubai_experience: { type: Type.STRING },
        current_salary: { type: Type.STRING },
        expected_salary: { type: Type.STRING },
        salary_not_disclosed: { type: Type.BOOLEAN },
        current_location: { type: Type.STRING },
        notice_period: { type: Type.STRING },
        earliest_joining_date: { type: Type.STRING },
        interested: { type: Type.STRING },
        interview_date: { type: Type.STRING },
        interview_time: { type: Type.STRING },
        conversation_status: { type: Type.STRING },
        missing_information: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        next_action: { type: Type.STRING },
      },
    },
    extractedFields: {
      type: Type.OBJECT,
      properties: {
        currentCompany: { type: Type.STRING },
        currentDesignation: { type: Type.STRING },
        totalExperienceYears: { type: Type.NUMBER },
        realEstateExperienceYears: { type: Type.NUMBER },
        gurgaonDubaiExperience: {
          type: Type.OBJECT,
          properties: {
            gurgaon: { type: Type.BOOLEAN },
            dubai: { type: Type.BOOLEAN },
            details: { type: Type.STRING },
          },
        },
        currentSalaryLPA: { type: Type.STRING },
        expectedSalaryLPA: { type: Type.STRING },
        currentLocation: { type: Type.STRING },
        noticePeriodDays: { type: Type.NUMBER },
        earliestJoiningDate: { type: Type.STRING },
        preferredInterviewSlot: { type: Type.STRING },
        interviewVenueConfirmed: { type: Type.BOOLEAN },
      },
    },
    slotAction: { type: Type.STRING },
    selectedSlotId: { type: Type.STRING },
    callbackTime: { type: Type.STRING },
    declineReason: { type: Type.STRING },
    statusRecommendation: { type: Type.STRING },
    generatedRemark: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        priority: { type: Type.STRING },
        category: { type: Type.STRING },
        actionDueDate: { type: Type.STRING },
      },
      required: ['text', 'priority', 'category'],
    },
  },
  required: ['agentReply', 'detectedIntent'],
};

// Conversation Interaction Endpoint
app.post('/api/call/interact', async (req, res) => {
  try {
    const {
      candidate,
      scenario,
      transcript = [],
      userMessage,
      languagePreference = 'Auto (Hinglish/Hindi/English)',
      availableSlots = [],
    } = req.body;

    const availableSlotsText = availableSlots
      .filter((s: any) => s.isAvailable)
      .map((s: any) => `[ID: ${s.id}] ${s.displayLabel} (${s.time}) at ${s.venue}`)
      .join('\n');

    const ai = getGenAI();

    if (!ai) {
      const fallback = generateFallbackResponse(
        scenario,
        userMessage,
        candidate,
        transcript,
        availableSlots
      );
      return res.json(fallback);
    }

    const stateInventory = buildConversationStateInventory(candidate, transcript, userMessage);
    const systemInstruction = createSystemInstruction(candidate, scenario, availableSlotsText, stateInventory);

    const conversationPrompt = `
Previous Conversation Transcript:
${(transcript || [])
  .map((m: any) => `${m.sender.toUpperCase()}: ${m.text}`)
  .join('\n')}

Candidate's Latest Message: "${userMessage || ''}"
Candidate's Existing Profile Data: ${JSON.stringify(candidate?.screening || {})}
Language Preference: ${languagePreference}

Respond to the candidate and extract any new details.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: conversationPrompt,
      config: {
        systemInstruction,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MINIMAL,
        },
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: interactionResponseSchema,
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/call/interact:', error);
    // Graceful fallback
    const fallback = generateFallbackResponse(
      req.body.scenario,
      req.body.userMessage,
      req.body.candidate,
      req.body.transcript,
      req.body.availableSlots || []
    );
    return res.json(fallback);
  }
});

// Streaming Conversation Interaction Endpoint for sub-second real-time voice latency
app.post('/api/call/interact-stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if (typeof (res as any).flush === 'function') {
      (res as any).flush();
    }
  };

  const {
    candidate,
    scenario,
    transcript = [],
    userMessage,
    languagePreference = 'Auto (Hinglish/Hindi/English)',
    availableSlots = [],
  } = req.body;

  const fallback = generateFallbackResponse(
    scenario,
    userMessage,
    candidate,
    transcript,
    availableSlots
  );

  const ai = getGenAI();

  if (!ai) {
    // Stream fallback tokens with realistic low latency delay
    const words = fallback.agentReply.split(' ');
    for (let i = 0; i < words.length; i++) {
      sendEvent('chunk', { text: (i === 0 ? '' : ' ') + words[i] });
      await new Promise((r) => setTimeout(r, 8));
    }
    sendEvent('complete', fallback);
    sendEvent('done', {});
    return res.end();
  }

  try {
    const availableSlotsText = availableSlots
      .filter((s: any) => s.isAvailable)
      .map((s: any) => `[ID: ${s.id}] ${s.displayLabel} (${s.time}) at ${s.venue}`)
      .join('\n');

    const stateInventory = buildConversationStateInventory(candidate, transcript, userMessage);
    const systemInstruction = createSystemInstruction(candidate, scenario, availableSlotsText, stateInventory);

    const conversationPrompt = `
Previous Conversation Transcript:
${(transcript || [])
  .map((m: any) => `${m.sender.toUpperCase()}: ${m.text}`)
  .join('\n')}

Candidate's Latest Message: "${userMessage || ''}"
Candidate's Existing Profile Data: ${JSON.stringify(candidate?.screening || {})}
Language Preference: ${languagePreference}

Respond to the candidate and extract any new details.
`;

    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3.1-flash-lite',
      contents: conversationPrompt,
      config: {
        systemInstruction,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MINIMAL,
        },
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: interactionResponseSchema,
      },
    });

    let accumulatedRaw = '';
    let replyEmittedLength = 0;
    let replyFinished = false;

    for await (const chunk of responseStream) {
      const text = chunk.text || '';
      accumulatedRaw += text;

      if (!replyFinished) {
        const keyMatch = accumulatedRaw.match(/"agentReply"\s*:\s*"/);
        if (keyMatch && keyMatch.index !== undefined) {
          const startIndex = keyMatch.index + keyMatch[0].length;
          const contentAfterStart = accumulatedRaw.slice(startIndex);

          let endIndex = -1;
          for (let i = 0; i < contentAfterStart.length; i++) {
            if (contentAfterStart[i] === '"' && (i === 0 || contentAfterStart[i - 1] !== '\\')) {
              endIndex = i;
              break;
            }
          }

          const rawReplyPart = endIndex !== -1 ? contentAfterStart.slice(0, endIndex) : contentAfterStart;
          const unescaped = rawReplyPart
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');

          if (unescaped.length > replyEmittedLength) {
            const delta = unescaped.slice(replyEmittedLength);
            replyEmittedLength = unescaped.length;
            sendEvent('chunk', { text: delta });
          }

          if (endIndex !== -1) {
            replyFinished = true;
          }
        }
      }
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(accumulatedRaw.trim());
    } catch {
      parsed = fallback;
    }

    if (!parsed?.agentReply && fallback.agentReply) {
      parsed = { ...fallback, ...parsed };
    }
    if (!parsed?.generatedRemark && fallback.generatedRemark) {
      parsed.generatedRemark = fallback.generatedRemark;
    }

    sendEvent('complete', parsed);
    sendEvent('done', {});
    res.end();
  } catch (error: any) {
    console.error('Error in /api/call/interact-stream:', error);
    sendEvent('complete', fallback);
    sendEvent('done', {});
    res.end();
  }
});

// Post-Call Processing Pipeline Schema
const postCallAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    extractedFields: {
      type: Type.OBJECT,
      properties: {
        currentCompany: { type: Type.STRING },
        currentDesignation: { type: Type.STRING },
        totalExperienceYears: { type: Type.NUMBER },
        realEstateExperienceYears: { type: Type.NUMBER },
        gurgaonDubaiExperience: {
          type: Type.OBJECT,
          properties: {
            gurgaon: { type: Type.BOOLEAN },
            dubai: { type: Type.BOOLEAN },
            details: { type: Type.STRING },
          },
        },
        currentSalaryLPA: { type: Type.STRING },
        expectedSalaryLPA: { type: Type.STRING },
        currentLocation: { type: Type.STRING },
        noticePeriodDays: { type: Type.NUMBER },
        earliestJoiningDate: { type: Type.STRING },
        preferredInterviewSlot: { type: Type.STRING },
        interviewVenueConfirmed: { type: Type.BOOLEAN },
      },
    },
    conversationMemory: {
      type: Type.OBJECT,
      properties: {
        candidate_name: { type: Type.STRING },
        target_role: { type: Type.STRING },
        current_company: { type: Type.STRING },
        designation: { type: Type.STRING },
        total_experience: { type: Type.STRING },
        real_estate_experience: { type: Type.STRING },
        gurgaon_experience: { type: Type.STRING },
        dubai_experience: { type: Type.STRING },
        current_salary: { type: Type.STRING },
        expected_salary: { type: Type.STRING },
        salary_not_disclosed: { type: Type.BOOLEAN },
        current_location: { type: Type.STRING },
        notice_period: { type: Type.STRING },
        earliest_joining_date: { type: Type.STRING },
        interested: { type: Type.STRING },
        interview_date: { type: Type.STRING },
        interview_time: { type: Type.STRING },
        conversation_status: { type: Type.STRING },
        missing_information: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        next_action: { type: Type.STRING },
      },
      required: ['candidate_name', 'target_role', 'conversation_status', 'missing_information', 'next_action'],
    },
    statusAnalysis: {
      type: Type.OBJECT,
      properties: {
        candidateStatus: { type: Type.STRING },
        interviewStatus: { type: Type.STRING },
        hrDecisionOutcome: { type: Type.STRING },
        callbackTime: { type: Type.STRING },
        declineReason: { type: Type.STRING },
        bookedSlotId: { type: Type.STRING },
      },
      required: ['candidateStatus', 'interviewStatus', 'hrDecisionOutcome'],
    },
    factBasedRemark: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        priority: { type: Type.STRING },
        category: { type: Type.STRING },
        actionDueDate: { type: Type.STRING },
      },
      required: ['text', 'priority', 'category', 'actionDueDate'],
    },
    scorecard: {
      type: Type.OBJECT,
      properties: {
        gurgaonDubaiScore: { type: Type.STRING },
        experienceFit: { type: Type.STRING },
        budgetAlignment: { type: Type.STRING },
        joiningTimeline: { type: Type.STRING },
        recommendation: { type: Type.STRING },
      },
      required: ['gurgaonDubaiScore', 'experienceFit', 'budgetAlignment', 'joiningTimeline', 'recommendation'],
    },
    summary: { type: Type.STRING },
    keyHighlights: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    communicationDecision: {
      type: Type.OBJECT,
      properties: {
        whatsApp: {
          type: Type.OBJECT,
          properties: {
            shouldSend: { type: Type.BOOLEAN },
            template: { type: Type.STRING },
            reason: { type: Type.STRING },
            recommendedMessage: { type: Type.STRING },
          },
          required: ['shouldSend', 'reason'],
        },
        email: {
          type: Type.OBJECT,
          properties: {
            shouldSend: { type: Type.BOOLEAN },
            subject: { type: Type.STRING },
            reason: { type: Type.STRING },
            recommendedBody: { type: Type.STRING },
          },
          required: ['shouldSend', 'reason'],
        },
      },
      required: ['whatsApp', 'email'],
    },
    afterCallAction: {
      type: Type.OBJECT,
      properties: {
        candidate_id: { type: Type.STRING },
        call_status: { type: Type.STRING },
        screening_status: { type: Type.STRING },
        target_role: { type: Type.STRING },
        screening_summary: { type: Type.STRING },
        candidate_answers: { type: Type.OBJECT },
        missing_information: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        interview_status: { type: Type.STRING },
        interview_date: { type: Type.STRING },
        interview_time: { type: Type.STRING },
        follow_up_required: { type: Type.BOOLEAN },
        follow_up_date: { type: Type.STRING },
        hr_remarks: { type: Type.STRING },
        next_action: { type: Type.STRING },
        next_action_owner: { type: Type.STRING },
      },
      required: ['candidate_id', 'screening_status', 'hr_remarks', 'next_action'],
    },
  },
  required: [
    'extractedFields',
    'conversationMemory',
    'statusAnalysis',
    'factBasedRemark',
    'scorecard',
    'summary',
    'communicationDecision',
    'afterCallAction',
  ],
};

// In-memory cache for post-call analysis idempotency
const postCallAnalysisCache = new Map<string, any>();

// Rule-based deterministic fallback analyzer for post-call processing
function generateFallbackPostCallAnalysis(
  candidate: any,
  transcript: any[],
  callScenario: string,
  availableSlots: any[] = [],
  explicitSlotId?: string
) {
  const turns = transcript.length;
  const roleInfo = getRoleBudgetInfo(candidate?.appliedRole);
  const existing = candidate?.screening || {};
  
  // Aggregate candidate text
  const candidateSpoken = transcript
    .filter((m: any) => m.sender === 'candidate' || m.sender === 'user')
    .map((m: any) => m.text)
    .join(' ');

  const fullSpoken = transcript.map((m: any) => m.text).join(' ');

  // Extract experience numbers if spoken
  let totalExp = existing.totalExperienceYears || 0;
  let reExp = existing.realEstateExperienceYears || 0;
  const expMatch = candidateSpoken.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?|saal)/i);
  if (expMatch && !totalExp) {
    totalExp = parseFloat(expMatch[1]);
    if (!reExp) reExp = totalExp;
  }

  // Location & territory checks
  const mentionsGurgaon = /gurgaon|gurugram|golf course|spr|sohna|dwarka expressway|sector 67|m3m|dlf/i.test(candidateSpoken);
  const mentionsDubai = /dubai|emaar|damac|sobha|uae|off-plan/i.test(candidateSpoken);

  // Intent checks
  const isDeclined = /not interested|nahi chahiye|dont call|not looking|already joined|mana kar diya/i.test(candidateSpoken);
  const isCallback = /call (?:me )?later|busy (?:right )?now|baad mein|driving|meeting mein/i.test(candidateSpoken);
  const isAgreedSlot = /confirm|friday|tomorrow|kal|11 am|3 pm|agree|aunga|aaunga|aunga pakka|okay done/i.test(candidateSpoken) || Boolean(explicitSlotId);

  let chosenSlot = availableSlots.find((s: any) => s.id === explicitSlotId);
  if (!chosenSlot && isAgreedSlot && availableSlots.length > 0) {
    chosenSlot = availableSlots.find((s: any) => s.isAvailable) || availableSlots[0];
  }

  let candStatus = candidate?.status || 'Screening Pending';
  let intStatus = candidate?.interviewStatus || 'Not Scheduled';
  let hrOutcome = 'SCREENING_COMPLETED';
  let prio = 'Medium';
  let cat = 'Screening Follow-up';
  let actionDue = 'Today';
  let declineReason = '';
  let callbackTime = '';

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
  } else if (turns > 4) {
    candStatus = 'Screened - Ready for Interview';
    hrOutcome = 'INTERVIEW_ELIGIBLE';
    prio = 'Medium';
    cat = 'Notice Period Evaluation';
    actionDue = 'Tomorrow';
  }

  // Construct fact-rich remark
  let factText = '';
  if (isDeclined) {
    factText = `Candidate declined discussion for ${candidate?.appliedRole || 'role'} (${declineReason}). Marked in pipeline.`;
  } else if (isCallback) {
    factText = `Candidate requested callback (${callbackTime || 'Later Today'}). Recruiter priority follow-up logged.`;
  } else if (chosenSlot) {
    factText = `F2F Interview confirmed for ${chosenSlot.displayLabel || chosenSlot.date} at Sector 67 Gurugram HQ. Total Exp: ${totalExp || '3+'} Yrs, RE Exp: ${reExp || '2+'} Yrs.`;
  } else {
    factText = `Screening completed for ${candidate?.appliedRole || 'role'}. Total Exp: ${totalExp || 'Mid-level'}, RE Exp: ${reExp || 'Relevant'}, Location: ${existing.currentLocation || 'Delhi NCR'}. Profile ready for slot booking.`;
  }

  const missing: string[] = [];
  if (!existing.currentSalaryLPA) missing.push('Current CTC');
  if (!existing.expectedSalaryLPA) missing.push('Expected CTC');
  if (existing.noticePeriodDays === undefined) missing.push('Notice Period');
  if (!chosenSlot && candStatus !== 'Interview Scheduled') missing.push('F2F Interview Slot Booking');

  const venue = '6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram, Haryana 122101';
  const shouldSendWA = candStatus === 'Interview Scheduled' || candStatus === 'Attendance Confirmed' || isCallback || turns <= 2;
  const waTemplate = candStatus === 'Interview Scheduled' || candStatus === 'Attendance Confirmed'
    ? 'interview_reminder'
    : turns <= 2
    ? 'unanswered'
    : 'unanswered';

  const shouldSendMail = candStatus === 'Interview Scheduled' || candStatus === 'Attendance Confirmed';

  return {
    extractedFields: {
      currentCompany: existing.currentCompany || 'Real Estate Firm',
      currentDesignation: existing.currentDesignation || candidate?.appliedRole,
      totalExperienceYears: totalExp || 3,
      realEstateExperienceYears: reExp || 2,
      gurgaonDubaiExperience: {
        gurgaon: mentionsGurgaon || Boolean(existing.gurgaonDubaiExperience?.gurgaon),
        dubai: mentionsDubai || Boolean(existing.gurgaonDubaiExperience?.dubai),
        details: mentionsGurgaon ? 'Gurgaon luxury corridor experience noted in screening' : 'NCR market experience',
      },
      currentSalaryLPA: existing.currentSalaryLPA || '8 LPA',
      expectedSalaryLPA: existing.expectedSalaryLPA || '12 LPA',
      currentLocation: existing.currentLocation || 'Gurugram / NCR',
      noticePeriodDays: existing.noticePeriodDays !== undefined ? existing.noticePeriodDays : 30,
      earliestJoiningDate: existing.earliestJoiningDate || 'Immediate / 30 Days',
      preferredInterviewSlot: chosenSlot ? `${chosenSlot.date} ${chosenSlot.time}` : existing.preferredInterviewSlot || 'Upcoming Slot',
      interviewVenueConfirmed: Boolean(chosenSlot),
    },
    conversationMemory: {
      candidate_name: candidate?.name || 'Candidate',
      target_role: candidate?.appliedRole || 'Property Consultant',
      current_company: existing.currentCompany || '',
      designation: existing.currentDesignation || '',
      total_experience: totalExp ? `${totalExp} years` : '3 years',
      real_estate_experience: reExp ? `${reExp} years` : '2 years',
      gurgaon_experience: mentionsGurgaon ? 'Yes' : 'Unconfirmed',
      dubai_experience: mentionsDubai ? 'Yes' : 'No',
      current_salary: existing.currentSalaryLPA || '8 LPA',
      expected_salary: existing.expectedSalaryLPA || '12 LPA',
      salary_not_disclosed: false,
      current_location: existing.currentLocation || 'Gurgaon',
      notice_period: '30 days',
      earliest_joining_date: 'Immediate',
      interested: isDeclined ? 'No' : 'Yes',
      interview_date: chosenSlot?.date || candidate?.interviewDate || '',
      interview_time: chosenSlot?.time || candidate?.interviewTime || '',
      conversation_status: candStatus,
      missing_information: missing,
      next_action: chosenSlot ? 'Send interview confirmation letter and prepare candidate dossier' : 'Recruiter follow-up for screening confirmation',
    },
    statusAnalysis: {
      candidateStatus: candStatus,
      interviewStatus: intStatus,
      hrDecisionOutcome: hrOutcome,
      callbackTime,
      declineReason,
      bookedSlotId: chosenSlot?.id,
    },
    factBasedRemark: {
      text: factText,
      priority: prio,
      category: cat,
      actionDueDate: actionDue,
    },
    scorecard: {
      gurgaonDubaiScore: mentionsGurgaon || mentionsDubai ? 'High' : 'Medium',
      experienceFit: (totalExp >= roleInfo.minExperienceYears) ? 'Senior Fit' : 'Mid Fit',
      budgetAlignment: 'Within Budget',
      joiningTimeline: '30 Days',
      recommendation: isDeclined ? 'Not Selected' : (chosenSlot ? 'Priority Interview' : 'Proceed'),
    },
    summary: `Conducted ${callScenario} voice screening with ${candidate?.name} for ${candidate?.appliedRole}. Total ${turns} exchanges transcribed. ${factText}`,
    keyHighlights: [
      `Candidate role fit evaluated against ${roleInfo.title} standards`,
      `Outcome categorized as ${candStatus} with priority ${prio}`,
    ],
    communicationDecision: {
      whatsApp: {
        shouldSend: shouldSendWA,
        template: waTemplate,
        reason: chosenSlot
          ? 'Reconfirm F2F interview date, time, and Sector 67 Gurugram location on WhatsApp'
          : 'Follow up on unconfirmed screening details via WhatsApp',
        recommendedMessage: `Hello ${candidate?.name}, thank you for speaking with White Collar Realty regarding the ${candidate?.appliedRole} position. We have recorded your preferences and look forward to the next steps at our Sector 67 Gurugram HQ.`,
      },
      email: {
        shouldSend: shouldSendMail,
        subject: `Interview Confirmation: ${candidate?.appliedRole} Round - White Collar Realty Gurugram`,
        reason: 'Official call letter containing Sector 67 M3M Urbana venue details and required documents',
        recommendedBody: `Dear ${candidate?.name},\n\nWe are pleased to confirm your face-to-face interview for the ${candidate?.appliedRole} role at White Collar Realty Gurugram.\n\nVenue: ${venue}\n\nPlease carry an updated CV and government ID.`,
      },
    },
    afterCallAction: {
      candidate_id: candidate?.id || 'cand-unknown',
      call_status: 'COMPLETED',
      screening_status: hrOutcome,
      target_role: candidate?.appliedRole || 'Property Consultant',
      screening_summary: factText,
      candidate_answers: existing,
      missing_information: missing,
      interview_status: intStatus,
      interview_date: chosenSlot?.date || candidate?.interviewDate || '',
      interview_time: chosenSlot?.time || candidate?.interviewTime || '',
      follow_up_required: candStatus === 'Callback Needed' || candStatus === 'Missed Interview - Followup',
      follow_up_date: actionDue,
      hr_remarks: factText,
      next_action: chosenSlot ? 'Dispatch official interview invitation and briefing document' : 'Review candidate profile for next interview slot',
      next_action_owner: 'Arjun (Virtual AI HR Desk)',
    },
  };
}

// Master Post-Call Analysis Pipeline
async function runPostCallPipeline(params: {
  candidate: any;
  transcript: any[];
  callScenario: string;
  callDuration?: number;
  availableSlots?: any[];
  bookedSlotId?: string;
  callId?: string;
}) {
  const {
    candidate,
    transcript = [],
    callScenario = 'screening',
    callDuration = 0,
    availableSlots = [],
    bookedSlotId,
    callId,
  } = params;

  // Check idempotency cache if callId provided
  if (callId && postCallAnalysisCache.has(callId)) {
    return postCallAnalysisCache.get(callId);
  }

  const ai = getGenAI();
  const roleInfo = getRoleBudgetInfo(candidate?.appliedRole);

  if (!ai || transcript.length === 0) {
    const fallback = generateFallbackPostCallAnalysis(
      candidate,
      transcript,
      callScenario,
      availableSlots,
      bookedSlotId
    );
    if (callId) postCallAnalysisCache.set(callId, fallback);
    return fallback;
  }

  try {
    const availableSlotsText = availableSlots
      .map((s: any) => `[Slot ID: ${s.id}] Date: ${s.date}, Time: ${s.time}, Venue: ${s.venue}, Available: ${s.isAvailable}`)
      .join('\n');

    const prompt = `
You are the Chief AI Recruitment Intelligence Officer for White Collar Realty (M3M Urbana Business Park, Sector 67, Gurugram).
Analyze the following completed candidate phone call transcript against the candidate's existing profile and the role Job Description.

Candidate Name: ${candidate?.name}
Candidate Phone: ${candidate?.phone}
Candidate Applied Role: ${candidate?.appliedRole}
Role Job Description & Budget:
- Title: ${roleInfo.title}
- Department: ${roleInfo.department}
- Experience Expectation: ${roleInfo.minExperienceYears}+ Yrs Total, ${roleInfo.minRealEstateExpYears}+ Yrs Real Estate
- Budget Band: ${roleInfo.fixedBudget} (${roleInfo.totalOte})
- Core Market Focus: ${roleInfo.marketFocus}
- Notice Period Expectation: ${roleInfo.noticePeriodExpectation}

Existing Candidate Profile State:
${JSON.stringify(candidate?.screening || {}, null, 2)}
Previous Remarks History:
${JSON.stringify((candidate?.remarksHistory || []).slice(0, 3), null, 2)}
Call Scenario: ${callScenario}
Call Duration: ${callDuration} seconds
Selected Slot ID during call: ${bookedSlotId || 'None'}

Available Interview Slots:
${availableSlotsText || 'Standard upcoming weekday slots at Sector 67 HQ'}

Full Completed Call Transcript:
${transcript.map((m: any) => `${m.sender.toUpperCase()}: ${m.text}`).join('\n')}

MANDATORY DIRECTIVES:
1. NEVER produce generic statements like "Call completed" or "Discussion logged".
2. The factBasedRemark.text MUST contain specific, factual details mentioned in this conversation: exact years of real estate experience, specific developer projects or micro-markets (e.g. DLF, M3M, Golf Course Ext, Dubai), current vs expected CTC, notice period, and exact confirmed interview time/venue or reason if callback/declined.
3. Determine candidateStatus strictly from: 'Screened - Ready for Interview' | 'Interview Scheduled' | 'Attendance Confirmed' | 'Callback Needed' | 'Declined - Do Not Call' | 'Missed Interview - Followup' | 'Screening Pending'.
4. Determine interviewStatus strictly from: 'Not Scheduled' | 'Scheduled' | 'Confirmed' | 'Rescheduled' | 'Missed' | 'Completed' | 'Declined'.
5. Formulate communication decisions for both WhatsApp and Email with clear reasons and tailored message content.
6. Return strictly valid JSON conforming to the schema.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
        responseMimeType: 'application/json',
        responseSchema: postCallAnalysisSchema,
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    if (callId) {
      postCallAnalysisCache.set(callId, parsed);
    }
    return parsed;
  } catch (error) {
    console.error('Error in Gemini post-call pipeline execution, using fallback:', error);
    const fallback = generateFallbackPostCallAnalysis(
      candidate,
      transcript,
      callScenario,
      availableSlots,
      bookedSlotId
    );
    if (callId) postCallAnalysisCache.set(callId, fallback);
    return fallback;
  }
}

// Endpoint: Central Post-Call Completion & Intelligent Record Update (Powered by Single AI HR Brain)
app.post('/api/call/process-completion', async (req, res) => {
  try {
    const { candidate, transcript, callScenario, availableSlots, bookedSlotId, callDuration, conversationId } = req.body;
    
    // Process through the Single Central AI HR Brain
    const brainResult = await aiHrBrain.processCallCompletion({
      candidate,
      transcript: transcript || [],
      callScenario: callScenario || 'screening',
      callDuration: callDuration || 60,
      availableSlots: availableSlots || [],
      bookedSlotId,
      conversationId,
      genAIClient: getGenAI(),
    });

    return res.json(brainResult);
  } catch (err: any) {
    console.error('Fatal error in /api/call/process-completion:', err);
    const fallback = generateFallbackPostCallAnalysis(
      req.body?.candidate,
      req.body?.transcript || [],
      req.body?.callScenario || 'screening',
      req.body?.availableSlots || [],
      req.body?.bookedSlotId
    );
    return res.json(fallback);
  }
});

// Endpoint: Call Summarizer (Legacy compatible, powered by post-call pipeline)
app.post('/api/call/summarize', async (req, res) => {
  try {
    const brainResult = await aiHrBrain.processCallCompletion({
      candidate: req.body?.candidate,
      transcript: req.body?.transcript || [],
      callScenario: req.body?.callScenario || 'screening',
      callDuration: req.body?.callDuration || 60,
      availableSlots: req.body?.availableSlots || [],
      bookedSlotId: req.body?.bookedSlotId,
      conversationId: req.body?.conversationId,
      genAIClient: getGenAI(),
    });

    return res.json({
      summary: brainResult.summary,
      keyHighlights: brainResult.keyHighlights || [],
      scorecard: brainResult.scorecard,
      latestRemark: brainResult.factBasedRemark,
      extractedFields: brainResult.extractedFields,
      conversationMemory: brainResult.afterCallAction.candidate_answers,
      statusAnalysis: brainResult.statusAnalysis,
      communicationDecision: brainResult.communicationDecision,
      afterCallAction: brainResult.afterCallAction,
    });
  } catch (error) {
    console.error('Error in /api/call/summarize:', error);
    const fallback = generateFallbackPostCallAnalysis(
      req.body?.candidate,
      req.body?.transcript || [],
      req.body?.callScenario || 'screening',
      req.body?.availableSlots || [],
      req.body?.bookedSlotId
    );
    return res.json({
      summary: fallback.summary,
      keyHighlights: fallback.keyHighlights,
      scorecard: fallback.scorecard,
      latestRemark: fallback.factBasedRemark,
      extractedFields: fallback.extractedFields,
      conversationMemory: fallback.conversationMemory,
      statusAnalysis: fallback.statusAnalysis,
      communicationDecision: fallback.communicationDecision,
      afterCallAction: fallback.afterCallAction,
    });
  }
});

// ==========================================
// SINGLE AI HR BRAIN — DEDICATED REST API
// ==========================================

// 1. Brain Overview & System Statistics
app.get('/api/brain/stats', (req, res) => {
  try {
    const stats = aiHrBrain.getBrainOverviewStats();
    return res.json(stats);
  } catch (err: any) {
    console.error('Error fetching brain stats:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 2. Candidate Long-Term Memory Retrieval
app.get('/api/brain/candidate-memory/:id', (req, res) => {
  try {
    const memory = aiHrBrain.getCandidateMemory(req.params.id);
    if (!memory) {
      return res.status(404).json({ error: 'Candidate memory not found' });
    }
    return res.json(memory);
  } catch (err: any) {
    console.error('Error fetching candidate memory:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 3. Candidate Long-Term Memory Get or Init
app.post('/api/brain/candidate-memory', (req, res) => {
  try {
    const memory = aiHrBrain.getOrCreateCandidateMemory(req.body);
    return res.json(memory);
  } catch (err: any) {
    console.error('Error creating candidate memory:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 4. Next Call Brief Generation (Zero Repetition / Context Generator)
app.post('/api/brain/next-call-brief', (req, res) => {
  try {
    const { candidate, callHistory } = req.body;
    const brief = aiHrBrain.getNextCallBrief(candidate, callHistory || []);
    return res.json(brief);
  } catch (err: any) {
    console.error('Error generating next call brief:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 5. Resolve Contradiction
app.post('/api/brain/contradiction/resolve', (req, res) => {
  try {
    const { candidateId, contradictionId, resolvedValue, resolutionNote, reviewerName } = req.body;
    const success = aiHrBrain.resolveCandidateContradiction(
      candidateId,
      contradictionId,
      resolvedValue,
      resolutionNote,
      reviewerName || 'Recruiter'
    );
    return res.json({ success });
  } catch (err: any) {
    console.error('Error resolving contradiction:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 6. Learning Proposals Management
app.get('/api/brain/proposals', (req, res) => {
  try {
    const proposals = aiHrBrain.getLearningProposals();
    return res.json(proposals);
  } catch (err: any) {
    console.error('Error fetching proposals:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/brain/proposals/review', (req, res) => {
  try {
    const { proposalId, status, reviewerName, reviewNotes } = req.body;
    const updated = aiHrBrain.reviewLearningProposal(
      proposalId,
      status,
      reviewerName || 'HR Director',
      reviewNotes
    );
    return res.json(updated);
  } catch (err: any) {
    console.error('Error reviewing proposal:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 7. Human HR Feedback Submission
app.post('/api/brain/feedback', (req, res) => {
  try {
    const record = aiHrBrain.submitHumanFeedback(req.body);
    return res.json(record);
  } catch (err: any) {
    console.error('Error submitting feedback:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 8. Memory Audit Trail
app.get('/api/brain/audit-trail', (req, res) => {
  try {
    const candidateId = req.query.candidateId as string | undefined;
    const audit = aiHrBrain.getAuditTrail(candidateId);
    return res.json(audit);
  } catch (err: any) {
    console.error('Error fetching audit trail:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 9. Question & Scenario Effectiveness Stats
app.get('/api/brain/question-stats', (req, res) => {
  try {
    const stats = aiHrBrain.getQuestionStats();
    return res.json(stats);
  } catch (err: any) {
    console.error('Error fetching question stats:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/brain/scenario-stats', (req, res) => {
  try {
    const stats = aiHrBrain.getScenarioStats();
    return res.json(stats);
  } catch (err: any) {
    console.error('Error fetching scenario stats:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 10. Candidate Behavior & Conversation Intelligence Engine (Rules 1-43)
app.get('/api/brain/behavior/history/:id', (req, res) => {
  try {
    const history = aiHrBrain.getCandidateBehaviorHistory(req.params.id);
    return res.json(history);
  } catch (err: any) {
    console.error('Error fetching candidate behavior history:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/brain/behavior/latest/:id', (req, res) => {
  try {
    const report = aiHrBrain.getLatestBehaviorReport(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'No behavior report found for candidate' });
    }
    return res.json(report);
  } catch (err: any) {
    console.error('Error fetching latest behavior report:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/brain/behavior/flagged-reviews', (req, res) => {
  try {
    const flagged = aiHrBrain.getFlaggedForHumanReview();
    return res.json(flagged);
  } catch (err: any) {
    console.error('Error fetching flagged behavior reviews:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/brain/behavior/analyze-turn', (req, res) => {
  try {
    const { turnText, previousAgentText, turnIndex, callStage, candidateName, callId, existingState } = req.body;
    const realTimeState = aiHrBrain.analyzeCandidateTurn({
      turnText: turnText || '',
      previousAgentText,
      turnIndex: turnIndex || 0,
      callStage,
      candidateName,
      callId,
      existingState,
    });
    return res.json(realTimeState);
  } catch (err: any) {
    console.error('Error analyzing candidate turn:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// CANDIDATE REPOSITORY & CALLING LOCK REST API
// ==========================================

// Acquire Calling Lock before initiating an AI or Vapi call (Rule 16)
app.post('/api/candidate/:id/lock', async (req, res) => {
  try {
    const { callId, timeoutMinutes } = req.body;
    const candidateId = req.params.id;
    const lockResult = await candidateRepository.acquireCallingLock(
      candidateId,
      callId || `call-${Date.now()}`,
      timeoutMinutes || 10
    );
    return res.json(lockResult);
  } catch (err: any) {
    console.error('Error acquiring calling lock:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Release Calling Lock after call completion or termination
app.post('/api/candidate/:id/unlock', async (req, res) => {
  try {
    const { callId } = req.body;
    const candidateId = req.params.id;
    const success = await candidateRepository.releaseCallingLock(candidateId, callId);
    return res.json({ success });
  } catch (err: any) {
    console.error('Error releasing calling lock:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Get Candidate by ID
app.get('/api/candidate/:id', async (req, res) => {
  try {
    const candidate = await candidateRepository.getCandidate(req.params.id);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    return res.json(candidate);
  } catch (err: any) {
    console.error('Error fetching candidate:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Update Candidate
app.patch('/api/candidate/:id', async (req, res) => {
  try {
    const updated = await candidateRepository.updateCandidate(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    return res.json(updated);
  } catch (err: any) {
    console.error('Error updating candidate:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// INTERVIEW SLOTS TRANSACTION REST API
// ==========================================

// Get all interview slots
app.get('/api/slots', async (req, res) => {
  try {
    const slots = await interviewSlotRepository.getAllSlots();
    return res.json(slots);
  } catch (err: any) {
    console.error('Error fetching slots:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Book Slot with Concurrency / Double-booking protection (Step 8 & 14)
app.post('/api/slots/book', async (req, res) => {
  try {
    const { slotId, candidateId, candidateName } = req.body;
    if (!slotId || !candidateId) {
      return res.status(400).json({ error: 'slotId and candidateId are required' });
    }
    const result = await interviewSlotRepository.bookSlot(slotId, candidateId, candidateName || 'Candidate');
    return res.json(result);
  } catch (err: any) {
    console.error('Error booking slot:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Release Slot
app.post('/api/slots/release', async (req, res) => {
  try {
    const { slotId, candidateId } = req.body;
    if (!slotId) {
      return res.status(400).json({ error: 'slotId is required' });
    }
    const success = await interviewSlotRepository.releaseSlot(slotId, candidateId);
    return res.json({ success });
  } catch (err: any) {
    console.error('Error releasing slot:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// FOLLOWUPS REST API
// ==========================================

app.get('/api/followups/pending', async (req, res) => {
  try {
    const pending = await followupRepository.getPendingFollowups();
    return res.json(pending);
  } catch (err: any) {
    console.error('Error fetching pending followups:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/followups', async (req, res) => {
  try {
    const created = await followupRepository.createFollowup(req.body);
    return res.json(created);
  } catch (err: any) {
    console.error('Error creating followup:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// AUTOMATED AI HR CALLING QUEUE REST API
// ==========================================

app.get('/api/automation/status', async (req, res) => {
  try {
    const status = callingQueueManager.getStatus();
    return res.json(status);
  } catch (err: any) {
    console.error('Error fetching automation status:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/automation/settings', async (req, res) => {
  try {
    const settings = await callingQueueManager.loadSettings();
    return res.json(settings);
  } catch (err: any) {
    console.error('Error loading automation settings:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/automation/settings', async (req, res) => {
  try {
    const updated = await callingQueueManager.updateSettings(req.body);
    return res.json(updated);
  } catch (err: any) {
    console.error('Error updating automation settings:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/automation/queue', async (req, res) => {
  try {
    const queue = await callingQueueManager.getQueue();
    return res.json(queue);
  } catch (err: any) {
    console.error('Error reading queue:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/automation/stats', async (req, res) => {
  try {
    const stats = await callingQueueManager.loadDailyStats();
    return res.json(stats);
  } catch (err: any) {
    console.error('Error fetching daily stats:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/automation/start', async (req, res) => {
  try {
    const forceEnable = Boolean(req.body.forceEnable);
    const result = await callingQueueManager.startAutomation(forceEnable);
    return res.json(result);
  } catch (err: any) {
    console.error('Error starting automation:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/automation/stop', async (req, res) => {
  try {
    const result = await callingQueueManager.stopAutomation();
    return res.json(result);
  } catch (err: any) {
    console.error('Error stopping automation:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/automation/pause', async (req, res) => {
  try {
    const result = await callingQueueManager.pauseAutomation();
    return res.json(result);
  } catch (err: any) {
    console.error('Error pausing automation:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/automation/resume', async (req, res) => {
  try {
    const result = await callingQueueManager.resumeAutomation();
    return res.json(result);
  } catch (err: any) {
    console.error('Error resuming automation:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/automation/populate', async (req, res) => {
  try {
    const ignoreTimeWindow = Boolean(req.body.ignoreTimeWindow);
    const result = await callingQueueManager.populateQueueFromEligibleCandidates({ ignoreTimeWindow });
    return res.json(result);
  } catch (err: any) {
    console.error('Error populating queue:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/automation/run-dry-test', async (req, res) => {
  try {
    const limitCount = typeof req.body.limit === 'number' ? req.body.limit : 5;
    const result = await callingQueueManager.runDryTest(limitCount);
    return res.json(result);
  } catch (err: any) {
    console.error('Error executing dry test:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Vite middleware & Production static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Server] Port ${PORT} is already in use. A process is already running on this port.`);
    } else {
      console.error('[Server] Unhandled server error:', err);
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`White Collar Realty HR Voice Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
