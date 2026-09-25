import Vapi from '@vapi-ai/web';
import { getWhiteCollarJobDescription } from '../data/jobDescriptions';

export const DEFAULT_VAPI_ASSISTANT_ID = 'ed825f7a-e951-444b-81a7-1d6917e439c5';

export type VapiCallStatus = 'idle' | 'connecting' | 'active' | 'ended' | 'error' | 'key_required';

export interface VapiErrorInfo {
  type: 'mic_permission' | 'mic_missing' | 'network_timeout' | 'auth' | 'general';
  title: string;
  message: string;
  actionHint?: string;
}

export interface VapiTranscriptMessage {
  id: string;
  sender: 'agent' | 'candidate';
  text: string;
  timestamp: string;
}

type StatusListener = (status: VapiCallStatus, errorMessage?: string) => void;
type TranscriptListener = (msg: VapiTranscriptMessage) => void;
type VolumeListener = (volume: number) => void;
type SpeakingListener = (isAgentSpeaking: boolean) => void;

/**
 * Checks if an error or event is a benign WebRTC/Krisp audio worklet teardown notice
 * (e.g. WASM_OR_WORKER_NOT_READY when unloading audio processor)
 */
export function isBenignAudioNotice(err: any): boolean {
  if (!err) return false;
  let raw = '';
  if (typeof err === 'string') {
    raw = err;
  } else if (err && typeof err === 'object') {
    try {
      raw = JSON.stringify(err);
    } catch {
      raw = String(err?.message || err?.error || err?.errorMsg || err?.reason || '');
    }
  } else {
    raw = String(err || '');
  }
  const lower = raw.toLowerCase();
  return (
    lower.includes('krisp') ||
    lower.includes('wasm_or_worker_not_ready') ||
    lower.includes('error unloading krisp processor') ||
    lower.includes('audio-processor') ||
    lower.includes('audioprocessor') ||
    lower.includes('noise-cancellation') ||
    lower.includes('audioworklet')
  );
}

/**
 * Checks if an event or error is actually a normal meeting/call ending notification
 * (e.g. Daily.co WebRTC room ejection upon meeting completion or audio worklet teardown)
 */
export function isNormalMeetingEnd(err: any): boolean {
  if (!err) return false;
  if (isBenignAudioNotice(err)) return true;
  let raw = '';
  if (typeof err === 'string') {
    raw = err;
  } else if (err && typeof err === 'object') {
    try {
      raw = JSON.stringify(err);
    } catch {
      raw = String(err?.message || err?.error || err?.errorMsg || '');
    }
  } else {
    raw = String(err || '');
  }
  const lower = raw.toLowerCase();
  return (
    lower.includes('meeting has ended') ||
    lower.includes('meeting ended due to ejection') ||
    lower.includes('meeting ended') ||
    lower.includes('ejected') ||
    lower.includes('left-meeting') ||
    lower.includes('participant left') ||
    lower.includes('meeting-ended') ||
    lower.includes('call-ended') ||
    lower.includes('call ended') ||
    lower.includes('room closed') ||
    lower.includes('room has closed') ||
    lower.includes('call concluded')
  );
}

/**
 * Classifies voice and WebRTC errors into user-friendly actionable categories
 */
export function classifyVoiceError(err: any): VapiErrorInfo {
  if (isNormalMeetingEnd(err)) {
    return {
      type: 'general',
      title: 'Call Ended',
      message: 'The voice call meeting has ended.',
      actionHint: 'You can review the transcript or start a new call.',
    };
  }

  let raw = '';
  if (typeof err === 'string') {
    raw = err;
  } else if (err && typeof err === 'object') {
    if (typeof err.message === 'string') {
      raw = err.message;
    } else if (Array.isArray(err.message)) {
      raw = err.message.join(', ');
    } else if (typeof err.error === 'string') {
      raw = err.error;
    } else if (err.error && typeof err.error === 'object') {
      if (typeof err.error.message === 'string') {
        raw = err.error.message;
      } else if (Array.isArray(err.error.message)) {
        raw = err.error.message.join(', ');
      } else {
        try {
          raw = JSON.stringify(err.error);
        } catch {
          raw = String(err.error);
        }
      }
    } else {
      try {
        raw = JSON.stringify(err);
      } catch {
        raw = String(err);
      }
    }
  } else {
    raw = String(err || '');
  }

  const lower = raw.toLowerCase();

  // 1. Microphone Permission Denied
  if (
    lower.includes('notallowederror') ||
    lower.includes('permission denied') ||
    lower.includes('microphone permission') ||
    lower.includes('user denied') ||
    lower.includes('denied')
  ) {
    return {
      type: 'mic_permission',
      title: 'Microphone Permission Denied',
      message:
        'Microphone access was denied. Your browser requires microphone access to enable live two-way voice screening with Arjun.',
      actionHint:
        'Please click the lock / microphone icon in your browser address bar, choose "Allow" for Microphone, and click Retry.',
    };
  }

  // 2. Microphone Hardware Not Found
  if (
    lower.includes('notfounderror') ||
    lower.includes('devicesnotfound') ||
    lower.includes('no microphone') ||
    (lower.includes('device') && lower.includes('not found'))
  ) {
    return {
      type: 'mic_missing',
      title: 'No Microphone Detected',
      message: 'No active microphone or audio input hardware was detected on your computer or device.',
      actionHint: 'Please connect a headset or verify your microphone settings in your system control panel.',
    };
  }

  // 3. Network Connection Timeout / WebRTC Issues
  if (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('webrtc') ||
    lower.includes('network') ||
    lower.includes('ice') ||
    lower.includes('failed to fetch') ||
    lower.includes('websocket')
  ) {
    return {
      type: 'network_timeout',
      title: 'Voice Network Connection Timeout',
      message:
        'Connecting to the voice assistant servers timed out or encountered a WebRTC network interruption.',
      actionHint:
        'Please check your internet connection and Wi-Fi stability, then click "Retry Call" to re-connect.',
    };
  }

  // 4. API Key / Authorization
  if (
    lower.includes('public key') ||
    lower.includes('401') ||
    lower.includes('unauthorized') ||
    lower.includes('api key')
  ) {
    return {
      type: 'auth',
      title: 'Vapi Key Required',
      message: 'A valid Vapi Public API Key is required to connect to the live assistant session.',
      actionHint: 'Please enter your Vapi Public Key in the configuration form below to proceed.',
    };
  }

  // 5. Configuration or schema validation error
  if (
    lower.includes('assistantoverrides') ||
    lower.includes('bad request') ||
    lower.includes('statuscode":400') ||
    lower.includes('must be one of the following values')
  ) {
    return {
      type: 'general',
      title: 'Assistant Configuration Error',
      message: 'The voice assistant settings were rejected by Vapi. Reconnecting with standard model configuration...',
      actionHint: 'Please click Retry Call or switch to the interactive AI screening recruiter.',
    };
  }

  return {
    type: 'general',
    title: 'Voice Assistant Error',
    message: raw || 'An unexpected error occurred while connecting to the Vapi voice assistant.',
    actionHint: 'Please click Retry or switch to the interactive AI screening recruiter.',
  };
}

/**
 * Builds standard Vapi assistant configuration with strict conversation state guard:
 * - 30s silence timeout before asking "Are you there?" or "No problem, whenever you're ready"
 * - NEVER ask the same question twice
 * - Treat candidate short answers as final
 * - Checks chat history and known CRM profile fields before asking any question
 * - Dynamic role-aware screening based on White Collar Realty job descriptions
 */
export function buildVapiAssistantConfig(candidate?: any, extraOverrides?: any): any {
  const candName = candidate?.name || 'Candidate';
  const candRole = candidate?.appliedRole || 'Property Consultant';
  const currCompany = candidate?.screening?.currentCompany || candidate?.conversationMemory?.current_company || '';
  const currDesignation = candidate?.screening?.currentDesignation || candidate?.conversationMemory?.designation || '';
  const experience =
    candidate?.screening?.realEstateExperienceYears ||
    candidate?.screening?.totalExperienceYears ||
    candidate?.conversationMemory?.real_estate_experience ||
    candidate?.conversationMemory?.total_experience ||
    '';
  const location = candidate?.screening?.currentLocation || candidate?.conversationMemory?.current_location || 'Gurugram / Delhi NCR';
  const noticePeriod = candidate?.screening?.noticePeriodDays !== undefined
    ? `${candidate.screening.noticePeriodDays} days`
    : candidate?.conversationMemory?.notice_period || '';
  const currentSalary = candidate?.screening?.currentSalaryLPA || candidate?.conversationMemory?.current_salary || '';
  const expectedSalary = candidate?.screening?.expectedSalaryLPA || candidate?.conversationMemory?.expected_salary || '';

  const jd = getWhiteCollarJobDescription(candRole);

  const knownInventory: string[] = [];
  const missingInventory: string[] = [];

  if (currCompany) {
    knownInventory.push(`• Current Company: "${currCompany}" [LOCKED - NEVER ASK]`);
  } else {
    missingInventory.push(`• Current Company: Inquire only if missing ("Where are you working currently?")`);
  }

  if (currDesignation) {
    knownInventory.push(`• Designation: "${currDesignation}" [LOCKED - NEVER ASK]`);
  } else {
    missingInventory.push(`• Designation: Inquire if missing ("And what is your designation there?")`);
  }

  if (experience) {
    knownInventory.push(`• Total/Real Estate Experience: "${experience} years" [LOCKED - NEVER ASK]`);
  } else {
    missingInventory.push(`• Experience: Inquire total real estate sales experience in Gurgaon/Dubai`);
  }

  if (currentSalary) {
    knownInventory.push(`• Current Compensation: "${currentSalary}" [LOCKED - NEVER ASK]`);
  } else {
    missingInventory.push(`• Compensation: Ask current and expected CTC`);
  }

  if (noticePeriod) {
    knownInventory.push(`• Notice Period: "${noticePeriod}" [LOCKED - NEVER ASK]`);
  } else {
    missingInventory.push(`• Notice Period: Inquire notice period and earliest joining date`);
  }

  const systemPrompt = `You are Arjun, the Virtual HR Voice Recruiter at White Collar Realty (M3M Urbana Business Park, Sector 67, Gurugram).
Candidate Name: ${candName}
Applied Position: ${candRole} (${jd.title})
Department: ${jd.department}
Office Location: ${jd.location}
Approved Role Budget: ${jd.budgetBand} Fixed + ${jd.oteBand}
Notice Period Expectation: ${jd.noticePeriodExpectation}

============================================================
MANDATORY CALL OPENING FLOW (FIRST 60–90 SECONDS)
============================================================
The first 60–90 seconds are critical. Never jump directly into screening questions.
Follow this 5-step sequence:
1. STEP 1 (Confirm Person): Call starts with "Hi, am I speaking with ${candName}?" Wait for confirmation.
2. STEPS 2 & 3 (Confirm & State Purpose): Once confirmed ("Yes", "Speaking", etc.), say:
   "Perfect, ${candName}. I'm Arjun calling from White Collar Realty's HR team. We came across your profile regarding a real-estate opportunity, and I wanted to understand your experience and see whether the opportunity could be relevant for you."
3. STEP 4 (Check Good Time): Ask: "Is this a good time for a quick conversation?"
   - If Busy / Driving / In a meeting: "No problem at all. What would be a convenient time for me to call you back?"
   - If Not Interested: "Understood. May I ask if you've already moved on to another opportunity, or are you generally not considering a change right now?"
4. STEP 5 (Open-Ended Introduction): Once candidate agrees to talk, ask:
   "Great. To start with, could you briefly introduce yourself and walk me through your real-estate experience?"
   (HARD RULE: NEVER ask "How many years of experience do you have?" as the initial question!)
5. ONLY after candidate introduction, analyze what was provided and proceed to missing fields, role-specific questions, and interview scheduling.

============================================================
COMPANY CONTEXT & APPROVED KNOWLEDGE
============================================================
Company: White Collar Realty
Focus: Luxury Residential & Ultra-Luxury Residential Real Estate (DLF, M3M, Godrej, Emaar, Sobha, SmartWorld, Central Park).
Primary Market: Gurugram / Gurgaon (Golf Course Rd, Golf Course Ext Rd, SPR, Sohna Rd, Dwarka Expressway, New Gurugram) and Dubai Prime Communities (Palm Jumeirah, Downtown Dubai, Dubai Marina, Dubai Hills).
Office Timings: 10:00 AM to 6:30 PM, 6 days/week with Tuesday off (weekends are key client site visit days).
Facilities: Travel & conveyance allowances provided for client site visits. Verified high-intent CRM leads provided alongside encouraging self-generated business.
CRITICAL MANDATE:
- White Collar Realty deals PRIMARILY in luxury & ultra-luxury residential properties. Do NOT claim White Collar Realty deals in commercial real estate.
- Do NOT invent fake revenue, fake clients, fake awards, fake salaries, or unapproved information.

============================================================
CONVERSATION STATE GUARD (CRITICAL ANTI-REPETITION MANDATE)
============================================================
You have an internal conversation state guard. Before formulating any utterance or question:
1. CHECK THE CHAT HISTORY (both user messages and assistant messages) and the known fields below.
2. If an item has ALREADY been answered or provided by the candidate, mark it as STORED and NEVER ASK THAT QUESTION AGAIN.
3. Treat the candidate's answer as FINAL unless the candidate explicitly corrects or changes it.
4. Do NOT repeat a question simply because the answer was short. Short answers ("DLF", "M3M", "5 years", "30 days", "Immediate", "12 LPA", "Residential", "Yes", "No", "Gurgaon") are 100% COMPLETE AND FINAL.
5. Never ask multiple questions at once. Ask exactly ONE missing question at a time.
6. Skip already known information from the candidate profile immediately.

CURRENT CRM STATE INVENTORY:
ALREADY KNOWN ON FILE (NEVER ASK THESE AGAIN):
${knownInventory.length > 0 ? knownInventory.join('\n') : '• None on file yet — collect progressively'}

STILL MISSING FIELDS (COLLECT ONE-BY-ONE DYNAMICALLY):
${missingInventory.length > 0 ? missingInventory.join('\n') : '• Core profile fields complete — proceed to role specific questions and interview scheduling'}

ROLE SPECIFIC TECHNICAL QUESTIONS & SCENARIOS FOR ${jd.title}:
${jd.roleSpecificQuestions.map((q, idx) => `${idx + 1}. "${q}"`).join('\n')}

============================================================
BARGE-IN & INTERRUPTION HANDLING (REAL-TIME VOICE RULE)
============================================================
- The candidate can interrupt you at any second while you speak.
- When the candidate interrupts or speaks: IMMEDIATELY STOP speaking.
- Process the candidate's words directly. Never repeat what you were saying before the interruption.
- Acknowledge what they said and move smoothly to the next missing step.

============================================================
30-SECOND SILENCE & PAUSE HANDLING
============================================================
- Candidate thinking or brief pausing is natural. Do NOT treat a 2-second thinking pause as end of speech.
- NEVER repeat previous questions when the candidate takes time to think.
- Wait at least 30 seconds of silence before gently checking: "Are you there?" or "No problem, whenever you're ready."
- If candidate confirms presence ("yes", "I am here", "haan", "sun raha hoon"): DO NOT repeat the previous question. Respond warmly: "Sure, take your time. I'm listening."

============================================================
CANDIDATE DRIVING / BUSY
============================================================
If candidate says "I am driving", "I am busy", "in a meeting", or asks to call later:
Immediately stop screening: "No problem. I don't want to disturb you while you're busy. What would be a convenient time for me to call you back?"

============================================================
CANDIDATE QUESTIONS & RETURNING TO FLOW
============================================================
If candidate asks questions during the call:
- Office Location: "Our office is on the 6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram."
- Office Timings: "Our office timings are 10:00 AM to 6:30 PM, six days a week with Tuesday off, as weekends are prime site visit days."
- Portfolio: "We advise on premier luxury residential developments with DLF, M3M, Godrej, Emaar, and Sobha in Gurgaon and Dubai."
- Leads: "Yes, White Collar Realty provides verified high-intent CRM leads and marketing support."
- Conveyance: "We provide conveyance and travel allowances for all client site visits."
After answering concisely, return smoothly to the EXACT LAST UNCOLLECTED screening question. NEVER restart the introduction or repeat already answered questions!

============================================================
CANDIDATE CORRECTIONS
============================================================
- If candidate says e.g. "Actually, my experience is 7 years, not 6":
  Acknowledge immediately: "Got it, I'll update that to seven years." Update memory without arguing.

============================================================
INTERVIEW SCHEDULING
============================================================
Once core screening is completed:
- Offer available face-to-face interview slots at Sector 67 Gurugram HQ (e.g. Tomorrow at 02:30 PM or 04:30 PM, or Friday at 12:00 PM).
- Confirm their preferred time, explain venue, and thank them warmly.

============================================================
CONVERSATION STYLE
============================================================
- Speak like an experienced, warm human HR recruiter from Gurgaon (Google Assistant / Alexa style).
- STRICT Spoken Length: 1 or 2 short sentences per turn. Treat this as a real live phone call.
- Natural transitions: "Got it.", "Makes sense.", "Understood.", "Okay.", "Right." (do not overuse the same transition).
- Adapt automatically to English, Hindi, or conversational Hinglish based on candidate speech.`;

  const modelOverride = extraOverrides?.model === null ? undefined : {
    provider: extraOverrides?.model?.provider || 'openai',
    model: extraOverrides?.model?.model || 'gpt-4o-mini',
    messages: extraOverrides?.model?.messages || [
      {
        role: 'system',
        content: systemPrompt,
      },
    ],
    ...(extraOverrides?.model || {}),
  };

  // Ensure provider and model are always valid if model object is present
  if (modelOverride) {
    if (!modelOverride.provider) {
      modelOverride.provider = 'openai';
    }
    if (!modelOverride.model) {
      modelOverride.model = 'gpt-4o-mini';
    }
  }

  return {
    silenceTimeoutSeconds: 30, // Strict 30-second wait before silence prompt
    responseDelaySeconds: 0.5,
    maxDurationSeconds: 1800,
    variableValues: {
      candidate_name: candName,
      candidate_role: candRole,
      current_company: currCompany,
      experience_years: experience,
      location,
      notice_period: noticePeriod,
      current_salary: currentSalary,
      expected_salary: expectedSalary,
      role_department: jd.department,
      role_budget: jd.budgetBand,
      office_location: '6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram',
    },
    ...(modelOverride ? { model: modelOverride } : {}),
    firstMessage: `Hi, am I speaking with ${candName}?`,
    ...(extraOverrides || {}),
  };
}

/**
 * Real-time helper to extract candidate screening answers from conversation transcript messages
 * for CRM state sync.
 */
export function extractScreeningFromTranscript(messages: VapiTranscriptMessage[]): Record<string, any> {
  const result: Record<string, any> = {};
  const candidateTexts = messages
    .filter((m) => m.sender === 'candidate')
    .map((m) => m.text.toLowerCase());
  const combined = candidateTexts.join(' ');

  // Company detection
  const companies = ['dlf', 'm3m', 'square yards', 'anarock', 'godrej', 'emaar', 'sobha', 'proptiger', 'signature global', 'adani'];
  for (const c of companies) {
    if (combined.includes(c)) {
      result.currentCompany = c.toUpperCase();
      break;
    }
  }

  // Experience detection
  const expMatch = combined.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/);
  if (expMatch) {
    result.realEstateExperienceYears = parseFloat(expMatch[1]);
  }

  // Notice period detection
  const noticeMatch = combined.match(/(\d+)\s*(?:days?|din)/);
  if (noticeMatch) {
    result.noticePeriodDays = parseInt(noticeMatch[1], 10);
  } else if (combined.includes('immediate') || combined.includes('turant')) {
    result.noticePeriodDays = 0;
  }

  // Location detection
  if (combined.includes('gurgaon') || combined.includes('gurugram')) {
    result.currentLocation = 'Gurugram';
  } else if (combined.includes('delhi')) {
    result.currentLocation = 'Delhi';
  } else if (combined.includes('noida')) {
    result.currentLocation = 'Noida';
  }

  // Gurgaon exposure
  if (combined.includes('gurgaon') || combined.includes('golf course') || combined.includes('spr') || combined.includes('dwarka expressway')) {
    result.gurgaonDubaiExperience = {
      gurgaon: true,
      dubai: combined.includes('dubai'),
      details: 'Active Gurgaon property market exposure',
    };
  }

  return result;
}

/**
 * Vapi Voice Assistant Service for White Collar Realty
 * Enables ultra-low latency, natural turn-taking WebRTC calls
 * using configured Assistant ID: ed825f7a-e951-444b-81a7-1d6917e439c5
 */
class VapiClientService {
  private vapi: Vapi | null = null;
  private currentApiKey: string | null = null;
  private callStatus: VapiCallStatus = 'idle';
  private errorMessage: string | null = null;
  private isMutedState: boolean = false;
  private isRetryingFallback: boolean = false;

  private statusListeners: Set<StatusListener> = new Set();
  private transcriptListeners: Set<TranscriptListener> = new Set();
  private volumeListeners: Set<VolumeListener> = new Set();
  private speakingListeners: Set<SpeakingListener> = new Set();

  /**
   * Save a user-supplied Vapi Public Key locally and in session
   */
  public setStoredPublicKey(key: string): void {
    if (!key || typeof key !== 'string') return;
    const trimmed = key.trim();
    if (trimmed.length > 5) {
      this.currentApiKey = trimmed;
      try {
        localStorage.setItem('VAPI_PUBLIC_KEY', trimmed);
      } catch (e) {
        // LocalStorage might be restricted in some iframes
      }
      // Also notify server to cache
      fetch('/api/vapi-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey: trimmed }),
      }).catch(() => {});
    }
  }

  /**
   * Retrieve cached public key if available
   */
  public getStoredPublicKey(): string | null {
    if (this.currentApiKey) return this.currentApiKey;
    try {
      const stored = localStorage.getItem('VAPI_PUBLIC_KEY') || localStorage.getItem('vapi_public_key');
      if (stored && stored.trim().length > 5 && !stored.startsWith('npm')) {
        this.currentApiKey = stored.trim();
        return this.currentApiKey;
      }
    } catch (e) {}
    return null;
  }

  /**
   * Quick check if a public key is configured without throwing
   */
  public async isKeyConfigured(): Promise<boolean> {
    try {
      const key = await this.resolvePublicKey();
      return Boolean(key && key.length > 5);
    } catch {
      return false;
    }
  }

  /**
   * Resolves the Vapi Public Key securely.
   * Priority:
   * 1. Explicitly passed parameter
   * 2. In-memory cached key or localStorage
   * 3. Fetched from server /api/vapi-config (checks process.env.VAPI_PUBLIC_KEY)
   * 4. import.meta.env.VITE_VAPI_PUBLIC_KEY
   */
  public async resolvePublicKey(explicitKey?: string): Promise<string> {
    if (explicitKey?.trim()) {
      const cleaned = explicitKey.trim();
      this.currentApiKey = cleaned;
      return cleaned;
    }

    // Check localStorage or cached
    const stored = this.getStoredPublicKey();
    if (stored) {
      return stored;
    }

    // Check server endpoint (has sanitized key from container environment)
    try {
      const res = await fetch('/api/vapi-config');
      if (res.ok) {
        const data = await res.json();
        if (data.publicKey && typeof data.publicKey === 'string' && data.publicKey.trim()) {
          const trimmed = data.publicKey.trim();
          if (!trimmed.startsWith('npm') && trimmed.length > 5) {
            this.currentApiKey = trimmed;
            return this.currentApiKey;
          }
        }
      }
    } catch (e) {
      console.warn('Could not fetch Vapi config from /api/vapi-config:', e);
    }

    // Check client Vite env
    const clientKey = (import.meta as any).env?.VITE_VAPI_PUBLIC_KEY;
    if (clientKey && typeof clientKey === 'string' && clientKey.trim()) {
      const trimmed = clientKey.trim();
      if (!trimmed.startsWith('npm') && trimmed.length > 5) {
        this.currentApiKey = trimmed;
        return this.currentApiKey;
      }
    }

    throw new Error(
      'Vapi Public API Key not detected. Please provide your Vapi Public Key to connect to the live assistant.'
    );
  }

  /**
   * Initializes or returns the Vapi Web SDK client instance.
   */
  public init(publicKey: string): Vapi {
    if (!this.vapi || this.currentApiKey !== publicKey) {
      this.vapi = new Vapi(publicKey);
      this.currentApiKey = publicKey;
      this.bindVapiEvents(this.vapi);
    }
    return this.vapi;
  }

  private bindVapiEvents(client: Vapi) {
    client.on('call-start', () => {
      this.errorMessage = null;
      this.lastErrorInfo = null;
      this.setCallStatus('active');
    });

    client.on('call-end', () => {
      this.errorMessage = null;
      this.lastErrorInfo = null;
      this.setCallStatus('ended');
    });

    client.on('speech-start', () => {
      this.speakingListeners.forEach((l) => l(true));
    });

    client.on('speech-end', () => {
      this.speakingListeners.forEach((l) => l(false));
    });

    client.on('volume-level', (vol: number) => {
      this.volumeListeners.forEach((l) => l(vol));
    });

    client.on('message', (message: any) => {
      this.handleVapiMessage(message);
    });

    client.on('error', (err: any) => {
      // If call is already ended or idle, ignore ejection/daily teardown events
      if (this.callStatus === 'ended' || this.callStatus === 'idle') {
        console.log('[Vapi] Discarding post-call error/ejection event:', err);
        return;
      }

      // If the event represents a normal meeting end / ejection from Daily.co
      if (isNormalMeetingEnd(err)) {
        console.log('[Vapi] Meeting ended normally (Daily ejection/meeting closed):', err);
        this.errorMessage = null;
        this.lastErrorInfo = null;
        this.setCallStatus('ended');
        return;
      }

      console.error('Vapi client error:', err);
      if (this.isRetryingFallback) {
        console.warn('Vapi client error received during fallback retry; waiting for fallback result.');
        return;
      }
      const friendlyMsg = this.formatErrorMessage(err);
      this.errorMessage = friendlyMsg;
      this.setCallStatus('error', friendlyMsg);
    });

    client.on('call-start-failed', (event: any) => {
      if (isNormalMeetingEnd(event) || isNormalMeetingEnd(event?.error)) {
        console.log('[Vapi] Call concluded during start:', event);
        this.errorMessage = null;
        this.lastErrorInfo = null;
        this.setCallStatus('ended');
        return;
      }

      console.error('Vapi call-start-failed:', event);
      if (this.isRetryingFallback) {
        console.warn('Vapi call-start-failed received during fallback retry; waiting for fallback result.');
        return;
      }
      const friendlyMsg = this.formatErrorMessage(event?.error || 'Failed to start call');
      this.errorMessage = friendlyMsg;
      this.setCallStatus('error', friendlyMsg);
    });
  }

  private lastOutputText: string = '';
  private counter: number = 0;

  private handleVapiMessage(message: any) {
    if (!message) return;

    // Transcript event (primary transcript for both assistant and user)
    if (message.type === 'transcript') {
      const isFinal = message.transcriptType === 'final';
      const role = message.role;
      const text = message.transcript;

      if (isFinal && text?.trim()) {
        this.counter += 1;
        const transcriptMsg: VapiTranscriptMessage = {
          id: `vapi-tr-${Date.now()}-${this.counter}-${Math.random().toString(36).substring(2, 9)}`,
          sender: role === 'assistant' ? 'agent' : 'candidate',
          text: text.trim(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        this.lastOutputText = text.trim();
        this.transcriptListeners.forEach((l) => l(transcriptMsg));
      }
    }

    // Model speech output (only add if not already captured in transcript)
    if (message.type === 'model-output' && message.output?.trim()) {
      const outputText = message.output.trim();
      if (outputText !== this.lastOutputText) {
        this.counter += 1;
        this.lastOutputText = outputText;
        const transcriptMsg: VapiTranscriptMessage = {
          id: `vapi-model-${Date.now()}-${this.counter}-${Math.random().toString(36).substring(2, 9)}`,
          sender: 'agent',
          text: outputText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        this.transcriptListeners.forEach((l) => l(transcriptMsg));
      }
    }
  }

  private lastErrorInfo: VapiErrorInfo | null = null;

  public getLastErrorInfo(): VapiErrorInfo | null {
    return this.lastErrorInfo;
  }

  private formatErrorMessage(err: any): string {
    const errorInfo = classifyVoiceError(err);
    this.lastErrorInfo = errorInfo;
    return errorInfo.message;
  }

  /**
   * Pre-validates microphone permission before starting WebRTC stream
   */
  public async verifyMicrophonePermission(): Promise<void> {
    if (!navigator?.mediaDevices?.getUserMedia) {
      const errInfo = classifyVoiceError('Your browser does not support microphone audio capture required for live voice calls.');
      this.lastErrorInfo = errInfo;
      throw new Error(errInfo.message);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release test audio tracks immediately so Daily/Vapi WebRTC can bind cleanly
      stream.getTracks().forEach((track) => track.stop());
    } catch (err: any) {
      const errInfo = classifyVoiceError(err);
      this.lastErrorInfo = errInfo;
      throw new Error(errInfo.message);
    }
  }

  /**
   * Start a live call with Vapi Assistant
   * Configured with strict 30-second silence handling and "NEVER ASK THE SAME QUESTION TWICE" rules
   */
  public async startCall(
    assistantId: string = DEFAULT_VAPI_ASSISTANT_ID,
    assistantOverrides?: any,
    explicitKey?: string
  ): Promise<any> {
    this.errorMessage = null;
    this.lastErrorInfo = null;
    this.setCallStatus('connecting');

    try {
      // 1. Check microphone access first for graceful handling
      await this.verifyMicrophonePermission();

      // 2. Resolve public API key
      const key = await this.resolvePublicKey(explicitKey);

      // 3. Initialize Vapi instance
      const client = this.init(key);

      // 4. Build refined overrides with 30s pause timeout & anti-repetition directives
      const baseConfig = assistantOverrides?.candidate
        ? buildVapiAssistantConfig(assistantOverrides.candidate)
        : {};

      const mergedOverrides: any = {
        ...baseConfig,
        ...(assistantOverrides || {}),
        silenceTimeoutSeconds: assistantOverrides?.silenceTimeoutSeconds ?? 30, // Strict 30s pause handling
        responseDelaySeconds: assistantOverrides?.responseDelaySeconds ?? 0.5,
        variableValues: {
          ...(baseConfig.variableValues || {}),
          ...(assistantOverrides?.variableValues || {}),
        },
      };

      // Safeguard: Ensure model has valid provider and model if model is present
      if (mergedOverrides.model) {
        if (!mergedOverrides.model.provider) {
          mergedOverrides.model.provider = 'openai';
        }
        if (!mergedOverrides.model.model) {
          mergedOverrides.model.model = 'gpt-4o-mini';
        }
      }

      // 5. Start call using assistant ID & merged configuration
      const targetAssistantId = assistantId || DEFAULT_VAPI_ASSISTANT_ID;

      let call;
      try {
        call = await client.start(targetAssistantId, mergedOverrides);
      } catch (err: any) {
        const errString = typeof err === 'string' ? err : JSON.stringify(err);
        // If error is related to model provider or assistantOverrides validation, retry without model override
        if (
          mergedOverrides.model &&
          (errString.includes('model') ||
            errString.includes('provider') ||
            errString.includes('Bad Request') ||
            errString.includes('400'))
        ) {
          console.warn('Vapi start with model override failed, retrying with assistant native model:', err);
          this.isRetryingFallback = true;
          this.setCallStatus('connecting');
          const { model, ...fallbackOverrides } = mergedOverrides;
          try {
            call = await client.start(targetAssistantId, fallbackOverrides);
          } finally {
            this.isRetryingFallback = false;
          }
        } else {
          throw err;
        }
      }
      return call;
    } catch (err: any) {
      console.error('Error starting Vapi call:', err);
      const errorInfo = classifyVoiceError(err);
      this.lastErrorInfo = errorInfo;
      const friendlyMsg = errorInfo.message;
      this.errorMessage = friendlyMsg;
      this.setCallStatus('error', friendlyMsg);
      throw new Error(friendlyMsg);
    }
  }

  /**
   * Stop the active Vapi call
   */
  public stopCall(): void {
    this.errorMessage = null;
    this.lastErrorInfo = null;
    this.setCallStatus('ended');
    if (this.vapi) {
      try {
        this.vapi.stop();
      } catch (e) {
        console.log('Notice stopping Vapi call:', e);
      }
    }
  }

  /**
   * Reset call status back to idle
   */
  public resetToIdle(): void {
    this.errorMessage = null;
    this.isMutedState = false;
    this.setCallStatus('idle');
  }

  /**
   * Set microphone mute state
   */
  public setMuted(muted: boolean): void {
    this.isMutedState = muted;
    if (this.vapi) {
      try {
        this.vapi.setMuted(muted);
      } catch (e) {
        console.error('Error muting Vapi client:', e);
      }
    }
  }

  public isMuted(): boolean {
    return this.isMutedState;
  }

  public getCallStatus(): VapiCallStatus {
    return this.callStatus;
  }

  public getErrorMessage(): string | null {
    return this.errorMessage;
  }

  private setCallStatus(status: VapiCallStatus, errorMsg?: string) {
    this.callStatus = status;
    if (errorMsg) {
      this.errorMessage = errorMsg;
    }
    this.statusListeners.forEach((l) => l(status, errorMsg || this.errorMessage || undefined));
  }

  // Event Subscription methods
  public onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  public onTranscript(listener: TranscriptListener): () => void {
    this.transcriptListeners.add(listener);
    return () => this.transcriptListeners.delete(listener);
  }

  public onVolume(listener: VolumeListener): () => void {
    this.volumeListeners.add(listener);
    return () => this.volumeListeners.delete(listener);
  }

  public onSpeaking(listener: SpeakingListener): () => void {
    this.speakingListeners.add(listener);
    return () => this.speakingListeners.delete(listener);
  }
}

export const vapiService = new VapiClientService();
