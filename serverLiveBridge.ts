import { GoogleGenAI, Modality, Type } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { aiHrBrain } from './server/ai/hrBrain';

interface LiveSessionInitData {
  candidate: any;
  scenario: string;
  availableSlots: any[];
  languagePreference?: string;
}

const LIVE_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'updateCandidateScreening',
        description: "Extract and update candidate's screening information in real time as they mention it during the call.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            currentCompany: { type: Type.STRING, description: 'Current or previous employer company name' },
            currentDesignation: { type: Type.STRING, description: 'Current job title or designation' },
            totalExperienceYears: { type: Type.NUMBER, description: 'Total years of work experience' },
            realEstateExperienceYears: { type: Type.NUMBER, description: 'Years of real estate sales experience' },
            hasGurgaonExperience: { type: Type.BOOLEAN, description: 'Whether they have experience in Gurgaon / NCR market' },
            hasDubaiExperience: { type: Type.BOOLEAN, description: 'Whether they have experience in Dubai market' },
            gurgaonDubaiDetails: { type: Type.STRING, description: 'Details about projects, developers, or locations they handled' },
            currentSalaryLPA: { type: Type.STRING, description: 'Current fixed CTC in LPA (e.g. 8 LPA, 12 LPA)' },
            expectedSalaryLPA: { type: Type.STRING, description: 'Expected fixed CTC in LPA (e.g. 12 LPA, 15 LPA)' },
            noticePeriodDays: { type: Type.NUMBER, description: 'Notice period in days (0 for immediate joiner)' },
            currentLocation: { type: Type.STRING, description: 'Current residential location in Delhi NCR (e.g. Gurgaon Sector 56)' },
            earliestJoiningDate: { type: Type.STRING, description: 'Earliest joining date or timeline' },
            candidateNotes: { type: Type.STRING, description: 'Key summary points or recruiter notes' },
          },
        },
      },
      {
        name: 'scheduleFaceToFaceInterview',
        description: 'Confirm a face-to-face interview slot at White Collar Realty Gurugram corporate headquarters (Sector 67).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            selectedSlotId: { type: Type.STRING, description: 'Selected slot ID if candidate chose one' },
            interviewDate: { type: Type.STRING, description: 'Interview date (e.g. Tomorrow, or YYYY-MM-DD)' },
            interviewTime: { type: Type.STRING, description: 'Interview time (e.g. 11:00 AM, 2:30 PM, 4:30 PM)' },
            venueConfirmed: { type: Type.BOOLEAN, description: 'Confirmed candidate can visit Sector 67 Gurgaon office' },
          },
          required: ['interviewTime'],
        },
      },
      {
        name: 'recordCallDisposition',
        description: 'Record the call outcome if candidate requested callback, declined, or finished screening.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            outcome: {
              type: Type.STRING,
              description: 'Call outcome: SCREENING_COMPLETED, INTERVIEW_SCHEDULED, CALL_BACK_REQUESTED, NOT_INTERESTED, ATTENDANCE_CONFIRMED, REJECTED',
            },
            callbackTime: { type: Type.STRING, description: 'When to call back (e.g. 5:00 PM today, tomorrow morning)' },
            declineReason: { type: Type.STRING, description: 'Reason for decline if not interested' },
          },
          required: ['outcome'],
        },
      },
    ],
  },
];

function buildLiveSystemInstruction(
  candidate: any,
  scenario: string,
  availableSlots: any[],
  languagePreference?: string
): string {
  const name = candidate?.name || 'Candidate';
  const role = candidate?.appliedRole || 'Sales Executive (Luxury Residential)';
  const phone = candidate?.phone || '';

  // Retrieve Central AI HR Brain Next Call Brief and Persistent Memory
  const brief = aiHrBrain.getNextCallBrief(candidate, []);
  const verifiedFactsStr = brief.verifiedInformationSummary.length > 0
    ? brief.verifiedInformationSummary.map(f => `  • ${f}`).join('\n')
    : '  • None yet (first screening)';
  const forbiddenQuestionsStr = brief.forbiddenRepeatQuestions.length > 0
    ? brief.forbiddenRepeatQuestions.map(q => `  ⛔ DO NOT ASK: "${q}" (Already verified in memory)`).join('\n')
    : '  • Standard initial screening';
  const unresolvedTopicsStr = brief.unresolvedTopics.length > 0
    ? brief.unresolvedTopics.map(u => `  👉 ${u}`).join('\n')
    : '  • Complete profile verified';

  let slotsText = 'No specific slots listed; ask candidate for their preferred day and morning or afternoon.';
  if (availableSlots && availableSlots.length > 0) {
    slotsText = availableSlots
      .filter((s: any) => s.status === 'Available' || s.isAvailable)
      .map((s: any) => `- Slot ID "${s.id}": ${s.displayLabel} (${s.date} at ${s.time})`)
      .join('\n');
  }

  return `
# WHITE COLLAR REALTY — AUTONOMOUS REAL ESTATE HR INTERVIEW + SCENARIO ENGINE
# POWERED BY CENTRAL AI HR BRAIN (PERSISTENT MEMORY & LEARNING)

You are the White Collar Realty Virtual HR Assistant.
Your name is Arjun.
You are an experienced human-like HR recruiter conducting an intelligent outbound screening conversation with real-estate candidates.

You are NOT a questionnaire reader.
You are NOT a scripted IVR.
You must conduct a natural two-way HR conversation.

Candidate In Call: ${name}
Role Applied For: ${role}
Candidate Phone: ${phone}

==================================================
CENTRAL HR BRAIN — CANDIDATE PERSISTENT MEMORY
==================================================
Already Verified in Memory (DO NOT RE-VERIFY FROM SCRATCH):
${verifiedFactsStr}

ZERO-REPETITION MANDATE (RULE 9):
${forbiddenQuestionsStr}

Unresolved Information to Discover in this Call:
${unresolvedTopicsStr}

Recommended Starting Focus: ${brief.recommendedStartingTopic}
${brief.contradictionsRequiringClarification.length > 0 ? `Pending Contradictions to Gently Clarify:\n` + brief.contradictionsRequiringClarification.map(c => `  ⚠️ ${c.clarificationPrompt}`).join('\n') : ''}


==================================================
1. MANDATORY CALL OPENING FLOW (FIRST 60–90 SECONDS)
==================================================
The first 60–90 seconds of the call are extremely important.
You must NOT jump directly into screening questions.
Follow this EXACT 5-Step Opening Sequence:

STEP 1 — CONFIRM THE PERSON:
Start naturally: "Hi, am I speaking with ${name}?"
Wait for the candidate's confirmation ("Yes", "Yes, speaking", "Who is this?", "Yes, this is ${name}", "Speaking").
Do NOT proceed until you have reasonable confirmation that you are speaking with the intended candidate.

STEP 2 & 3 — CONFIRM AVAILABLE & EXPLAIN WHY YOU ARE CALLING:
After the candidate confirms, do NOT immediately ask "Tell me about yourself".
First explain why you are calling clearly and briefly:
"Perfect, ${name}. I'm Arjun calling from White Collar Realty's HR team. We came across your profile regarding a real-estate opportunity, and I wanted to understand your experience and see whether the opportunity could be relevant for you."

STEP 4 — CHECK WHETHER IT IS A GOOD TIME:
Ask: "Is this a good time for a quick conversation?"
- If Candidate says YES ("Yes", "Sure", "Haan", "Go ahead", "Yes, please"): Continue to Step 5.
- If Candidate says BUSY / DRIVING / IN A MEETING:
  "No problem at all. What would be a convenient time for me to call you back?"
  Call tool "recordCallDisposition" with outcome "CALL_BACK_REQUESTED".
- If Candidate says NOT INTERESTED / NOT LOOKING:
  "Understood. May I ask if you've already moved on to another opportunity, or are you generally not considering a change right now?"
  If they confirm refusal, politely close and record disposition.

STEP 5 — CANDIDATE INTRODUCTION (OPEN-ENDED):
ONLY after identity is confirmed, purpose explained, and candidate agrees to talk:
Ask for their career walkthrough using ONE of:
- "Perfect. To start with, could you briefly introduce yourself and walk me through your real-estate experience?"
- "Great. Before I get into the role details, I'd like to understand your background. Could you tell me a little about yourself and your experience in real estate?"
- "Sure, let's start with your background. Could you briefly walk me through your career so far, particularly your real-estate experience?"
HARD RULE: NEVER ask "How many years of experience do you have?" as the initial question!

==================================================
2. CALL OPENING SPECIAL CASES & INQUIRIES
==================================================
- "Why are you calling?" → "I'm Arjun calling from White Collar Realty's HR team regarding a potential real-estate opportunity in luxury residential sales."
- "Which company?" → "White Collar Realty. We're a real-estate company focused on luxury and ultra-luxury residential properties."
- "Which role?" → "The opportunity is for a ${role} position with our luxury residential advisory team."
- "I didn't apply" → "Understood. Your profile was identified as potentially relevant for a real-estate opportunity. If you're open to exploring opportunities, I can briefly explain what we're hiring for."
- "Tell me about the job first" → "Sure. The role is focused on luxury residential sales, with responsibilities around client handling, lead conversion, site visits and closing. If you're comfortable with that, could you briefly walk me through your current experience?"
- Someone else answers → "Hi, this is Arjun calling from White Collar Realty. May I speak with ${name}?" (Never disclose candidate-confidential screening details to third parties).

==================================================
3. CANDIDATE INTRODUCTION ANALYSIS & ZERO DUPLICATE RULE
==================================================
Extract and save candidate details while they introduce themselves:
- Company, designation, total experience, Gurugram/Dubai experience, residential/commercial, luxury exposure, ticket sizes, sales closures, CTC, notice period.
- If candidate voluntarily provided information during introduction, mark it ALREADY ANSWERED and never ask it again!
- Maintain ONE active question at a time.
- Use natural recruiter transitions ("Got it.", "That gives me a clear picture.", "Interesting...", "Since you mentioned handling Gurgaon...").

==================================================
4. COMPANY CONTEXT & APPROVED KNOWLEDGE
==================================================
Company: White Collar Realty
Focus: Luxury Residential & Ultra-Luxury Residential Real Estate (DLF, M3M, Godrej, Emaar, Sobha, SmartWorld, Central Park).
Corporate Office: 6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram, Haryana 122101.
Primary Market: Gurugram (Golf Course Rd, Golf Course Ext Rd, SPR, Sohna Rd, Dwarka Expressway, New Gurugram) and Dubai Prime Communities (Palm Jumeirah, Downtown Dubai, Dubai Marina, Dubai Hills).
Office Timings: 10:00 AM to 6:30 PM, 6 days/week with Tuesday off (weekends are key client site visit days).
Facilities: Travel & conveyance allowances provided for client site visits. Verified high-intent CRM leads provided alongside encouraging self-generated business.
CRITICAL MANDATE:
- White Collar Realty deals PRIMARILY in luxury & ultra-luxury residential properties. Do NOT claim White Collar Realty deals in commercial real estate.
- Do NOT invent fake revenue, fake clients, fake awards, fake salaries, or unapproved information.

==================================================
2. QUESTION STATE & ZERO-DUPLICATE QUESTION ENGINE
==================================================
CRITICAL DIRECTIVE: The agent must NEVER ask the same question twice, especially while candidate is still answering.

1. ACTIVE QUESTION LOCK:
- At every moment maintain exactly ONE active question.
- Until candidate clearly finishes answering:
  * DO NOT generate another question.
  * DO NOT interrupt with another screening question.
  * DO NOT repeat the same or rephrased question.
  * DO NOT move to next question prematurely.
  * Wait patiently for the candidate's complete answer.

2. QUESTION LIFECYCLE:
QUESTION_GENERATED → QUESTION_SPOKEN → WAIT_FOR_ANSWER → ANSWER_RECEIVED → ANSWER_ANALYZED → QUESTION_CLOSED → NEXT_QUESTION_SELECTED.
Never skip WAIT_FOR_ANSWER.

3. SEMANTIC DUPLICATE DETECTION:
Treat equivalent phrasings as the SAME question topic (e.g. "How many years of experience?", "How long have you been working in real estate?", "Tell me about your total real estate sales experience"). Once answered, DO NOT ask another version.

4. VALID FOLLOW-UP VS. DUPLICATE:
A follow-up is allowed ONLY when it adds genuinely NEW information (e.g. "Out of those six years, how much has been in Gurugram?"). Asking general experience again is a forbidden duplicate.

5. CONTRADICTION HANDLING:
If candidate gives conflicting figures (e.g. 6 years earlier vs 8 years now), ask: "Earlier you mentioned six years, and now I heard eight years. Could you clarify which figure is correct?"

6. 7-CHECK GENERATION GATE:
Verify previous question is closed, candidate finished speaking, question not already asked, not semantically equivalent, not provided voluntarily, collects genuinely new info, and matches role JD before asking.


==================================================
3. SPOKEN VOICE RULES (GOOGLE ASSISTANT / EXPERIENCED RECRUITER STYLE)
==================================================
- Spoken Length: 1 or 2 concise conversational sentences max per turn.
- Natural Acknowledgements: "Got it.", "Okay, that helps.", "Right.", "Understood.", "That gives me a better picture.", "Just to clarify..."
- Language Versatility: Speak English, Hindi, or natural Hinglish. Automatically adapt to what the candidate speaks.
- Candidate Interruption: STOP speaking immediately when candidate speaks. Process what they said without restarting.
- 30s Silence Handling: Allow candidate space to think. Never repeat previous questions when candidate pauses. If candidate says "Haan", "Yes", "I'm here", say "Sure, please take your time, I'm listening."

==================================================
4. CANDIDATE DRIVING / BUSY
==================================================
If candidate says "I am driving", "I am busy", "in a meeting", "call later":
Immediately stop screening. Say: "No problem. I don't want to disturb you while you're busy. What would be a convenient time for me to call you back?"
Call tool "recordCallDisposition" with outcome "CALL_BACK_REQUESTED".

==================================================
5. CANDIDATE QUESTIONS FIRST
==================================================
If candidate asks a question (location, timings, portfolio, process):
Pause screening, answer concisely with approved knowledge, then return naturally to the last uncollected point.

==================================================
6. ROLE-SPECIFIC DEEP VALIDATION & SCENARIOS
==================================================
- Luxury Residential Validation: Never accept vague "I do luxury". Validate exact projects, ticket sizes (₹4–8 Cr, ₹10+ Cr), buyer profiles (HNI/UHNI/NRI), personal closures vs team closures.
- Manager / Team Leader Validation: If candidate claims "My team closed ₹25 Cr", ask: "Out of that ₹25 Cr, approximately how much came from your own direct closures versus deals where you stepped in at negotiation?" Walk through 1 of last 5 major closures.
- Pre-Sales: Validate daily call volume (60-100), qualification criteria, site visit generation.
- BDE: Validate self-generated vs company lead split, active CP network.
- Scenarios: Test realistic sales situations (e.g. HNI comparing ₹7 Cr unit stuck on price - test value demonstration vs immediate discount).

==================================================
7. COMPENSATION, NOTICE & F2F INTERVIEW
==================================================
- Compensation: Capture exact current CTC/in-hand, expected CTC, and notice period (record if negotiable).
- F2F Interview: Invite eligible candidates to our corporate office: 6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram.
Available slots:
${slotsText}

Call "updateCandidateScreening" in real-time as information is extracted, and "scheduleFaceToFaceInterview" when a slot is agreed upon.
`;
}

export function setupGeminiLiveWebSocket(server: http.Server, app?: any) {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('error', (err) => {
    console.error('[Gemini Live WS Server] WebSocketServer error:', err);
  });

  server.on('upgrade', (request, socket, head) => {
    let pathname = '';
    try {
      const parsedUrl = new URL(request.url || '', 'http://127.0.0.1');
      pathname = parsedUrl.pathname;
    } catch {
      pathname = request.url || '';
    }

    if (
      pathname === '/api/live-stream' ||
      pathname === '/api/live-stream/' ||
      pathname.startsWith('/api/live-stream?')
    ) {
      console.log(`[Gemini Live WS] Upgrading request for ${request.url} from ${request.socket.remoteAddress}`);
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  // Map of active HTTP-based streaming sessions
  const httpSessions = new Map<
    string,
    {
      session: any;
      isReady: boolean;
      sseClients: Set<any>;
      cleanup: () => void;
    }
  >();

  // Helper to initialize a Gemini Live session with the given sendCallback
  async function createLiveSession(
    sessionId: string,
    initData: LiveSessionInitData,
    sendMsg: (msg: any) => void
  ) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const errText = 'GEMINI_API_KEY is not configured in server environment.';
      console.error(`[Gemini Live] ${errText}`);
      sendMsg({
        type: 'error',
        sessionId,
        message: errText,
      });
      return null;
    }

    const { candidate, scenario, availableSlots, languagePreference } = initData;
    const systemInstruction = buildLiveSystemInstruction(candidate, scenario, availableSlots, languagePreference);

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    console.log(`[Gemini Live] Connecting to model gemini-3.8-live for session ${sessionId} (${candidate?.name || 'candidate'})...`);

    let isSessionReady = false;

    try {
      const session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Puck', // Natural, warm conversational voice
              },
            },
          },
          systemInstruction,
          tools: LIVE_TOOLS,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log(`[Gemini Live] Live session connected successfully (${sessionId})`);
          },
          onmessage: async (serverMsg: any) => {
            if (!isSessionReady || !session) return;

            // 1. Check for audio chunks from model
            const parts = serverMsg.serverContent?.modelTurn?.parts || [];
            for (const part of parts) {
              if (part.inlineData?.data) {
                sendMsg({
                  type: 'audio',
                  sessionId,
                  audio: part.inlineData.data,
                });
              }
              if (part.text) {
                sendMsg({
                  type: 'agent_transcript',
                  sessionId,
                  text: part.text,
                });
              }
            }

            // 2. Output audio transcription (streaming text of what Arjun says)
            if (serverMsg.serverContent?.outputTranscription?.text) {
              sendMsg({
                type: 'agent_transcript',
                sessionId,
                text: serverMsg.serverContent.outputTranscription.text,
              });
            }

            // 3. Input audio transcription (what candidate said)
            if (serverMsg.serverContent?.inputTranscription?.text) {
              sendMsg({
                type: 'user_transcript',
                sessionId,
                text: serverMsg.serverContent.inputTranscription.text,
                isFinal: true,
              });
            } else if (serverMsg.serverContent?.interimInputTranscription?.text) {
              sendMsg({
                type: 'user_transcript',
                sessionId,
                text: serverMsg.serverContent.interimInputTranscription.text,
                isFinal: false,
              });
            }

            // 4. Interruption signal (candidate barged in!)
            if (serverMsg.serverContent?.interrupted) {
              console.log(`[Gemini Live] Interruption received from model for ${sessionId}`);
              sendMsg({
                type: 'interrupted',
                sessionId,
              });
            }

            // 5. Turn completion
            if (serverMsg.serverContent?.turnComplete) {
              sendMsg({
                type: 'turn_complete',
                sessionId,
              });
            }

            // 6. Tool / Function Calls
            if (serverMsg.toolCall?.functionCalls && serverMsg.toolCall.functionCalls.length > 0) {
              const functionResponses = [];
              for (const fc of serverMsg.toolCall.functionCalls) {
                console.log(`[Gemini Live] Tool called: ${fc.name} in session ${sessionId}`, fc.args);
                sendMsg({
                  type: 'tool_call',
                  sessionId,
                  name: fc.name,
                  args: fc.args,
                });

                functionResponses.push({
                  id: fc.id,
                  name: fc.name,
                  response: { output: { success: true, message: `Updated ${fc.name}` } },
                });
              }

              try {
                if (session && isSessionReady) {
                  await session.sendToolResponse({ functionResponses });
                }
              } catch (toolErr) {
                console.error(`[Gemini Live] Error sending tool response for ${sessionId}:`, toolErr);
              }
            }
          },
          onerror: (err: any) => {
            console.error(`[Gemini Live] Live session error (${sessionId}):`, err);
            sendMsg({
              type: 'error',
              sessionId,
              message: err?.message || 'Error occurred in Gemini Live voice session.',
            });
          },
          onclose: () => {
            console.log(`[Gemini Live] Live session closed (${sessionId})`);
            isSessionReady = false;
            sendMsg({
              type: 'session_closed',
              sessionId,
            });
          },
        },
      });

      isSessionReady = true;

      sendMsg({
        type: 'ready',
        sessionId,
      });

      // Start call with spoken greeting from Arjun
      let greetingPrompt = `The phone call has connected with ${candidate?.name || 'the candidate'}. Start the call now with your brief greeting and check if you are speaking with ${candidate?.name || 'them'}.`;
      if (scenario === 'callback_followup') {
        greetingPrompt = `The phone call has connected with ${candidate?.name || 'the candidate'}. Greet them, say you are Arjun from White Collar Realty following up on the callback they requested, and ask if now is a good time to talk for 2 minutes.`;
      }

      try {
        if (session && isSessionReady) {
          session.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: greetingPrompt }] }],
            turnComplete: true,
          });
        }
      } catch (promptErr) {
        console.error(`[Gemini Live] Error sending initial greeting prompt (${sessionId}):`, promptErr);
      }

      return { session, isReady: () => isSessionReady };
    } catch (liveErr: any) {
      console.error(`[Gemini Live] Failed to connect to Gemini Live (${sessionId}):`, liveErr);
      sendMsg({
        type: 'error',
        sessionId,
        message: liveErr?.message || 'Failed to initialize Gemini Live session.',
      });
      return null;
    }
  }

  wss.on('connection', (clientWs: WebSocket, req: http.IncomingMessage) => {
    console.log('[Gemini Live WS] Client connected to live audio stream');

    let session: any = null;
    let isSessionReady = false;
    let currentSessionId: string = '';

    const cleanupSession = () => {
      isSessionReady = false;
      if (session) {
        try {
          session.close();
        } catch (e) {
          // ignore
        }
        session = null;
      }
      currentSessionId = '';
    };

    clientWs.on('message', async (raw: Buffer | string) => {
      try {
        const messageStr = typeof raw === 'string' ? raw : raw.toString('utf8');
        const data = JSON.parse(messageStr);

        if (data.type === 'init') {
          cleanupSession();
          currentSessionId = data.sessionId || `sess_${Date.now()}`;
          console.log(`[Gemini Live WS] Initializing live session (${currentSessionId}) for candidate: ${(data as LiveSessionInitData)?.candidate?.name || 'unknown'}`);

          const result = await createLiveSession(
            currentSessionId,
            data as LiveSessionInitData,
            (msg) => {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify(msg));
              }
            }
          );
          if (result) {
            session = result.session;
            isSessionReady = true;
          }
        } else if (data.type === 'audio' && data.audio) {
          // Client streaming 16kHz PCM audio
          if (data.sessionId && currentSessionId && data.sessionId !== currentSessionId) return;
          if (session && isSessionReady) {
            session.sendRealtimeInput({
              audio: {
                data: data.audio,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          }
        } else if (data.type === 'text' && data.text) {
          // Client manual text message or quick reply
          if (data.sessionId && currentSessionId && data.sessionId !== currentSessionId) return;
          if (session && isSessionReady) {
            session.sendClientContent({
              turns: [{ role: 'user', parts: [{ text: data.text }] }],
              turnComplete: true,
            });
          }
        } else if (data.type === 'interrupt') {
          // Explicit interrupt
        } else if (data.type === 'end') {
          cleanupSession();
        }
      } catch (err) {
        console.error('[Gemini Live WS] Error processing client message:', err);
      }
    });

    clientWs.on('close', (code, reason) => {
      console.log(`[Gemini Live WS] Client WebSocket disconnected (code: ${code}, reason: '${reason?.toString() || ''}')`);
      cleanupSession();
    });

    clientWs.on('error', (err) => {
      console.error('[Gemini Live WS] Client WebSocket error:', err);
      cleanupSession();
    });
  });

  // Mount HTTP Streaming Session Bridge Routes on Express if app is provided
  if (app) {
    // 1. Live status check
    app.get('/api/live-status', (req: any, res: any) => {
      const apiKey = process.env.GEMINI_API_KEY;
      res.json({
        status: 'ok',
        hasKey: !!apiKey,
        keyLength: apiKey ? apiKey.length : 0,
        model: 'gemini-3.8-live',
        timestamp: new Date().toISOString(),
      });
    });

    // 2. Start Live Session (HTTP fallback mode)
    app.post('/api/live-session/start', async (req: any, res: any) => {
      const { sessionId, candidate, scenario, availableSlots, languagePreference } = req.body || {};
      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
      }

      console.log(`[Gemini Live HTTP] Starting session ${sessionId}`);

      // Clean up any existing session with this ID
      const existing = httpSessions.get(sessionId);
      if (existing) {
        existing.cleanup();
      }

      const sseClients = new Set<any>();

      const sendToSse = (msg: any) => {
        const payload = `data: ${JSON.stringify(msg)}\n\n`;
        for (const clientRes of sseClients) {
          try {
            clientRes.write(payload);
          } catch (e) {
            sseClients.delete(clientRes);
          }
        }
      };

      const result = await createLiveSession(
        sessionId,
        { candidate, scenario, availableSlots, languagePreference },
        sendToSse
      );

      if (!result) {
        return res.status(500).json({ error: 'Failed to initialize Gemini Live session' });
      }

      const sessionObj = {
        session: result.session,
        isReady: true,
        sseClients,
        cleanup: () => {
          try {
            result.session.close();
          } catch (e) {}
          httpSessions.delete(sessionId);
        },
      };

      httpSessions.set(sessionId, sessionObj);

      res.json({
        status: 'ok',
        sessionId,
        model: 'gemini-3.8-live',
      });
    });

    // 3. SSE Stream for session events
    app.get('/api/live-session/stream', (req: any, res: any) => {
      const sessionId = req.query.sessionId as string;
      if (!sessionId) {
        return res.status(400).send('sessionId query param required');
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }

      const sessionObj = httpSessions.get(sessionId);
      if (!sessionObj) {
        res.write(`data: ${JSON.stringify({ type: 'error', sessionId, message: 'Session not found or already closed.' })}\n\n`);
        return res.end();
      }

      sessionObj.sseClients.add(res);

      // Send initial ready event
      res.write(`data: ${JSON.stringify({ type: 'ready', sessionId })}\n\n`);

      req.on('close', () => {
        sessionObj.sseClients.delete(res);
      });
    });

    // 4. Send audio chunk from client microphone (16kHz PCM)
    app.post('/api/live-session/audio', (req: any, res: any) => {
      const { sessionId, audio } = req.body || {};
      if (!sessionId || !audio) {
        return res.status(400).json({ error: 'sessionId and audio are required' });
      }

      const sessionObj = httpSessions.get(sessionId);
      if (!sessionObj || !sessionObj.session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      try {
        sessionObj.session.sendRealtimeInput({
          audio: {
            data: audio,
            mimeType: 'audio/pcm;rate=16000',
          },
        });
        res.json({ status: 'ok' });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Error sending audio input' });
      }
    });

    // 5. Send text message / quick turn
    app.post('/api/live-session/text', (req: any, res: any) => {
      const { sessionId, text } = req.body || {};
      const sessionObj = httpSessions.get(sessionId);
      if (!sessionObj || !sessionObj.session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      try {
        sessionObj.session.sendClientContent({
          turns: [{ role: 'user', parts: [{ text }] }],
          turnComplete: true,
        });
        res.json({ status: 'ok' });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Error sending text' });
      }
    });

    // 6. End session
    app.post('/api/live-session/end', (req: any, res: any) => {
      const { sessionId } = req.body || {};
      const sessionObj = httpSessions.get(sessionId);
      if (sessionObj) {
        sessionObj.cleanup();
      }
      res.json({ status: 'ok' });
    });
  }

  return wss;
}
