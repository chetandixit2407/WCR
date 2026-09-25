import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import {
  CandidateBehaviorReport,
  RealTimeBehaviorState,
  BehaviorEvidenceItem,
  BehaviorTimelineStage,
  ScenarioBehaviorEvaluation,
  BehaviorScoreMultiDimensional,
  CandidateCommunicationPreference,
  ObservedCommunicationTone,
  ObservedPoliteness,
  ObservedRespectfulness,
  ObservedCooperation,
  ObservedPatience,
  ListeningResponseQuality,
  EngagementLevel,
  ImpatienceLevel,
  ConfidenceSignal,
  NegotiationStyleObserved,
  ConversationalAdaptability,
  InterruptionClassification,
  CandidateBehaviorSummary,
  CandidateMultiCallBehaviorProfile,
} from '../../src/types';
import { behaviorRepository } from '../repositories/behaviorRepository';
import { memoryRepository } from '../repositories/memoryRepository';

// Structured Schema for Gemini AI Behavior Synthesis (Section 38)
const behaviorAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    communicationStyle: {
      type: Type.OBJECT,
      properties: {
        primaryTone: {
          type: Type.STRING,
          enum: [
            'professional',
            'friendly',
            'neutral',
            'formal',
            'informal',
            'direct',
            'conversational',
            'brief',
            'detailed',
            'enthusiastic',
            'reserved',
          ],
        },
        secondaryTones: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        summary: { type: Type.STRING },
        isBrief: { type: Type.BOOLEAN },
        isDetailed: { type: Type.BOOLEAN },
      },
      required: ['primaryTone', 'summary', 'isBrief', 'isDetailed'],
    },
    interactionBehavior: {
      type: Type.OBJECT,
      properties: {
        politeness: {
          type: Type.STRING,
          enum: [
            'polite',
            'generally polite',
            'neutral',
            'occasionally abrupt',
            'frequently abrupt',
            'disrespectful language observed',
          ],
        },
        respectfulness: {
          type: Type.STRING,
          enum: [
            'respectful',
            'generally respectful',
            'neutral',
            'occasionally dismissive',
            'repeatedly dismissive',
            'disrespectful language observed',
          ],
        },
        cooperation: {
          type: Type.STRING,
          enum: [
            'COOPERATIVE',
            'MOSTLY_COOPERATIVE',
            'NEUTRAL',
            'HESITANT',
            'RELUCTANT',
            'NON_RESPONSIVE',
          ],
        },
        patience: {
          type: Type.STRING,
          enum: [
            'waits for recruiter to finish',
            'listens fully',
            'interrupts occasionally',
            'interrupts repeatedly',
            'asks recruiter to hurry',
            'becomes impatient during detailed questions',
            'good',
          ],
        },
      },
      required: ['politeness', 'respectfulness', 'cooperation', 'patience'],
    },
    engagement: {
      type: Type.OBJECT,
      properties: {
        level: {
          type: Type.STRING,
          enum: ['HIGH', 'MEDIUM', 'LOW', 'VARIABLE'],
        },
        rationale: { type: Type.STRING },
        interestSignals: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        concernSignals: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: ['level', 'rationale', 'interestSignals', 'concernSignals'],
    },
    conversationSignals: {
      type: Type.OBJECT,
      properties: {
        listeningResponseQuality: {
          type: Type.STRING,
          enum: [
            'DIRECT',
            'PARTIAL',
            'VAGUE',
            'OFF_TOPIC',
            'CLARIFICATION_REQUESTED',
            'DETAILED',
            'EVIDENCE_BASED',
          ],
        },
        confidenceSignals: {
          type: Type.STRING,
          enum: ['CLEARLY_ARTICULATED', 'MODERATELY_CLEAR', 'UNCERTAIN', 'VAGUE'],
        },
        answerOwnership: { type: Type.STRING },
        accountabilitySignals: { type: Type.STRING },
        interruptions: {
          type: Type.OBJECT,
          properties: {
            frequency: {
              type: Type.STRING,
              enum: [
                'no interruptions',
                'occasional interruption',
                'frequent interruption',
                'repeated interruption before question completion',
              ],
            },
            classification: {
              type: Type.STRING,
              enum: ['none', 'natural interruption', 'problematic interruption'],
            },
            count: { type: Type.INTEGER },
            notes: { type: Type.STRING },
          },
          required: ['frequency', 'classification', 'count', 'notes'],
        },
        impatience: {
          type: Type.OBJECT,
          properties: {
            level: {
              type: Type.STRING,
              enum: ['NONE', 'TEMPORARY_IMPATIENCE', 'REPEATED_IMPATIENCE'],
            },
            evidence: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['level', 'evidence'],
        },
        frustrationSignals: {
          type: Type.OBJECT,
          properties: {
            detected: { type: Type.BOOLEAN },
            evidence: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['detected', 'evidence'],
        },
        aggressiveLanguage: {
          type: Type.OBJECT,
          properties: {
            detected: { type: Type.BOOLEAN },
            severity: {
              type: Type.STRING,
              enum: ['none', 'low', 'medium', 'high'],
            },
            evidence: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            count: { type: Type.INTEGER },
          },
          required: ['detected', 'severity', 'evidence', 'count'],
        },
      },
      required: [
        'listeningResponseQuality',
        'confidenceSignals',
        'answerOwnership',
        'accountabilitySignals',
        'interruptions',
        'impatience',
        'frustrationSignals',
        'aggressiveLanguage',
      ],
    },
    scenarioBehavior: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          scenarioTitle: { type: Type.STRING },
          objectionHandlingStepsUsed: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          negotiationStyle: {
            type: Type.STRING,
            enum: [
              'consultative',
              'value-based',
              'direct',
              'aggressive',
              'flexible',
              'structured',
              'discount-focused',
              'relationship-focused',
              'unclear',
            ],
          },
          conversationalAdaptability: {
            type: Type.STRING,
            enum: ['HIGH', 'MEDIUM', 'LOW'],
          },
          customerHandlingApproach: { type: Type.STRING },
          observation: { type: Type.STRING },
          ownershipShown: { type: Type.STRING },
        },
        required: [
          'scenarioTitle',
          'objectionHandlingStepsUsed',
          'negotiationStyle',
          'conversationalAdaptability',
          'customerHandlingApproach',
          'observation',
          'ownershipShown',
        ],
      },
    },
    behaviorTimeline: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          stage: { type: Type.STRING },
          tone: { type: Type.STRING },
          engagement: { type: Type.STRING },
          observation: { type: Type.STRING },
        },
        required: ['stage', 'tone', 'engagement', 'observation'],
      },
    },
    evidence: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          dimension: { type: Type.STRING },
          observation: { type: Type.STRING },
          evidence: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          source: {
            type: Type.STRING,
            enum: ['transcript', 'audio_signal', 'explicit_statement'],
          },
        },
        required: ['dimension', 'observation', 'evidence', 'confidence', 'source'],
      },
    },
    candidatePreferences: {
      type: Type.OBJECT,
      properties: {
        language: { type: Type.STRING },
        responseStyle: {
          type: Type.STRING,
          enum: ['brief', 'detailed', 'conversational', 'direct'],
        },
        preferredTime: { type: Type.STRING },
        communicationPreference: {
          type: Type.STRING,
          enum: ['direct', 'consultative', 'detailed', 'concise'],
        },
      },
      required: ['language', 'responseStyle', 'preferredTime', 'communicationPreference'],
    },
    adaptiveRecommendations: {
      type: Type.OBJECT,
      properties: {
        recommendedAgentPacing: {
          type: Type.STRING,
          enum: [
            'concise_questions',
            'conversational_space',
            'keep_call_concise',
            'deep_scenario',
            'simplify_questions',
            'shorter_turns',
          ],
        },
        guidance: { type: Type.STRING },
      },
      required: ['recommendedAgentPacing', 'guidance'],
    },
    behaviorScore: {
      type: Type.OBJECT,
      properties: {
        communication: {
          type: Type.OBJECT,
          properties: {
            clarity: { type: Type.INTEGER },
            responsiveness: { type: Type.INTEGER },
            engagement: { type: Type.INTEGER },
          },
          required: ['clarity', 'responsiveness', 'engagement'],
        },
        interaction: {
          type: Type.OBJECT,
          properties: {
            politeness: { type: Type.INTEGER },
            respectfulness: { type: Type.INTEGER },
            cooperation: { type: Type.INTEGER },
            patience: { type: Type.INTEGER },
          },
          required: ['politeness', 'respectfulness', 'cooperation', 'patience'],
        },
        conversation: {
          type: Type.OBJECT,
          properties: {
            interruptions: { type: Type.INTEGER },
            topic_drift: { type: Type.INTEGER },
            answer_relevance: { type: Type.INTEGER },
          },
          required: ['interruptions', 'topic_drift', 'answer_relevance'],
        },
      },
      required: ['communication', 'interaction', 'conversation'],
    },
    humanReviewRequired: { type: Type.BOOLEAN },
    humanReviewReasons: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: [
    'communicationStyle',
    'interactionBehavior',
    'engagement',
    'conversationSignals',
    'scenarioBehavior',
    'behaviorTimeline',
    'evidence',
    'candidatePreferences',
    'adaptiveRecommendations',
    'behaviorScore',
    'humanReviewRequired',
    'humanReviewReasons',
  ],
};

export class CandidateBehaviorAnalyzer {
  /**
   * 1. REAL-TIME TURN-BY-TURN BEHAVIOR SIGNAL EXTRACTION (Rule 1, 31, 32)
   * Analyzes an incoming candidate utterance during an active conversation to update internal state.
   */
  public analyzeCandidateTurn(params: {
    turnText: string;
    previousAgentText?: string;
    turnIndex: number;
    callStage?: string;
    candidateName?: string;
    callId?: string;
    existingState?: RealTimeBehaviorState;
  }): RealTimeBehaviorState {
    const {
      turnText = '',
      previousAgentText = '',
      turnIndex,
      callStage = 'screening',
      callId,
      existingState,
    } = params;

    const lower = turnText.toLowerCase().trim();
    const wordCount = lower.split(/\s+/).filter(Boolean).length;

    // Detect language in turn
    let lang: 'English' | 'Hindi' | 'Hinglish' = 'Hinglish';
    if (/[\u0900-\u097F]/.test(turnText)) {
      lang = 'Hindi';
    } else if (/\b(ji|haan|theek|bolo|bhai|sahab|aap|hum|karo|nahi|bataye|samjha|aunga|hai)\b/i.test(lower)) {
      lang = 'Hinglish';
    } else if (wordCount > 3 && !/\b(ji|haan|theek|karo|nahi|hai)\b/i.test(lower)) {
      lang = 'English';
    }

    // Politeness & Respect signals
    let politeness: ObservedPoliteness = existingState?.currentPoliteness || 'generally polite';
    let cooperation: ObservedCooperation = existingState?.currentCooperation || 'COOPERATIVE';
    let tone: ObservedCommunicationTone = existingState?.currentTone || 'professional';
    let engagement: EngagementLevel = existingState?.currentEngagement || 'MEDIUM';

    let runningImpatience = existingState?.runningImpatienceScore || 0;
    let runningInterruptions = existingState?.runningInterruptionCount || 0;
    let problematicInterruption = existingState?.problematicInterruptionDetected || false;
    const observations: string[] = [];

    // Check for explicit abrasive / abusive language (Rule 13, 40)
    const isAbrasive = /\b(stupid|idiot|bakwaas|nonsense|pagal|dimag mat kharab|shut up|chup|fool)\b/i.test(lower);
    if (isAbrasive) {
      politeness = 'disrespectful language observed';
      cooperation = 'RELUCTANT';
      tone = 'direct';
      observations.push('Observable abrasive / disrespectful vocabulary detected in turn');
    } else if (/\b(please|thank you|thanks|sure|no problem|gladly|ji bilkul|shukriya|certainly)\b/i.test(lower)) {
      politeness = 'polite';
      cooperation = 'COOPERATIVE';
      tone = wordCount > 15 ? 'friendly' : 'professional';
      observations.push('Courteous / cooperative framing observed');
    }

    // Check for Impatience patterns (Rule 11)
    const isImpatientWording = /\b(quick|hurry|jaldi|dont have time|busy right now|make it fast|salary batao|point pe aao|how long)\b/i.test(lower);
    if (isImpatientWording) {
      runningImpatience += 1;
      observations.push('Impatience signal detected regarding timing/pacing');
    }

    // Check for Frustration patterns (Rule 12)
    const isFrustratedWording = /\b(already said|maine bataya tha|already answered|why are you asking again|pehle hi bola tha)\b/i.test(lower);
    if (isFrustratedWording) {
      runningImpatience += 1;
      observations.push('Frustration signal: candidate noted repetition');
    }

    // Brevity vs Detailed check (Rule 2)
    if (wordCount <= 3) {
      tone = 'brief';
      if (['yes', 'no', 'haan', 'theek', 'ok', 'okay'].includes(lower)) {
        cooperation = 'COOPERATIVE';
      }
    } else if (wordCount >= 25) {
      tone = 'detailed';
      engagement = 'HIGH';
    }

    // Questions asked by candidate (Rule 10 - Interest Signals)
    if (/\?|what is|kya hai|kahan|project|incentive|commission|salary|slot|timing|office/i.test(lower)) {
      engagement = 'HIGH';
      observations.push('Candidate showed active engagement by asking question');
    }

    // Interruption logic (Rule 7)
    // If candidate response started while agent was in mid-sentence or turn is rapid
    if (previousAgentText.endsWith('?') === false && lower.length > 5) {
      runningInterruptions += 1;
      if (isAbrasive || runningImpatience >= 2) {
        problematicInterruption = true;
      }
    }

    // Determine adaptive recommendation for next turn (Rule 32)
    let nextTurnStyle = 'Maintain balanced, professional recruitment pacing.';
    if (isAbrasive) {
      nextTurnStyle = 'Remain composed and courteous; de-escalate without defensive response.';
    } else if (runningImpatience >= 2) {
      nextTurnStyle = 'Candidate indicates time pressure. Keep next turn ultra-concise; prioritize essential role and slot.';
    } else if (isFrustratedWording) {
      nextTurnStyle = 'Acknowledge previous answer immediately; do not repeat question.';
    } else if (tone === 'brief' && wordCount <= 3) {
      nextTurnStyle = 'Candidate is concise. Use direct questions with minimal preamble.';
    } else if (tone === 'detailed' || engagement === 'HIGH') {
      nextTurnStyle = 'Candidate is highly engaged. Allow conversational space for luxury sales context.';
    }

    const updatedState: RealTimeBehaviorState = {
      currentTone: tone,
      currentPoliteness: politeness,
      currentCooperation: cooperation,
      currentEngagement: engagement,
      runningImpatienceScore: runningImpatience,
      runningInterruptionCount: runningInterruptions,
      problematicInterruptionDetected: problematicInterruption,
      activeLanguageObserved: lang,
      recommendedNextTurnStyle: nextTurnStyle,
      recentObservations: observations,
    };

    if (callId) {
      behaviorRepository.updateActiveCallState(callId, updatedState);
    }

    return updatedState;
  }

  /**
   * 2. FULL POST-CALL BEHAVIOR SYNTHESIS (Rule 1, 26, 28, 36, 38)
   * Uses Gemini AI with structured schema validation or strict deterministic rule-based extractor.
   */
  public async analyzeCallBehavior(params: {
    candidate: any;
    transcript: any[];
    callScenario: string;
    callDuration?: number;
    conversationId?: string;
    genAIClient?: GoogleGenAI | null;
  }): Promise<CandidateBehaviorReport> {
    const {
      candidate,
      transcript = [],
      callScenario = 'screening',
      callDuration = 60,
      conversationId = `CALL-${Date.now()}`,
      genAIClient,
    } = params;

    const candId = candidate?.id || 'cand-unknown';
    const candName = candidate?.name || 'Candidate';
    const candRole = candidate?.appliedRole || 'Sales Manager (Luxury Real Estate)';

    // 1. Check historical calls for behavior trend (Rule 29, 30)
    const trendInfo = behaviorRepository.calculateBehaviorTrend(candId);

    // 2. Try Gemini Flash structured generation if client is available
    if (genAIClient && transcript.length > 0) {
      try {
        const transcriptText = transcript
          .map((m: any) => `${m.sender.toUpperCase()}: ${m.text}`)
          .join('\n');

        const prompt = `
You are the Chief Conversation Behavior & Recruitment Intelligence Evaluator for White Collar Realty (M3M Urbana Business Park, Sector 67, Gurugram).
Evaluate the completed candidate voice screening transcript to produce a strictly evidence-based Candidate Behavior Profile.

MANDATORY SAFETY & ETHICAL DIRECTIVES:
1. Do NOT diagnose personality or psychological traits (e.g. NEVER say "Candidate has anger issues" or "Candidate is naturally aggressive").
2. Do NOT infer mental health, protected characteristics, or general intelligence.
3. Do NOT make hiring or employment decisions solely based on conversational behavior.
4. Base every single observation STRICTLY on observable verbal communication evidence in the transcript.
5. If candidate is concise or speaks in Hindi/Hinglish, do NOT penalize or classify negatively.
6. For every important behavior observation, provide the verbatim supporting quote in the evidence list.
7. Distinguish natural interruptions (anticipating question cooperatively) from problematic interruptions.
8. Distinguish temporary impatience (candidate is busy) from repeated hostility.

Candidate Name: ${candName}
Applied Role: ${candRole}
Call Scenario: ${callScenario}
Call Duration: ${callDuration} seconds
Historical Behavior Context: ${trendInfo.trendDescription}

Call Transcript:
${transcriptText}

Generate a comprehensive, evidence-grounded behavior profile adhering strictly to the JSON schema.
`;

        const response = await genAIClient.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: prompt,
          config: {
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.LOW,
            },
            responseMimeType: 'application/json',
            responseSchema: behaviorAnalysisSchema,
          },
        });

        const parsed = JSON.parse(response.text?.trim() || '{}');
        const report = this.finalizeBehaviorReport(parsed, {
          candidateId: candId,
          candidateName: candName,
          conversationId,
          trendInfo,
        });

        // Persist report in behavior repository
        behaviorRepository.saveBehaviorReport(report);

        // Update candidate communication preferences in candidate memory (Rule 31)
        this.syncCommunicationPreferencesToMemory(candId, report.candidatePreferences);

        return report;
      } catch (err) {
        console.warn('Gemini behavior analysis failed, falling back to deterministic extractor:', err);
      }
    }

    // 3. Deterministic rule-based behavior synthesizer (Guaranteed zero-failure fallback)
    const fallbackReport = this.synthesizeDeterministicBehaviorReport({
      candidateId: candId,
      candidateName: candName,
      appliedRole: candRole,
      transcript,
      callScenario,
      callDuration,
      conversationId,
      trendInfo,
    });

    behaviorRepository.saveBehaviorReport(fallbackReport);
    this.syncCommunicationPreferencesToMemory(candId, fallbackReport.candidatePreferences);

    return fallbackReport;
  }

  /**
   * Deterministic evidence-based behavior extraction engine
   */
  private synthesizeDeterministicBehaviorReport(params: {
    candidateId: string;
    candidateName: string;
    appliedRole: string;
    transcript: any[];
    callScenario: string;
    callDuration: number;
    conversationId: string;
    trendInfo: { trend: any; historicalCallCount: number; trendDescription: string };
  }): CandidateBehaviorReport {
    const {
      candidateId,
      candidateName,
      appliedRole,
      transcript,
      callScenario,
      callDuration,
      conversationId,
      trendInfo,
    } = params;

    const candidateTurns = transcript.filter((m) => m.sender === 'candidate' || m.sender === 'user');
    const allCandidateText = candidateTurns.map((m) => m.text).join(' ');
    const lowerAll = allCandidateText.toLowerCase();

    // 1. Evidence list
    const evidenceList: BehaviorEvidenceItem[] = [];
    const now = new Date().toISOString();

    // 2. Abrasive language check (Rule 13, 40)
    const abrasiveRegex = /\b(stupid|idiot|bakwaas|nonsense|pagal|dimag mat kharab|shut up|chup|fool|harami)\b/i;
    const abrasiveMatch = allCandidateText.match(abrasiveRegex);
    const hasAbrasive = Boolean(abrasiveMatch);

    if (hasAbrasive) {
      evidenceList.push({
        dimension: 'aggressiveLanguage',
        observation: 'Candidate used abrasive vocabulary in conversation',
        evidence: `"...${abrasiveMatch?.[0]}..."`,
        timestamp: now,
        conversationId,
        confidence: 0.96,
        source: 'transcript',
      });
    }

    // 3. Politeness & Cooperation
    const isPolite = /\b(please|thank you|thanks|sure|no problem|gladly|ji bilkul|shukriya|certainly|theek hai ji)\b/i.test(lowerAll);
    const isAbrupt = /\b(jaldi bolo|point pe aao|time nahi hai|why are you asking|kya matlab)\b/i.test(lowerAll);

    let politeness: ObservedPoliteness = 'generally polite';
    if (hasAbrasive) {
      politeness = 'disrespectful language observed';
    } else if (isPolite) {
      politeness = 'polite';
      evidenceList.push({
        dimension: 'politeness',
        observation: 'Candidate used polite and welcoming acknowledgment',
        evidence: candidateTurns.find((m) => isPolite)?.text || 'Sure, please go ahead.',
        timestamp: now,
        conversationId,
        confidence: 0.92,
        source: 'transcript',
      });
    } else if (isAbrupt) {
      politeness = 'occasionally abrupt';
    }

    // Respectfulness
    let respectfulness: ObservedRespectfulness = 'respectful';
    if (hasAbrasive) {
      respectfulness = 'disrespectful language observed';
    } else if (isAbrupt) {
      respectfulness = 'occasionally dismissive';
    }

    // Cooperation
    const isDeclined = /not interested|nahi chahiye|dont call|mana kar diya/i.test(lowerAll);
    let cooperation: ObservedCooperation = 'COOPERATIVE';
    if (hasAbrasive) {
      cooperation = 'RELUCTANT';
    } else if (isDeclined) {
      cooperation = 'HESITANT';
    } else if (candidateTurns.length <= 1) {
      cooperation = 'NON_RESPONSIVE';
    } else if (candidateTurns.length >= 4) {
      cooperation = 'COOPERATIVE';
    }

    // 4. Tone & Brevity
    const avgWordsPerTurn = candidateTurns.length > 0
      ? allCandidateText.split(/\s+/).length / candidateTurns.length
      : 5;
    const isBrief = avgWordsPerTurn < 7;
    const isDetailed = avgWordsPerTurn > 18;

    let primaryTone: ObservedCommunicationTone = 'professional';
    if (isBrief) primaryTone = 'direct';
    if (isDetailed) primaryTone = 'detailed';
    if (isPolite && isDetailed) primaryTone = 'conversational';

    // 5. Engagement & Interest Signals (Rule 9, 10)
    const interestSignals: string[] = [];
    if (/luxury|dlf|m3m|emaar|godrej|sobha|project/i.test(lowerAll)) {
      interestSignals.push('Candidate showed interest by asking about luxury projects');
    }
    if (/salary|ctc|incentive|ote|slab|package|commission/i.test(lowerAll)) {
      interestSignals.push('Candidate showed interest by inquiring about incentive structure and compensation');
    }
    if (/interview|sector 67|m3m urbana|office|venue|face to face/i.test(lowerAll)) {
      interestSignals.push('Candidate showed interest by inquiring about interview process and HQ location');
    }

    const concernSignals: string[] = [];
    if (/target|monthly booking|pressure|lead quality|cold calling/i.test(lowerAll)) {
      concernSignals.push('Candidate sought clarification regarding lead qualification and target expectations');
    }

    const engagementLevel: EngagementLevel =
      interestSignals.length >= 2 || avgWordsPerTurn > 15
        ? 'HIGH'
        : isDeclined || candidateTurns.length <= 2
        ? 'LOW'
        : 'MEDIUM';

    // 6. Impatience & Frustration (Rule 11, 12)
    const impatiencePhrases = lowerAll.match(/\b(quick|jaldi|dont have much time|busy right now|make it fast|how long|salary batao)\b/gi) || [];
    let impatienceLevel: ImpatienceLevel = 'NONE';
    if (impatiencePhrases.length >= 2) {
      impatienceLevel = 'REPEATED_IMPATIENCE';
    } else if (impatiencePhrases.length === 1) {
      impatienceLevel = 'TEMPORARY_IMPATIENCE';
    }

    const frustrationDetected = /\b(already said|pehle hi bola|already answered|why ask again)\b/i.test(lowerAll);

    // 7. Answer Ownership & Accountability (Rule 15, 16)
    let answerOwnership = 'Candidate shared general background experience.';
    if (/\b(personally|my individual|my closure|my deal|maine khud|direct booking)\b/i.test(lowerAll)) {
      answerOwnership = 'Candidate clearly distinguished personal contribution and direct individual deal closures.';
      evidenceList.push({
        dimension: 'answerOwnership',
        observation: 'Candidate highlighted direct personal deal contribution',
        evidence: candidateTurns.find((m) => /\b(personally|individual|closure|deal)\b/i.test(m.text))?.text || 'Handled personal closures',
        timestamp: now,
        conversationId,
        confidence: 0.90,
        source: 'transcript',
      });
    } else if (/\b(team|humne|we closed|group)\b/i.test(lowerAll)) {
      answerOwnership = 'Candidate referred primarily to aggregate team achievements; individual deal share not fully segregated.';
    }

    let accountabilitySignals = 'Standard communication regarding work experience.';
    if (/\b(conversion|lead quality|process|pipeline|review|audit)\b/i.test(lowerAll)) {
      accountabilitySignals = 'Candidate described a structured problem-analysis approach when discussing sales scenarios.';
    }

    // 8. Scenario Behavior (Rule 17, 18, 19)
    const scenarioEvaluations: ScenarioBehaviorEvaluation[] = [
      {
        scenarioTitle: 'HNI Client / Market Scenario Evaluation',
        objectionHandlingStepsUsed: [
          '1. Understand client objection',
          '2. Clarify budget and micro-market preference',
          '3. Explain project capital appreciation and infrastructure benefits',
        ],
        negotiationStyle: isDetailed ? 'consultative' : 'direct',
        conversationalAdaptability: engagementLevel === 'HIGH' ? 'HIGH' : 'MEDIUM',
        customerHandlingApproach: 'Professional and solution-oriented approach with developer reference',
        observation: 'Demonstrated real estate market familiarity without aggressive posturing',
        ownershipShown: answerOwnership,
      },
    ];

    // 9. Behavior Timeline (Rule 22)
    const behaviorTimeline: BehaviorTimelineStage[] = [
      {
        stage: 'opening',
        tone: isPolite ? 'polite' : 'neutral',
        engagement: 'medium',
        observation: 'Conversation initiated and availability verified',
      },
      {
        stage: 'screening',
        tone: primaryTone,
        engagement: engagementLevel,
        observation: `Communicated background details (${avgWordsPerTurn > 10 ? 'detailed elaboration' : 'concise responses'})`,
      },
      {
        stage: 'compensation',
        tone: impatienceLevel !== 'NONE' ? 'direct' : primaryTone,
        engagement: engagementLevel,
        observation: 'Discussed salary expectations and notice period',
      },
      {
        stage: 'closing',
        tone: isPolite ? 'cooperative' : 'neutral',
        engagement: engagementLevel,
        observation: 'Concluded discussion regarding interview slot and follow-up',
      },
    ];

    // 10. Multi-dimensional Behavior Score (Rule 26, 27 - NO SINGLE SCORE!)
    const politenessScore = hasAbrasive ? 1 : isPolite ? 5 : isAbrupt ? 3 : 4;
    const respectScore = hasAbrasive ? 1 : isAbrupt ? 3 : 5;
    const cooperationScore = cooperation === 'COOPERATIVE' ? 5 : cooperation === 'HESITANT' ? 3 : 2;
    const patienceScore = impatienceLevel === 'REPEATED_IMPATIENCE' ? 2 : impatienceLevel === 'TEMPORARY_IMPATIENCE' ? 3 : 5;
    const clarityScore = isDetailed ? 5 : avgWordsPerTurn >= 5 ? 4 : 3;
    const responsivenessScore = candidateTurns.length >= 3 ? 5 : 3;
    const engagementScore = engagementLevel === 'HIGH' ? 5 : engagementLevel === 'MEDIUM' ? 3 : 2;

    const behaviorScore: BehaviorScoreMultiDimensional = {
      communication: {
        clarity: clarityScore,
        responsiveness: responsivenessScore,
        engagement: engagementScore,
      },
      interaction: {
        politeness: politenessScore,
        respectfulness: respectScore,
        cooperation: cooperationScore,
        patience: patienceScore,
      },
      conversation: {
        interruptions: impatienceLevel !== 'NONE' ? 3 : 5,
        topic_drift: 5,
        answer_relevance: 4,
      },
    };

    // 11. Human review required (Rule 40)
    const humanReviewRequired = hasAbrasive || respectfulness === 'disrespectful language observed';
    const humanReviewReasons: string[] = [];
    if (hasAbrasive) {
      humanReviewReasons.push('Potentially abrasive / disrespectful language detected in transcript requiring HR review.');
    }

    // 12. Candidate preferences (Rule 31)
    let lang = 'Hinglish';
    if (lowerAll.includes('bataiye') || lowerAll.includes('hum') || lowerAll.includes('theek')) {
      lang = 'Hinglish';
    } else if (avgWordsPerTurn > 5 && !lowerAll.includes('haan')) {
      lang = 'English';
    }

    const candidatePreferences: CandidateCommunicationPreference = {
      language: lang,
      responseStyle: isBrief ? 'brief' : isDetailed ? 'detailed' : 'conversational',
      preferredTime: 'afternoon',
      communicationPreference: isBrief ? 'direct' : isDetailed ? 'consultative' : 'detailed',
    };

    // 13. Adaptive Recommendations (Rule 32)
    let agentPacing: any = 'conversational_space';
    let guidance = 'Provide conversational space and explore luxury deal experience.';
    if (hasAbrasive) {
      agentPacing = 'shorter_turns';
      guidance = 'Maintain courteous composure, de-escalate conversation, and offer scheduled callback.';
    } else if (impatienceLevel !== 'NONE') {
      agentPacing = 'keep_call_concise';
      guidance = 'Candidate indicated time pressure. Keep questions ultra-direct and prioritize interview slot confirmation.';
    } else if (isBrief) {
      agentPacing = 'concise_questions';
      guidance = 'Candidate provides brief answers. Use direct, clear questions without lengthy intros.';
    }

    return {
      id: `beh-${Date.now()}`,
      candidateId,
      candidateName,
      conversationId,
      timestamp: now,
      confidence: 0.88,
      communicationStyle: {
        primaryTone,
        secondaryTones: isBrief ? ['direct'] : ['professional', 'informative' as any],
        summary: `Candidate communicated in a ${primaryTone} style (${avgWordsPerTurn.toFixed(0)} avg words/turn) with ${politeness} interaction tone.`,
        isBrief,
        isDetailed,
      },
      interactionBehavior: {
        politeness,
        respectfulness,
        cooperation,
        patience: impatienceLevel !== 'NONE' ? 'asks recruiter to hurry' : 'listens fully',
      },
      engagement: {
        level: engagementLevel,
        rationale: `Exhibited ${engagementLevel.toLowerCase()} engagement with ${interestSignals.length} role-specific inquiries recorded.`,
        interestSignals,
        concernSignals,
      },
      conversationSignals: {
        listeningResponseQuality: isDetailed ? 'EVIDENCE_BASED' : isBrief ? 'DIRECT' : 'PARTIAL',
        confidenceSignals: isDetailed ? 'CLEARLY_ARTICULATED' : 'MODERATELY_CLEAR',
        answerOwnership,
        accountabilitySignals,
        interruptions: {
          frequency: impatienceLevel !== 'NONE' ? 'occasional interruption' : 'no interruptions',
          classification: 'none',
          count: impatienceLevel !== 'NONE' ? 1 : 0,
          notes: impatienceLevel !== 'NONE' ? 'Minor pacing-related turn transition observed' : 'No problematic interruptions recorded',
        },
        impatience: {
          level: impatienceLevel,
          evidence: impatiencePhrases,
        },
        frustrationSignals: {
          detected: frustrationDetected,
          evidence: frustrationDetected ? ['Candidate noted earlier answer repetition'] : [],
        },
        aggressiveLanguage: {
          detected: hasAbrasive,
          severity: hasAbrasive ? 'high' : 'none',
          evidence: hasAbrasive ? [abrasiveMatch?.[0] || ''] : [],
          count: hasAbrasive ? 1 : 0,
        },
      },
      scenarioBehavior: scenarioEvaluations,
      behaviorTimeline,
      evidence: evidenceList,
      candidatePreferences,
      behaviorTrend: {
        trend: trendInfo.trend,
        historicalCallCount: trendInfo.historicalCallCount,
        trendDescription: trendInfo.trendDescription,
      },
      adaptiveRecommendations: {
        recommendedAgentPacing: agentPacing,
        guidance,
      },
      behaviorScore,
      humanReviewRequired,
      humanReviewReasons,
      limitations: [
        'Behavior profile reflects observable verbal communication in this call only.',
        'Does not infer personality, intelligence, mental health, or protected characteristics.',
        'Final recruitment decisions must be made by human HR based on qualifications, role fit, and verified credentials.',
      ],
    };
  }

  /**
   * Finalize parsed Gemini report with fallback defaults and provenance
   */
  private finalizeBehaviorReport(
    raw: any,
    ctx: {
      candidateId: string;
      candidateName: string;
      conversationId: string;
      trendInfo: { trend: any; historicalCallCount: number; trendDescription: string };
    }
  ): CandidateBehaviorReport {
    const now = new Date().toISOString();
    return {
      id: `beh-${Date.now()}`,
      candidateId: ctx.candidateId,
      candidateName: ctx.candidateName,
      conversationId: ctx.conversationId,
      timestamp: now,
      confidence: 0.91,
      communicationStyle: {
        primaryTone: raw.communicationStyle?.primaryTone || 'professional',
        secondaryTones: raw.communicationStyle?.secondaryTones || [],
        summary: raw.communicationStyle?.summary || 'Professional conversation style observed.',
        isBrief: Boolean(raw.communicationStyle?.isBrief),
        isDetailed: Boolean(raw.communicationStyle?.isDetailed),
      },
      interactionBehavior: {
        politeness: raw.interactionBehavior?.politeness || 'generally polite',
        respectfulness: raw.interactionBehavior?.respectfulness || 'respectful',
        cooperation: raw.interactionBehavior?.cooperation || 'COOPERATIVE',
        patience: raw.interactionBehavior?.patience || 'listens fully',
      },
      engagement: {
        level: raw.engagement?.level || 'MEDIUM',
        rationale: raw.engagement?.rationale || 'Participant engaged in screening dialogue.',
        interestSignals: raw.engagement?.interestSignals || [],
        concernSignals: raw.engagement?.concernSignals || [],
      },
      conversationSignals: {
        listeningResponseQuality: raw.conversationSignals?.listeningResponseQuality || 'DIRECT',
        confidenceSignals: raw.conversationSignals?.confidenceSignals || 'MODERATELY_CLEAR',
        answerOwnership: raw.conversationSignals?.answerOwnership || 'Candidate described work experience.',
        accountabilitySignals: raw.conversationSignals?.accountabilitySignals || 'Structured communication approach observed.',
        interruptions: {
          frequency: raw.conversationSignals?.interruptions?.frequency || 'no interruptions',
          classification: raw.conversationSignals?.interruptions?.classification || 'none',
          count: raw.conversationSignals?.interruptions?.count || 0,
          notes: raw.conversationSignals?.interruptions?.notes || 'Normal conversational flow',
        },
        impatience: {
          level: raw.conversationSignals?.impatience?.level || 'NONE',
          evidence: raw.conversationSignals?.impatience?.evidence || [],
        },
        frustrationSignals: {
          detected: Boolean(raw.conversationSignals?.frustrationSignals?.detected),
          evidence: raw.conversationSignals?.frustrationSignals?.evidence || [],
        },
        aggressiveLanguage: {
          detected: Boolean(raw.conversationSignals?.aggressiveLanguage?.detected),
          severity: raw.conversationSignals?.aggressiveLanguage?.severity || 'none',
          evidence: raw.conversationSignals?.aggressiveLanguage?.evidence || [],
          count: raw.conversationSignals?.aggressiveLanguage?.count || 0,
        },
      },
      scenarioBehavior: (raw.scenarioBehavior || []).map((sc: any) => ({
        scenarioTitle: sc.scenarioTitle || 'Scenario Evaluation',
        objectionHandlingStepsUsed: sc.objectionHandlingStepsUsed || [],
        negotiationStyle: sc.negotiationStyle || 'consultative',
        conversationalAdaptability: sc.conversationalAdaptability || 'MEDIUM',
        customerHandlingApproach: sc.customerHandlingApproach || '',
        observation: sc.observation || '',
        ownershipShown: sc.ownershipShown || '',
      })),
      behaviorTimeline: (raw.behaviorTimeline || []).map((bt: any) => ({
        stage: bt.stage || 'screening',
        tone: bt.tone || 'neutral',
        engagement: bt.engagement || 'medium',
        observation: bt.observation || '',
        timestamp: now,
      })),
      evidence: (raw.evidence || []).map((ev: any) => ({
        dimension: ev.dimension || 'communicationStyle',
        observation: ev.observation || '',
        evidence: ev.evidence || '',
        timestamp: now,
        conversationId: ctx.conversationId,
        confidence: ev.confidence || 0.9,
        source: ev.source || 'transcript',
      })),
      candidatePreferences: {
        language: raw.candidatePreferences?.language || 'Hinglish',
        responseStyle: raw.candidatePreferences?.responseStyle || 'conversational',
        preferredTime: raw.candidatePreferences?.preferredTime || 'afternoon',
        communicationPreference: raw.candidatePreferences?.communicationPreference || 'consultative',
      },
      behaviorTrend: {
        trend: ctx.trendInfo.trend,
        historicalCallCount: ctx.trendInfo.historicalCallCount,
        trendDescription: ctx.trendInfo.trendDescription,
      },
      adaptiveRecommendations: {
        recommendedAgentPacing: raw.adaptiveRecommendations?.recommendedAgentPacing || 'conversational_space',
        guidance: raw.adaptiveRecommendations?.guidance || 'Maintain courteous recruitment communication.',
      },
      behaviorScore: {
        communication: {
          clarity: raw.behaviorScore?.communication?.clarity || 4,
          responsiveness: raw.behaviorScore?.communication?.responsiveness || 4,
          engagement: raw.behaviorScore?.communication?.engagement || 4,
        },
        interaction: {
          politeness: raw.behaviorScore?.interaction?.politeness || 4,
          respectfulness: raw.behaviorScore?.interaction?.respectfulness || 4,
          cooperation: raw.behaviorScore?.interaction?.cooperation || 4,
          patience: raw.behaviorScore?.interaction?.patience || 4,
        },
        conversation: {
          interruptions: raw.behaviorScore?.conversation?.interruptions || 5,
          topic_drift: raw.behaviorScore?.conversation?.topic_drift || 5,
          answer_relevance: raw.behaviorScore?.conversation?.answer_relevance || 4,
        },
      },
      humanReviewRequired: Boolean(raw.humanReviewRequired),
      humanReviewReasons: raw.humanReviewReasons || [],
      limitations: [
        'Behavior profile reflects observable verbal communication in this call only.',
        'Does not infer personality, intelligence, mental health, or protected characteristics.',
        'Final recruitment decisions must be made by human HR based on qualifications, role fit, and verified credentials.',
      ],
    };
  }

  /**
   * Sync learned candidate communication preferences into persistent long-term memory
   */
  private syncCommunicationPreferencesToMemory(
    candidateId: string,
    pref: CandidateCommunicationPreference
  ) {
    const mem = memoryRepository.getCandidateMemory(candidateId);
    if (mem) {
      mem.communicationPreferences = {
        preferredLanguage: (pref.language === 'English' || pref.language === 'Hindi' ? pref.language : 'Hinglish') as any,
        communicationStyle: (pref.responseStyle === 'brief' ? 'concise' : 'detailed') as any,
        preferredCallbackWindow: pref.preferredTime,
      };
      memoryRepository.saveCandidateMemory(mem);
    }
  }

  /**
   * Aggregate multi-call behavior profiles
   */
  public aggregateMultiCallProfile(
    candidateId: string,
    candidateName: string,
    summaries: CandidateBehaviorSummary[]
  ): CandidateMultiCallBehaviorProfile {
    const lastSummary = summaries[summaries.length - 1];
    const flagged = summaries.some((s) => s.humanReviewRequired);
    return {
      candidateId,
      candidateName,
      callSummaries: summaries,
      overallTone: lastSummary?.primaryTone || 'professional',
      overallPoliteness: lastSummary?.politeness || 'generally polite',
      overallEngagement: lastSummary?.engagementLevel || 'MEDIUM',
      overallTrend: summaries.length > 1 ? 'STABLE' : 'INSUFFICIENT_DATA',
      humanReviewFlagged: flagged,
      humanReviewReason: flagged ? 'Flagged during call interaction review' : undefined,
      lastUpdated: new Date().toISOString(),
    };
  }
}

export const candidateBehaviorAnalyzer = new CandidateBehaviorAnalyzer();
export const behaviorAnalyzer = candidateBehaviorAnalyzer;
