import {
  QuestionTopic,
  QuestionLifecycleStatus,
  AskedQuestionRecord,
  ContradictionRecord,
  QuestionStateEngine,
} from '../types';

/**
 * Canonical Topic Definitions & Semantic Lexicon
 * Groups semantically equivalent question patterns under canonical topics.
 */
export const TOPIC_SEMANTIC_PATTERNS: Record<
  QuestionTopic,
  {
    label: string;
    description: string;
    samplePhrases: string[];
    priorityOrder: number;
    extractFacts: (text: string, candidateFacts: Record<string, any>) => Partial<Record<string, any>>;
  }
> = {
  identity_permission: {
    label: 'Identity & Availability',
    description: 'Verify candidate identity and 2-minute availability check',
    samplePhrases: [
      'am i speaking with',
      'do you have a couple of minutes',
      'is this a good time to speak',
      'regarding your application',
      'calling from white collar realty',
      'hi, am i speaking with',
    ],
    priorityOrder: 1,
    extractFacts: (text) => {
      const lower = text.toLowerCase();
      if (lower.includes('yes') || lower.includes('speaking') || lower.includes('haan') || lower.includes('sure') || lower.includes('bol raha')) {
        return { identityConfirmed: true, permissionGranted: true };
      }
      return {};
    },
  },
  candidate_introduction: {
    label: 'Candidate Introduction & Background Walkthrough',
    description: 'Candidate self-introduction covering experience, current role, market, developers, ticket sizes, and targets',
    samplePhrases: [
      'walk me through your experience and what you\'re currently handling',
      'give me a quick introduction about yourself and your real-estate experience',
      'briefly introduce yourself and tell me what kind of real-estate sales you\'ve been handling',
      'tell me about your background in real estate',
      'walk me through your background',
    ],
    priorityOrder: 2,
    extractFacts: (text, currentFacts) => {
      const lower = text.toLowerCase();
      const extracted: Record<string, any> = { candidateIntroGiven: true };

      // Experience parsing
      const expMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/);
      if (expMatch) {
        extracted.totalExperienceYears = parseFloat(expMatch[1]);
        extracted.realEstateExperienceYears = parseFloat(expMatch[1]);
      }

      // Company detection
      const companies = ['dlf', 'm3m', 'square yards', 'anarock', 'godrej', 'emaar', 'sobha', 'proptiger', 'signature global', 'adani', 'trump tower', 'central park', 'smartworld', 'elan', 'tarc', 'whiteland', 'conscient'];
      for (const comp of companies) {
        if (lower.includes(comp)) {
          extracted.currentCompany = comp.toUpperCase();
          break;
        }
      }

      // Designation detection
      const desigs = ['senior sales executive', 'sales manager', 'team lead', 'associate director', 'property consultant', 'senior consultant', 'pre-sales executive', 'relationship manager', 'closing manager', 'business development executive', 'bde'];
      for (const d of desigs) {
        if (lower.includes(d)) {
          extracted.currentDesignation = d.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          break;
        }
      }

      // Market detection
      const markets: string[] = [];
      if (lower.includes('gurgaon') || lower.includes('gurugram')) markets.push('Gurugram');
      if (lower.includes('golf course road') || lower.includes('golf course extension')) markets.push('Golf Course Rd / Ext');
      if (lower.includes('spr') || lower.includes('southern peripheral')) markets.push('SPR');
      if (lower.includes('dwarka expressway')) markets.push('Dwarka Expressway');
      if (lower.includes('new gurgaon') || lower.includes('new gurugram')) markets.push('New Gurugram');
      if (lower.includes('dubai')) markets.push('Dubai');
      if (markets.length > 0) {
        extracted.markets = markets;
        if (markets.some((m) => m.includes('Gurugram') || m.includes('Golf') || m.includes('SPR') || m.includes('Dwarka'))) {
          extracted.gurgaonExperience = true;
        }
        if (markets.includes('Dubai')) {
          extracted.dubaiExperience = true;
        }
      }

      // Segments
      const segments: string[] = [];
      if (lower.includes('ultra-luxury') || lower.includes('ultra luxury')) segments.push('Ultra-Luxury Residential');
      else if (lower.includes('luxury')) segments.push('Luxury Residential');
      else if (lower.includes('residential')) segments.push('Residential');
      if (lower.includes('commercial')) segments.push('Commercial');
      if (lower.includes('primary')) segments.push('Primary Sales');
      if (lower.includes('secondary') || lower.includes('resale')) segments.push('Secondary / Resale');
      if (segments.length > 0) extracted.segments = segments;

      // Ticket size detection
      const ticketMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:to|-)\s*(\d+(?:\.\d+)?)\s*(?:cr|crore|crores)/);
      if (ticketMatch) {
        extracted.luxuryTicketSize = `₹${ticketMatch[1]} - ₹${ticketMatch[2]} Cr`;
      } else {
        const singleCr = lower.match(/(\d+(?:\.\d+)?)\s*(?:cr|crore|crores)/);
        if (singleCr) {
          extracted.luxuryTicketSize = `₹${singleCr[1]} Cr`;
        }
      }

      // Team size detection
      const teamMatch = lower.match(/team of\s*(\d+)/) || lower.match(/(\d+)\s*(?:people|members|consultants)\s*team/);
      if (teamMatch) {
        extracted.teamSize = parseInt(teamMatch[1], 10);
      }

      return extracted;
    },
  },
  target_role: {
    label: 'Target Role Confirmation',
    description: 'Confirm role applied for (e.g. Sales Executive, Sales Manager, Pre-Sales)',
    samplePhrases: [
      'considered for the',
      'position, correct',
      'role applied for',
      'for the position of',
    ],
    priorityOrder: 2,
    extractFacts: (text) => {
      const lower = text.toLowerCase();
      if (lower.includes('yes') || lower.includes('correct') || lower.includes('right') || lower.includes('haan')) {
        return { roleConfirmed: true };
      }
      return {};
    },
  },
  current_company: {
    label: 'Current Organization',
    description: 'Current real estate employer / brokerage / builder firm',
    samplePhrases: [
      'which company are you currently with',
      'where are you currently working',
      'who are you working with',
      'which real estate company',
      'where are you working right now',
      'current organization',
    ],
    priorityOrder: 3,
    extractFacts: (text) => {
      const lower = text.toLowerCase();
      const companies = ['dlf', 'm3m', 'square yards', 'anarock', 'godrej', 'emaar', 'sobha', 'proptiger', 'signature global', 'adani', 'trump tower', 'central park', 'abc realty', 'propshop', '360 realtors', 'investors clinic'];
      for (const comp of companies) {
        if (lower.includes(comp)) {
          return { currentCompany: comp.toUpperCase() };
        }
      }
      if (text.length > 2 && text.length < 50 && !text.includes('?')) {
        return { currentCompany: text.trim() };
      }
      return {};
    },
  },
  current_designation: {
    label: 'Current Designation',
    description: 'Current professional title / role level',
    samplePhrases: [
      'what is your current designation',
      'what designation do you hold',
      'what is your role there',
      'what position do you hold',
    ],
    priorityOrder: 4,
    extractFacts: (text) => {
      const lower = text.toLowerCase();
      const desigs = ['senior consultant', 'property consultant', 'sales manager', 'team lead', 'associate', 'director', 'manager', 'consultant', 'sales executive', 'pre-sales executive', 'relationship manager', 'closing manager'];
      for (const d of desigs) {
        if (lower.includes(d)) {
          return { currentDesignation: d.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') };
        }
      }
      return {};
    },
  },
  total_real_estate_experience: {
    label: 'Real Estate Sales Experience',
    description: 'Total years of active property sales advisory experience',
    samplePhrases: [
      'how many years of experience',
      'how long have you been working in real estate',
      'how much experience do you have in real estate sales',
      'tell me about your total real-estate experience',
      'total sales experience',
      'years in property sales',
    ],
    priorityOrder: 5,
    extractFacts: (text) => {
      const lower = text.toLowerCase();
      const expMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/);
      if (expMatch) {
        return { totalExperienceYears: parseFloat(expMatch[1]), realEstateExperienceYears: parseFloat(expMatch[1]) };
      }
      const numMatch = lower.match(/\b(\d+(?:\.\d+)?)\b/);
      if (numMatch && (lower.includes('experience') || lower.includes('year') || lower.length < 15)) {
        return { totalExperienceYears: parseFloat(numMatch[1]), realEstateExperienceYears: parseFloat(numMatch[1]) };
      }
      return {};
    },
  },
  gurgaon_experience: {
    label: 'Gurgaon Micro-Market Exposure',
    description: 'Familiarity with Golf Course Rd, Ext Rd, SPR, Dwarka Exp, Sohna Rd',
    samplePhrases: [
      'how familiar are you with the gurgaon market',
      'gurgaon real estate experience',
      'which micro-markets in gurgaon',
      'closed any deals in golf course road or spr',
      'experience in gurugram',
    ],
    priorityOrder: 6,
    extractFacts: (text) => {
      const lower = text.toLowerCase();
      if (lower.includes('gurgaon') || lower.includes('gurugram') || lower.includes('golf course') || lower.includes('spr') || lower.includes('dwarka') || lower.includes('sohna')) {
        return { gurgaonExperience: true, gurgaonDetails: text.trim() };
      }
      return {};
    },
  },
  dubai_experience: {
    label: 'Dubai Market Exposure',
    description: 'Off-plan and luxury freehold experience in Dubai prime communities',
    samplePhrases: [
      'worked in dubai',
      'dubai real estate experience',
      'dubai off-plan',
      'palm jumeirah or dubai hills',
    ],
    priorityOrder: 7,
    extractFacts: (text) => {
      const lower = text.toLowerCase();
      if (lower.includes('dubai') || lower.includes('off-plan') || lower.includes('palm') || lower.includes('downtown')) {
        return { dubaiExperience: true, dubaiDetails: text.trim() };
      }
      return {};
    },
  },
  developer_projects: {
    label: 'Developer Portfolios Closed',
    description: 'Specific builder projects closed (DLF, M3M, Godrej, Emaar, Sobha, SmartWorld)',
    samplePhrases: [
      'which specific developers and projects',
      'which builders have you closed',
      'dlf m3m godrej emaar',
      'projects have you actively closed',
    ],
    priorityOrder: 8,
    extractFacts: (text) => {
      const lower = text.toLowerCase();
      const devs = ['dlf', 'm3m', 'godrej', 'emaar', 'sobha', 'smartworld', 'elan', 'central park'];
      const matched = devs.filter((d) => lower.includes(d));
      if (matched.length > 0) {
        return { developerProjects: matched.map((d) => d.toUpperCase()).join(', ') };
      }
      return {};
    },
  },
  residential_luxury_ticket_size: {
    label: 'Luxury Ticket Size & Conversion',
    description: 'Average & highest deal ticket sizes (₹3 Cr – ₹15 Cr+)',
    samplePhrases: [
      'what has been your average ticket size',
      'highest single-ticket luxury residential',
      'ticket sizes have you closed',
      'what category of properties have you primarily closed',
    ],
    priorityOrder: 9,
    extractFacts: (text) => {
      const lower = text.toLowerCase();
      const crMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:cr|crore|crores)/);
      if (crMatch) {
        return { luxuryTicketSize: `₹${crMatch[1]} Cr` };
      }
      return {};
    },
  },
  manager_personal_vs_team_closures: {
    label: 'Personal vs Squad Closures (Manager Role)',
    description: 'Ratio of direct personal closures vs negotiation assistance and squad management',
    samplePhrases: [
      'direct personal contribution versus deals',
      'how large was the sales team',
      'walk me through one of your last five major high-ticket closures',
      'out of your total monthly closures',
    ],
    priorityOrder: 10,
    extractFacts: (text) => {
      if (text.length > 10) {
        return { managerialClosureDetails: text.trim() };
      }
      return {};
    },
  },
  sales_performance_metrics: {
    label: 'Sales Run-Rate & Site Visit Metrics',
    description: 'Monthly gross bookings, qualified calls to site visit ratios',
    samplePhrases: [
      'monthly qualified lead-to-site-visit',
      'how many qualified site visits',
      'how many calls or leads were you typically handling',
      'what has been your monthly run-rate',
    ],
    priorityOrder: 11,
    extractFacts: (text) => {
      if (text.length > 5) {
        return { performanceMetrics: text.trim() };
      }
      return {};
    },
  },
  scenario_evaluation: {
    label: 'Scenario Objection / Negotiation Test',
    description: 'Handling client objections, price comparisons without discounting',
    samplePhrases: [
      'suppose an hni buyer has completed a site visit',
      'suppose one of your top consultants',
      'how would you coach them to demonstrate value',
      'stuck on price between two competing luxury projects',
    ],
    priorityOrder: 12,
    extractFacts: (text) => {
      if (text.length > 15) {
        return { scenarioResponse: text.trim() };
      }
      return {};
    },
  },
  motivation_for_change: {
    label: 'Reason for Job Change',
    description: 'Career motivation and reasons for considering White Collar Realty',
    samplePhrases: [
      'what is prompting you to look for a change',
      'why are you looking to leave',
      'reason for change',
    ],
    priorityOrder: 13,
    extractFacts: (text) => {
      if (text.length > 5) {
        return { reasonForChange: text.trim() };
      }
      return {};
    },
  },
  current_salary: {
    label: 'Current Fixed CTC',
    description: 'Current fixed annual compensation / in-hand monthly salary',
    samplePhrases: [
      'what is your current fixed salary',
      'could you share your current compensation',
      'what are you drawing currently',
      'current fixed ctc',
      'current salary',
    ],
    priorityOrder: 14,
    extractFacts: (text) => {
      const lower = text.toLowerCase();
      if (lower.includes('confidential') || lower.includes('nda') || lower.includes('prefer not') || lower.includes('cannot disclose')) {
        return { currentSalaryLPA: 'Confidential', salaryDeclined: true };
      }
      const salMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:lpa|lakh|lakhs|lac|lacs)/);
      if (salMatch) {
        return { currentSalaryLPA: `${salMatch[1]} LPA` };
      }
      return {};
    },
  },
  expected_salary: {
    label: 'Expected CTC',
    description: 'Expected fixed compensation / CTC expectation',
    samplePhrases: [
      'what are you expecting for your next move',
      'expected compensation',
      'expected ctc',
      'expected salary',
    ],
    priorityOrder: 15,
    extractFacts: (text) => {
      const lower = text.toLowerCase();
      const expMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:lpa|lakh|lakhs|lac|lacs)/);
      if (expMatch) {
        return { expectedSalaryLPA: `${expMatch[1]} LPA` };
      }
      return {};
    },
  },
  notice_period: {
    label: 'Notice Period & Earliest Joining',
    description: 'Current notice period in days and joining date feasibility',
    samplePhrases: [
      'what is your current notice period',
      'how soon can you join',
      'earliest joining date',
      'serving notice',
      'notice period',
    ],
    priorityOrder: 16,
    extractFacts: (text) => {
      const lower = text.toLowerCase();
      if (lower.includes('immediate') || lower.includes('turant') || lower.includes('serving')) {
        return { noticePeriodDays: 0, earliestJoining: 'Immediate' };
      }
      const noticeMatch = lower.match(/(\d+)\s*(?:days?|din)/);
      if (noticeMatch) {
        return { noticePeriodDays: parseInt(noticeMatch[1], 10) };
      }
      const numMatch = lower.match(/\b(\d+)\b/);
      if (numMatch && (lower.includes('day') || lower.includes('month'))) {
        return { noticePeriodDays: parseInt(numMatch[1], 10) };
      }
      return {};
    },
  },
  f2f_interview_availability: {
    label: 'F2F Interview Availability',
    description: 'Availability to visit Corporate HQ at Sector 67 Gurugram',
    samplePhrases: [
      'invite you for a face-to-face interview',
      'available for an in-person meeting',
      'm3m urbana business park, sector 67',
      'f2f interview',
    ],
    priorityOrder: 17,
    extractFacts: (text) => {
      const lower = text.toLowerCase();
      if (lower.includes('yes') || lower.includes('sure') || lower.includes('haan') || lower.includes('available') || lower.includes('tomorrow') || lower.includes('kal')) {
        return { interviewVenueConfirmed: true };
      }
      return {};
    },
  },
  f2f_interview_slot: {
    label: 'F2F Interview Slot Booking',
    description: 'Specific date and time slot confirmation',
    samplePhrases: [
      'which slot works best for you',
      'slots available on',
      'confirm your interview for',
      'tomorrow at 2:30 pm',
    ],
    priorityOrder: 18,
    extractFacts: (text) => {
      const lower = text.toLowerCase();
      if (lower.includes('2:30') || lower.includes('4:30') || lower.includes('tomorrow') || lower.includes('friday') || lower.includes('slot-2') || lower.includes('slot-3') || lower.includes('slot-4') || lower.includes('perfect') || lower.includes('confirm')) {
        return { interviewSlotConfirmed: true, slotDetails: text.trim() };
      }
      return {};
    },
  },
  candidate_questions: {
    label: 'Candidate Inquiry Resolution',
    description: 'Questions asked by candidate (timings, office address, leads, benefits, etc.)',
    samplePhrases: [
      'where is your office',
      'working hours',
      'office timings',
      'leads support',
      'cab facility',
      'about the company',
    ],
    priorityOrder: 0,
    extractFacts: () => ({}),
  },
  busy_callback_time: {
    label: 'Driving / Busy Callback Time',
    description: 'Candidate busy, requested specific callback time',
    samplePhrases: [
      'i am driving',
      'i am busy',
      'in a meeting',
      'call me back later',
      'call later',
    ],
    priorityOrder: 0,
    extractFacts: (text) => ({ callbackRequested: true, callbackDetails: text.trim() }),
  },
};

/**
 * Normalizes question text for semantic duplicate checking.
 */
export function normalizeQuestionText(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detects the canonical topic of an agent or candidate utterance.
 */
export function detectQuestionTopic(questionText: string): QuestionTopic | null {
  const norm = normalizeQuestionText(questionText);

  for (const [topic, def] of Object.entries(TOPIC_SEMANTIC_PATTERNS) as [QuestionTopic, typeof TOPIC_SEMANTIC_PATTERNS[QuestionTopic]][]) {
    for (const phrase of def.samplePhrases) {
      if (norm.includes(normalizeQuestionText(phrase))) {
        return topic;
      }
    }
  }

  // Heuristic fallbacks
  if (norm.includes('year') && (norm.includes('experience') || norm.includes('sales'))) {
    return 'total_real_estate_experience';
  }
  if (norm.includes('company') || norm.includes('employer') || norm.includes('organization')) {
    return 'current_company';
  }
  if (norm.includes('designation') || norm.includes('role') || norm.includes('title')) {
    return 'current_designation';
  }
  if (norm.includes('salary') || norm.includes('ctc') || norm.includes('package') || norm.includes('compensation')) {
    if (norm.includes('expected') || norm.includes('next')) {
      return 'expected_salary';
    }
    return 'current_salary';
  }
  if (norm.includes('notice') || norm.includes('join') || norm.includes('earliest')) {
    return 'notice_period';
  }
  if (norm.includes('gurgaon') || norm.includes('gurugram') || norm.includes('spr') || norm.includes('golf course')) {
    return 'gurgaon_experience';
  }
  if (norm.includes('dubai') || norm.includes('offplan')) {
    return 'dubai_experience';
  }
  if (norm.includes('slot') || norm.includes('interview') || norm.includes('m3m urbana')) {
    return 'f2f_interview_slot';
  }

  return null;
}

/**
 * Initialize a fresh Question State Engine instance.
 */
export function createInitialQuestionStateEngine(candidate?: any): QuestionStateEngine {
  const initialFacts: Record<string, any> = {};
  const answeredTopics: string[] = [];

  if (candidate?.screening?.currentCompany) {
    initialFacts.currentCompany = candidate.screening.currentCompany;
    answeredTopics.push('current_company');
  }
  if (candidate?.screening?.currentDesignation) {
    initialFacts.currentDesignation = candidate.screening.currentDesignation;
    answeredTopics.push('current_designation');
  }
  if (candidate?.screening?.totalExperienceYears || candidate?.screening?.realEstateExperienceYears) {
    const exp = candidate.screening.realEstateExperienceYears || candidate.screening.totalExperienceYears;
    initialFacts.totalExperienceYears = exp;
    initialFacts.realEstateExperienceYears = exp;
    answeredTopics.push('total_real_estate_experience');
  }
  if (candidate?.screening?.currentSalaryLPA) {
    initialFacts.currentSalaryLPA = candidate.screening.currentSalaryLPA;
    answeredTopics.push('current_salary');
  }
  if (candidate?.screening?.expectedSalaryLPA) {
    initialFacts.expectedSalaryLPA = candidate.screening.expectedSalaryLPA;
    answeredTopics.push('expected_salary');
  }
  if (candidate?.screening?.noticePeriodDays !== undefined) {
    initialFacts.noticePeriodDays = candidate.screening.noticePeriodDays;
    answeredTopics.push('notice_period');
  }

  const allTopics: QuestionTopic[] = [
    'identity_permission',
    'target_role',
    'current_company',
    'current_designation',
    'total_real_estate_experience',
    'gurgaon_experience',
    'developer_projects',
    'residential_luxury_ticket_size',
    'current_salary',
    'expected_salary',
    'notice_period',
    'f2f_interview_slot',
  ];

  const openTopics = allTopics.filter((t) => !answeredTopics.includes(t));

  return {
    activeQuestionId: null,
    activeQuestion: null,
    activeTopic: null,
    questionStatus: 'QUESTION_GENERATED',
    lastSpokenQuestion: null,
    askedQuestions: [],
    answeredTopics,
    openTopics,
    candidateFacts: initialFacts,
    pendingClarifications: [],
    contradictions: [],
  };
}

/**
 * Core Intelligence Gate: Evaluates proposed question through 7 strict validation checks.
 */
export interface GateCheckResult {
  passed: boolean;
  rejectReason?: string;
  suggestedAction: 'ASK_NEXT_QUESTION' | 'DO_NOT_ASK' | 'SEEK_CLARIFICATION' | 'WAIT_FOR_COMPLETION';
  clarificationPrompt?: string;
  detectedTopic: QuestionTopic | null;
}

export function evaluateQuestionGate(
  proposedQuestion: string,
  state: QuestionStateEngine,
  isCandidateStillSpeaking: boolean = false
): GateCheckResult {
  const normProposed = normalizeQuestionText(proposedQuestion);
  const detectedTopic = detectQuestionTopic(proposedQuestion);

  // CHECK 1: Active Question Lock - Is previous question still waiting for answer?
  if (state.activeQuestionId && state.questionStatus === 'WAIT_FOR_ANSWER' && !isCandidateStillSpeaking) {
    // If the proposed question is just the active question, it's a re-prompt; reject duplicate unless explicit
    if (state.activeQuestion && normalizeQuestionText(state.activeQuestion) === normProposed) {
      return {
        passed: false,
        rejectReason: `ACTIVE_QUESTION_LOCK: Question ${state.activeQuestionId} is currently active and awaiting answer. Do not re-ask.`,
        suggestedAction: 'DO_NOT_ASK',
        detectedTopic,
      };
    }
  }

  // CHECK 2: Is candidate currently speaking?
  if (isCandidateStillSpeaking) {
    return {
      passed: false,
      rejectReason: 'CANDIDATE_SPEAKING: Candidate is still speaking. Floor belongs to candidate.',
      suggestedAction: 'WAIT_FOR_COMPLETION',
      detectedTopic,
    };
  }

  // CHECK 3: Is proposed question exactly or nearly identical to already asked question?
  const exactMatch = state.askedQuestions.find(
    (q) => q.normalizedQuestion === normProposed || normProposed.includes(q.normalizedQuestion) || q.normalizedQuestion.includes(normProposed)
  );
  if (exactMatch && exactMatch.answerStatus === 'ANSWERED') {
    return {
      passed: false,
      rejectReason: `DUPLICATE_QUESTION: Exactly/semantically identical to asked question ${exactMatch.questionId} (${exactMatch.exactQuestion}) which was already answered.`,
      suggestedAction: 'DO_NOT_ASK',
      detectedTopic,
    };
  }

  // CHECK 4: Is proposed question semantically equivalent to a completed topic?
  if (detectedTopic && state.answeredTopics.includes(detectedTopic)) {
    // Check if it adds NEW sub-dimension (valid follow-up)
    const topicAsked = state.askedQuestions.filter((q) => q.topic === detectedTopic);
    if (topicAsked.length > 0) {
      const isSubDimension =
        (detectedTopic === 'total_real_estate_experience' && normProposed.includes('gurgaon')) ||
        (detectedTopic === 'current_company' && normProposed.includes('team size')) ||
        (detectedTopic === 'current_salary' && normProposed.includes('in hand'));

      if (!isSubDimension) {
        return {
          passed: false,
          rejectReason: `TOPIC_ALREADY_COMPLETE: Topic "${detectedTopic}" is already complete. Semantic duplicate forbidden.`,
          suggestedAction: 'DO_NOT_ASK',
          detectedTopic,
        };
      }
    }
  }

  // CHECK 5: Has this information already been provided voluntarily in candidate facts?
  if (detectedTopic) {
    if (detectedTopic === 'total_real_estate_experience' && state.candidateFacts.totalExperienceYears !== undefined) {
      return {
        passed: false,
        rejectReason: `FACT_ALREADY_KNOWN: Real estate experience (${state.candidateFacts.totalExperienceYears} years) already provided voluntarily.`,
        suggestedAction: 'DO_NOT_ASK',
        detectedTopic,
      };
    }
    if (detectedTopic === 'current_company' && state.candidateFacts.currentCompany) {
      return {
        passed: false,
        rejectReason: `FACT_ALREADY_KNOWN: Current company (${state.candidateFacts.currentCompany}) already provided voluntarily.`,
        suggestedAction: 'DO_NOT_ASK',
        detectedTopic,
      };
    }
    if (detectedTopic === 'current_designation' && state.candidateFacts.currentDesignation) {
      return {
        passed: false,
        rejectReason: `FACT_ALREADY_KNOWN: Current designation (${state.candidateFacts.currentDesignation}) already known.`,
        suggestedAction: 'DO_NOT_ASK',
        detectedTopic,
      };
    }
    if (detectedTopic === 'notice_period' && state.candidateFacts.noticePeriodDays !== undefined) {
      return {
        passed: false,
        rejectReason: `FACT_ALREADY_KNOWN: Notice period (${state.candidateFacts.noticePeriodDays} days) already known.`,
        suggestedAction: 'DO_NOT_ASK',
        detectedTopic,
      };
    }
  }

  // CHECK 6: Check for pending contradictions
  if (state.pendingClarifications.length > 0) {
    const contradiction = state.contradictions.find((c) => c.status === 'PENDING_CLARIFICATION');
    if (contradiction) {
      return {
        passed: false,
        rejectReason: 'CONTRADICTION_PENDING: Candidate gave contradictory information; clarification required first.',
        suggestedAction: 'SEEK_CLARIFICATION',
        clarificationPrompt: `Earlier you mentioned ${contradiction.previousValue}, and now I heard ${contradiction.newValue}. Could you clarify which figure is correct?`,
        detectedTopic,
      };
    }
  }

  // All checks passed!
  return {
    passed: true,
    suggestedAction: 'ASK_NEXT_QUESTION',
    detectedTopic,
  };
}

/**
 * Transition question state when an agent speaks a question.
 */
export function recordQuestionSpoken(
  state: QuestionStateEngine,
  questionText: string,
  topicOverride?: QuestionTopic
): QuestionStateEngine {
  const topic = topicOverride || detectQuestionTopic(questionText) || 'candidate_questions';
  const questionCount = state.askedQuestions.length + 1;
  const questionId = `Q${String(questionCount).padStart(3, '0')}`;
  const norm = normalizeQuestionText(questionText);

  const newRecord: AskedQuestionRecord = {
    questionId,
    exactQuestion: questionText,
    normalizedQuestion: norm,
    topic,
    timestamp: new Date().toISOString(),
    answerStatus: 'WAITING',
    whetherFollowUpWasNeeded: false,
  };

  return {
    ...state,
    activeQuestionId: questionId,
    activeQuestion: questionText,
    activeTopic: topic,
    questionStatus: 'WAIT_FOR_ANSWER',
    lastSpokenQuestion: questionText,
    askedQuestions: [...state.askedQuestions, newRecord],
  };
}

/**
 * Transition question state when candidate answers.
 * Detects facts, contradictions, closes active question, updates answered topics.
 */
export function recordAnswerReceived(
  state: QuestionStateEngine,
  candidateAnswer: string
): { updatedState: QuestionStateEngine; extractedFacts: Record<string, any>; detectedContradiction: boolean } {
  const lower = candidateAnswer.toLowerCase();
  const updatedFacts = { ...state.candidateFacts };
  const updatedAnsweredTopics = new Set(state.answeredTopics);
  let detectedContradiction = false;
  const newContradictions = [...state.contradictions];
  const newPendingClarifications = [...state.pendingClarifications];

  // 1. Extract facts based on active topic or general scan across all topics
  for (const [topicKey, def] of Object.entries(TOPIC_SEMANTIC_PATTERNS) as [QuestionTopic, typeof TOPIC_SEMANTIC_PATTERNS[QuestionTopic]][]) {
    const facts = def.extractFacts(candidateAnswer, state.candidateFacts);
    if (Object.keys(facts).length > 0) {
      // Check for contradiction in numeric fields
      if (facts.totalExperienceYears !== undefined && updatedFacts.totalExperienceYears !== undefined) {
        if (facts.totalExperienceYears !== updatedFacts.totalExperienceYears) {
          detectedContradiction = true;
          newContradictions.push({
            topic: 'total_real_estate_experience',
            previousValue: `${updatedFacts.totalExperienceYears} years`,
            newValue: `${facts.totalExperienceYears} years`,
            status: 'PENDING_CLARIFICATION',
            timestamp: new Date().toISOString(),
          });
          newPendingClarifications.push(
            `Contradiction on real estate experience: previously ${updatedFacts.totalExperienceYears} yrs vs newly stated ${facts.totalExperienceYears} yrs.`
          );
        }
      }

      Object.assign(updatedFacts, facts);
      updatedAnsweredTopics.add(topicKey);
    }
  }

  // 2. Close active question if answered
  const updatedAskedQuestions = state.askedQuestions.map((q) => {
    if (q.questionId === state.activeQuestionId) {
      return {
        ...q,
        candidateAnswer,
        answerStatus: 'ANSWERED' as const,
      };
    }
    return q;
  });

  if (state.activeTopic) {
    updatedAnsweredTopics.add(state.activeTopic);
  }

  const answeredTopicsArray = Array.from(updatedAnsweredTopics);
  const openTopicsArray = state.openTopics.filter((t) => !answeredTopicsArray.includes(t));

  const updatedState: QuestionStateEngine = {
    ...state,
    activeQuestionId: null,
    activeQuestion: null,
    activeTopic: null,
    questionStatus: 'QUESTION_CLOSED',
    askedQuestions: updatedAskedQuestions,
    answeredTopics: answeredTopicsArray,
    openTopics: openTopicsArray,
    candidateFacts: updatedFacts,
    pendingClarifications: newPendingClarifications,
    contradictions: newContradictions,
  };

  return {
    updatedState,
    extractedFacts: updatedFacts,
    detectedContradiction,
  };
}

/**
 * Helper to select the highest priority next topic that is still uncollected.
 */
export function getNextPriorityOpenTopic(state: QuestionStateEngine): QuestionTopic | null {
  const priorityList: QuestionTopic[] = [
    'identity_permission',
    'target_role',
    'current_company',
    'current_designation',
    'total_real_estate_experience',
    'gurgaon_experience',
    'developer_projects',
    'residential_luxury_ticket_size',
    'current_salary',
    'expected_salary',
    'notice_period',
    'f2f_interview_slot',
  ];

  for (const topic of priorityList) {
    if (!state.answeredTopics.includes(topic)) {
      return topic;
    }
  }

  return null;
}

/**
 * =======================================================================
 * AUTONOMOUS REAL ESTATE SCENARIO ENGINE & REPERTOIRE
 * =======================================================================
 */

export interface ScenarioDefinition {
  id: string;
  category:
    | 'EARLY_CAREER'
    | 'MID_SALES'
    | 'SENIOR_SALES'
    | 'LUXURY_SALES'
    | 'PRIMARY_SALES'
    | 'SECONDARY_SALES'
    | 'PRE_SALES'
    | 'BDE'
    | 'SALES_MANAGER'
    | 'CLOSING_MANAGER'
    | 'GURUGRAM_MICRO_MARKET'
    | 'DUBAI_MARKET';
  minExp: number;
  maxExp?: number;
  roleTargets: string[];
  competencyTested: string;
  initialQuestion: string;
  followUpBranching: {
    condition: string;
    followUpQuestion: string;
  }[];
}

export const SCENARIO_CATALOG: ScenarioDefinition[] = [
  // 1. EARLY CAREER (0–2 Years)
  {
    id: 'SC_EARLY_A_NEW_LEAD_PRICE',
    category: 'EARLY_CAREER',
    minExp: 0,
    maxExp: 2,
    roleTargets: ['Sales Executive', 'Associate Property Consultant', 'Junior Sales'],
    competencyTested: 'Lead Qualification & Value-First Consultation',
    initialQuestion:
      'You receive a fresh lead for a luxury residential project, but the customer immediately says, "Send me the price and floor plan on WhatsApp." How would you handle that conversation?',
    followUpBranching: [
      {
        condition: 'sends price immediately',
        followUpQuestion: 'What would you ask before sending the price to ensure the customer doesn\'t immediately drop off?',
      },
      {
        condition: 'asks questions first',
        followUpQuestion: 'What would you do if the customer insists and refuses to share their budget or requirement over the phone?',
      },
    ],
  },
  {
    id: 'SC_EARLY_B_NO_RESPONSE',
    category: 'EARLY_CAREER',
    minExp: 0,
    maxExp: 2,
    roleTargets: ['Sales Executive', 'Associate Property Consultant', 'Junior Sales'],
    competencyTested: 'Follow-up Cadence & Persistence',
    initialQuestion:
      'You spoke to a prospective buyer once and they showed strong interest, but now they are not responding to calls or WhatsApp. What would be your follow-up strategy?',
    followUpBranching: [
      {
        condition: 'general follow up',
        followUpQuestion: 'How many times would you follow up before changing your communication channel or messaging angle?',
      },
    ],
  },
  {
    id: 'SC_EARLY_C_SITE_VISIT_CANCEL',
    category: 'EARLY_CAREER',
    minExp: 0,
    maxExp: 2,
    roleTargets: ['Sales Executive', 'Associate Property Consultant', 'Junior Sales'],
    competencyTested: 'Site Visit Rescheduling & Commitment Testing',
    initialQuestion:
      'A customer agreed to a site visit for a luxury residence but cancels two hours before the scheduled appointment. How would you handle the call?',
    followUpBranching: [
      {
        condition: 'reschedule attempt',
        followUpQuestion: 'How would you identify whether the cancellation is a genuine emergency or if the buyer has lost interest?',
      },
    ],
  },
  {
    id: 'SC_EARLY_D_PRICE_OBJECTION',
    category: 'EARLY_CAREER',
    minExp: 0,
    maxExp: 2,
    roleTargets: ['Sales Executive', 'Associate Property Consultant', 'Junior Sales'],
    competencyTested: 'Price Objection Handling vs Nearby Cheaper Options',
    initialQuestion:
      'A customer says, "Your project is too expensive. I can get something cheaper nearby." How would you respond?',
    followUpBranching: [
      {
        condition: 'explains value',
        followUpQuestion: 'How would you identify whether budget is actually their constraint versus a negotiation tactic?',
      },
    ],
  },

  // 2. MID-LEVEL SALES (2–5 Years)
  {
    id: 'SC_MID_A_LEAD_PRIORITIZATION',
    category: 'MID_SALES',
    minExp: 2,
    maxExp: 5,
    roleTargets: ['Senior Sales Executive', 'Property Consultant', 'Senior Consultant'],
    competencyTested: 'Lead Pipeline Prioritization & Buying Signals',
    initialQuestion:
      'You have 20 active leads in your pipeline, but only three are showing clear buying signals. How do you prioritize your time across the day?',
    followUpBranching: [
      {
        condition: 'pipeline allocation',
        followUpQuestion: 'What specific signals make you classify an HNI lead as high priority versus nurturing?',
      },
    ],
  },
  {
    id: 'SC_MID_B_HNI_NON_SALESY',
    category: 'MID_SALES',
    minExp: 2,
    maxExp: 5,
    roleTargets: ['Senior Sales Executive', 'Property Consultant', 'Senior Consultant'],
    competencyTested: 'Consultative Approach with Sophisticated HNI Buyers',
    initialQuestion:
      'You receive a lead from an HNI buyer looking at a luxury residence. They are knowledgeable about Gurgaon developers and don\'t want a standard sales pitch. How would you structure your first interaction?',
    followUpBranching: [
      {
        condition: 'consultative opening',
        followUpQuestion: 'What essential questions would you ask before presenting any specific property options?',
      },
    ],
  },
  {
    id: 'SC_MID_C_DISCOUNT_NEGOTIATION',
    category: 'MID_SALES',
    minExp: 2,
    maxExp: 5,
    roleTargets: ['Senior Sales Executive', 'Property Consultant', 'Senior Consultant'],
    competencyTested: 'Discount Negotiation & Margin Defense',
    initialQuestion:
      'A buyer loves the property but insists they will only book if they get a significant direct discount. How would you handle this negotiation without devaluing the asset?',
    followUpBranching: [
      {
        condition: 'discount handling',
        followUpQuestion: 'At what exact point would you involve your Sales Manager or Developer Relationship team?',
      },
    ],
  },
  {
    id: 'SC_MID_D_SITE_VISIT_THINK_ABOUT_IT',
    category: 'MID_SALES',
    minExp: 2,
    maxExp: 5,
    roleTargets: ['Senior Sales Executive', 'Property Consultant', 'Senior Consultant'],
    competencyTested: 'Post-Site Visit Conversion & Overcoming Stalls',
    initialQuestion:
      'You conducted a successful site visit. The customer clearly liked the property but ends by saying, "I will think about it and let you know." What is your immediate next step?',
    followUpBranching: [
      {
        condition: 'post visit follow up',
        followUpQuestion: 'What underlying hesitation would you try to uncover before scheduling your next follow-up call?',
      },
    ],
  },
  {
    id: 'SC_MID_E_SELF_GENERATION',
    category: 'MID_SALES',
    minExp: 2,
    maxExp: 5,
    roleTargets: ['Senior Sales Executive', 'Property Consultant'],
    competencyTested: 'Self-Generated Pipeline & Referral Acquisition',
    initialQuestion:
      'Suppose digital inbound leads are slow for a month. How do you generate your own high-ticket buyer opportunities?',
    followUpBranching: [
      {
        condition: 'organic sourcing',
        followUpQuestion: 'Which specific channels—such as HNI referrals, corporate tie-ups, or channel partners—have actually yielded closures for you in the past?',
      },
    ],
  },

  // 3. SENIOR SALES (5+ Years)
  {
    id: 'SC_SNR_A_HIGH_TICKET_CLOSURE_DELAY',
    category: 'SENIOR_SALES',
    minExp: 5,
    roleTargets: ['Senior Sales Executive', 'Team Lead', 'Senior Property Consultant', 'Assistant Manager'],
    competencyTested: 'High-Ticket Closing Momentum & Deal Urgency',
    initialQuestion:
      'You have a serious HNI buyer interested in a ₹5 Cr+ luxury residence. They like the property but are delaying the final signing. How do you move the deal forward without sounding desperate or pushy?',
    followUpBranching: [
      {
        condition: 'urgency creation',
        followUpQuestion: 'What specific indicators tell you that the client is genuinely ready to close versus keeping their options open?',
      },
    ],
  },
  {
    id: 'SC_SNR_B_UNAUTHORIZED_DISCOUNT_PRESSURE',
    category: 'SENIOR_SALES',
    minExp: 5,
    roleTargets: ['Senior Sales Executive', 'Team Lead', 'Senior Consultant'],
    competencyTested: 'Complex Negotiation & Deal Protection',
    initialQuestion:
      'A buyer demands a large discount that exceeds your authorized slab and threatens to walk away immediately. How do you protect the deal without making an unauthorized commitment?',
    followUpBranching: [
      {
        condition: 'deal protection',
        followUpQuestion: 'What alternative value additions or payment structuring would you offer instead of pure price cuts?',
      },
    ],
  },
  {
    id: 'SC_SNR_C_MULTIPLE_FAMILY_DECISION_MAKERS',
    category: 'SENIOR_SALES',
    minExp: 5,
    roleTargets: ['Senior Sales Executive', 'Team Lead', 'Manager'],
    competencyTested: 'Multi-Stakeholder Consensus Management',
    initialQuestion:
      'You are presenting a luxury apartment to a family where the buyer, spouse, and parents have conflicting layout and location preferences. How do you manage the discussion to build consensus?',
    followUpBranching: [
      {
        condition: 'consensus management',
        followUpQuestion: 'Whose concerns do you prioritize first, and how do you align the primary financial decision maker?',
      },
    ],
  },

  // 4. LUXURY & ULTRA-LUXURY SPECIALIZATION
  {
    id: 'SC_LUX_A_HNI_MARKET_CREDIBILITY',
    category: 'LUXURY_SALES',
    minExp: 3,
    roleTargets: ['Luxury Sales Consultant', 'Senior Sales Executive', 'Sales Manager'],
    competencyTested: 'Gurugram Luxury Market Authority & Micro-Market Analysis',
    initialQuestion:
      'You are meeting an ultra-HNI client who knows the Gurugram luxury market intimately and is actively comparing DLF, M3M, and Oberoi. How do you establish authority and trust in the first 10 minutes?',
    followUpBranching: [
      {
        condition: 'authority building',
        followUpQuestion: 'What specific comparative parameters—such as density, loading, construction quality, or rental yield—do you focus on?',
      },
    ],
  },
  {
    id: 'SC_LUX_B_UHNI_PRIVACY',
    category: 'LUXURY_SALES',
    minExp: 3,
    roleTargets: ['Luxury Sales Consultant', 'Senior Consultant'],
    competencyTested: 'UHNI Relationship Discretion & Communication Cadence',
    initialQuestion:
      'A high-profile UHNI client values utmost privacy and explicitly states they do not appreciate frequent phone calls or marketing broadcasts. How do you nurture this relationship effectively?',
    followUpBranching: [
      {
        condition: 'discrete communication',
        followUpQuestion: 'How do you keep them informed about exclusive off-market releases without being intrusive?',
      },
    ],
  },
  {
    id: 'SC_LUX_C_PREMIUM_JUSTIFICATION',
    category: 'LUXURY_SALES',
    minExp: 3,
    roleTargets: ['Luxury Sales Consultant', 'Senior Sales Executive'],
    competencyTested: 'Premium Pricing Justification & Architectural Value Selling',
    initialQuestion:
      'You are pitching an ultra-luxury residence priced at ₹25,000+ per sq ft. The buyer likes the specifications but questions why they should pay a 30% premium over adjacent developments. How do you explain the premium?',
    followUpBranching: [
      {
        condition: 'premium justification',
        followUpQuestion: 'What specific tangible factors—such as floor-to-ceiling height, low density per acre, or club amenities—would you highlight?',
      },
    ],
  },

  // 5. SALES MANAGER & TEAM LEADERSHIP (5–10 Years)
  {
    id: 'SC_MGR_A_TARGET_DEFICIT_1_WEEK',
    category: 'SALES_MANAGER',
    minExp: 5,
    roleTargets: ['Sales Manager', 'Team Lead', 'Senior Sales Manager', 'Associate Director'],
    competencyTested: 'Crisis Pipeline Recovery & Revenue Acceleration',
    initialQuestion:
      'Your sales team is running 30% behind monthly gross target with only seven days left in the month. What is your action plan starting tomorrow morning?',
    followUpBranching: [
      {
        condition: 'target recovery',
        followUpQuestion: 'How would you diagnose whether the root bottleneck is lead volume, poor site-visit conversion, or stalled closing negotiations?',
      },
    ],
  },
  {
    id: 'SC_MGR_B_HIGH_PERFORMER_POOR_DISCIPLINE',
    category: 'SALES_MANAGER',
    minExp: 5,
    roleTargets: ['Sales Manager', 'Team Lead'],
    competencyTested: 'High-Performer Governance & CRM Compliance',
    initialQuestion:
      'Your top sales producer delivers 40% of the team revenue but refuses to log leads in the CRM, ignores morning huddles, and creates friction with peers. How do you address this?',
    followUpBranching: [
      {
        condition: 'performer management',
        followUpQuestion: 'If they threaten to resign and take their pipeline with them when confronted, how do you protect the company\'s interests?',
      },
    ],
  },
  {
    id: 'SC_MGR_C_UNDERPERFORMER_COACHING',
    category: 'SALES_MANAGER',
    minExp: 5,
    roleTargets: ['Sales Manager', 'Team Lead'],
    competencyTested: 'Performance Improvement & Diagnostic Coaching',
    initialQuestion:
      'A sales consultant has missed target for three consecutive months despite having good energy. How do you diagnose and turn around their performance?',
    followUpBranching: [
      {
        condition: 'coaching diagnostic',
        followUpQuestion: 'How do you determine if the problem is lead qualification, phone presentation, or objection handling at the site visit stage?',
      },
    ],
  },
  {
    id: 'SC_MGR_D_LEAD_CONFLICT',
    category: 'SALES_MANAGER',
    minExp: 5,
    roleTargets: ['Sales Manager', 'Team Lead'],
    competencyTested: 'Conflict Resolution & Transparent Governance',
    initialQuestion:
      'Two senior property consultants in your team are fiercely disputing credit and commission for a ₹7 Cr luxury booking. How do you investigate and resolve this dispute?',
    followUpBranching: [
      {
        condition: 'dispute investigation',
        followUpQuestion: 'What CRM activity logs and client touchpoint records do you review before announcing your final verdict?',
      },
    ],
  },

  // 6. PRE-SALES SPECIALIZATION
  {
    id: 'SC_PRE_A_2MIN_QUALIFICATION',
    category: 'PRE_SALES',
    minExp: 0,
    roleTargets: ['Pre-Sales Executive', 'Tele-Sales Consultant', 'Lead Generation Specialist'],
    competencyTested: 'Rapid BANT/CHAMP Lead Qualification in Limited Time',
    initialQuestion:
      'You connect with a high-intent lead for a Golf Course Extension luxury project, but the client says, "I have exactly two minutes before boarding a flight." How do you qualify them efficiently?',
    followUpBranching: [
      {
        condition: 'rapid qualification',
        followUpQuestion: 'What are the top 3 critical data points you must capture before confirming a weekend site visit?',
      },
    ],
  },
  {
    id: 'SC_PRE_B_TECHNICAL_UNKNOWN',
    category: 'PRE_SALES',
    minExp: 0,
    roleTargets: ['Pre-Sales Executive', 'Tele-Sales Consultant'],
    competencyTested: 'Accuracy, Trust, & Escalation Discipline (No Guessing)',
    initialQuestion:
      'A prospect asks a highly technical query regarding RERA approval clauses, setback approvals, or load-bearing wall specifications that you are not sure about. How do you respond on the call?',
    followUpBranching: [
      {
        condition: 'escalation and verification',
        followUpQuestion: 'Why is it critical in luxury real estate never to guess technical or legal specifications over the phone?',
      },
    ],
  },

  // 7. BUSINESS DEVELOPMENT / BROKER NETWORKING (BDE)
  {
    id: 'SC_BDE_A_NEW_MICROMARKET_30DAYS',
    category: 'BDE',
    minExp: 2,
    roleTargets: ['Business Development Executive', 'BDE', 'Channel Partner Manager'],
    competencyTested: '30-Day Channel Activation & CP Sourcing',
    initialQuestion:
      'Suppose White Collar Realty assigns you to drive residential business in a new Gurugram micro-market where you have zero existing contacts. What is your roadmap for the first 30 days?',
    followUpBranching: [
      {
        condition: 'channel roadmap',
        followUpQuestion: 'How do you identify and shortlist tier-1 active channel partners versus dormant brokers?',
      },
    ],
  },
  {
    id: 'SC_BDE_B_CHANNEL_CONFLICT',
    category: 'BDE',
    minExp: 2,
    roleTargets: ['Business Development Executive', 'BDE', 'Channel Partner Manager'],
    competencyTested: 'Channel Harmony & Broker Sourcing Protection',
    initialQuestion:
      'A key channel partner claims a client walk-in belongs to their agency, while your direct sales team claims it was an organic direct walk-in. How do you resolve this without alienating the broker?',
    followUpBranching: [
      {
        condition: 'channel harmony',
        followUpQuestion: 'What documentation or digital lead registration protocol do you establish to prevent recurring disputes?',
      },
    ],
  },

  // 8. GURUGRAM & DUBAI MICRO-MARKET DEPTH
  {
    id: 'SC_MKT_GURUGRAM_COMPARISON',
    category: 'GURUGRAM_MICRO_MARKET',
    minExp: 2,
    roleTargets: ['Sales Executive', 'Senior Sales Executive', 'Sales Manager'],
    competencyTested: 'Golf Course Ext Rd vs New Gurugram Client Advisory',
    initialQuestion:
      'A luxury homebuyer with a ₹4.5 Cr budget is torn between an established address on Golf Course Extension Road versus an upcoming high-end project in New Gurugram / SPR. How do you help them evaluate the pros and cons?',
    followUpBranching: [
      {
        condition: 'market comparison',
        followUpQuestion: 'What key parameters—such as connectivity, infrastructure completion timeline, and social amenities—do you walk them through?',
      },
    ],
  },
  {
    id: 'SC_MKT_DUBAI_NRI_COMPARISON',
    category: 'DUBAI_MARKET',
    minExp: 2,
    roleTargets: ['Sales Executive', 'Senior Sales Executive', 'International Property Consultant'],
    competencyTested: 'Dubai Freehold vs Gurugram Luxury Investment Advisory',
    initialQuestion:
      'An NRI investor is evaluating whether to invest ₹5 Cr in Dubai off-plan (e.g., Dubai Hills / Downtown) or in a premium Gurugram residential high-rise. How do you structure that advisory conversation?',
    followUpBranching: [
      {
        condition: 'international comparison',
        followUpQuestion: 'How do you compare factors like rental yields, tax advantages, capital appreciation cycles, and repatriation rules?',
      },
    ],
  },
];

/**
 * Dynamically selects the most appropriate scenario based on candidate profile and history.
 */
export function selectNextScenario(
  candidateRole: string,
  experienceYears: number,
  claimedMarkets: string[],
  usedScenarioIds: string[]
): ScenarioDefinition | null {
  const unusedScenarios = SCENARIO_CATALOG.filter((s) => !usedScenarioIds.includes(s.id));
  if (unusedScenarios.length === 0) return null;

  const roleLower = (candidateRole || '').toLowerCase();

  // 1. Manager / Team Lead
  if (roleLower.includes('manager') || roleLower.includes('lead') || roleLower.includes('director')) {
    const mgr = unusedScenarios.find((s) => s.category === 'SALES_MANAGER');
    if (mgr) return mgr;
  }

  // 2. Pre-sales
  if (roleLower.includes('pre-sales') || roleLower.includes('tele')) {
    const pre = unusedScenarios.find((s) => s.category === 'PRE_SALES');
    if (pre) return pre;
  }

  // 3. BDE / Channel Partners
  if (roleLower.includes('bde') || roleLower.includes('business development') || roleLower.includes('channel')) {
    const bde = unusedScenarios.find((s) => s.category === 'BDE');
    if (bde) return bde;
  }

  // 4. Dubai claimed exposure
  if (claimedMarkets.some((m) => m.toLowerCase().includes('dubai'))) {
    const dubai = unusedScenarios.find((s) => s.category === 'DUBAI_MARKET');
    if (dubai) return dubai;
  }

  // 5. Gurugram micro-market scenario for experienced sales consultants
  if (experienceYears >= 3 && claimedMarkets.some((m) => m.toLowerCase().includes('gurgaon') || m.toLowerCase().includes('gurugram'))) {
    const mkt = unusedScenarios.find((s) => s.category === 'GURUGRAM_MICRO_MARKET');
    if (mkt) return mkt;
  }

  // 6. Luxury / Ultra-luxury for senior / luxury candidates
  if (experienceYears >= 4 || roleLower.includes('luxury') || roleLower.includes('senior')) {
    const lux = unusedScenarios.find((s) => s.category === 'LUXURY_SALES');
    if (lux) return lux;
    const snr = unusedScenarios.find((s) => s.category === 'SENIOR_SALES');
    if (snr) return snr;
  }

  // 7. Mid sales (2–5 years)
  if (experienceYears >= 2) {
    const mid = unusedScenarios.find((s) => s.category === 'MID_SALES');
    if (mid) return mid;
  }

  // 8. Early career fallback (0–2 years)
  const early = unusedScenarios.find((s) => s.category === 'EARLY_CAREER');
  if (early) return early;

  // Fallback to any unused scenario
  return unusedScenarios[0] || null;
}

