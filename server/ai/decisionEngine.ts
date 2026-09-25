import {
  CandidateLongTermMemory,
  NextCallBrief,
  CallRecord,
} from '../../src/types';
import { memoryRepository } from '../repositories/memoryRepository';
import { conversationRepository } from '../repositories/conversationRepository';
import { behaviorRepository } from '../repositories/behaviorRepository';

export class DecisionEngine {
  /**
   * Generate NEXT_CALL_BRIEF / NEXT_CALL_CONTEXT before any interaction (Rule 8, 9, 33, 34)
   */
  public generateNextCallBrief(
    candidate: {
      id: string;
      name: string;
      appliedRole?: string;
      phone?: string;
      screening?: any;
    },
    previousCalls: CallRecord[] = []
  ): NextCallBrief {
    const memory = memoryRepository.getCandidateMemory(candidate.id);
    const role = candidate.appliedRole || 'Sales Manager (Luxury Real Estate)';

    // Gather already verified information
    const verifiedSummary: string[] = [];
    const alreadyDiscussed: string[] = [];
    const forbiddenQuestions: string[] = [];
    const unresolved: string[] = [];

    if (memory) {
      if (memory.experience.totalYears?.value) {
        verifiedSummary.push(`Total Experience: ${memory.experience.totalYears.value} Years`);
        alreadyDiscussed.push('total_experience');
        forbiddenQuestions.push('How many years of total experience do you have?');
        forbiddenQuestions.push('Total experience kitna hai?');
      }

      if (memory.experience.realEstateYears?.value) {
        verifiedSummary.push(`Real Estate Experience: ${memory.experience.realEstateYears.value} Years`);
        alreadyDiscussed.push('real_estate_experience');
        forbiddenQuestions.push('How much real estate experience do you have?');
        forbiddenQuestions.push('Real estate mein kitne saal ka experience hai?');
      }

      if (memory.companies.value && memory.companies.value.length > 0) {
        verifiedSummary.push(`Current/Past Companies: ${memory.companies.value.join(', ')}`);
        alreadyDiscussed.push('current_company');
        forbiddenQuestions.push('Which company are you currently working with?');
        forbiddenQuestions.push('Aapki current company kaunsi hai?');
      }

      if (memory.designations.value && memory.designations.value.length > 0) {
        verifiedSummary.push(`Designation: ${memory.designations.value.join(', ')}`);
        alreadyDiscussed.push('current_designation');
        forbiddenQuestions.push('What is your current designation?');
      }

      if (memory.markets.value && memory.markets.value.length > 0) {
        verifiedSummary.push(`Markets: ${memory.markets.value.join(', ')}`);
        alreadyDiscussed.push('gurgaon_dubai_markets');
      }

      if (memory.luxuryExperience.ticketSizesHandled?.value && memory.luxuryExperience.ticketSizesHandled.value.length > 0) {
        verifiedSummary.push(`Luxury Ticket Sizes: ${memory.luxuryExperience.ticketSizesHandled.value.join(', ')}`);
        alreadyDiscussed.push('ticket_sizes');
      }

      if (memory.salesPerformance.highestPersonalClosure?.value) {
        verifiedSummary.push(`Highest Personal Closure: ${memory.salesPerformance.highestPersonalClosure.value}`);
        alreadyDiscussed.push('highest_personal_closure');
        forbiddenQuestions.push('What was your highest ticket personal closure?');
      } else {
        unresolved.push('Highest personal ticket closure');
      }

      if (memory.compensation.currentSalary?.value) {
        verifiedSummary.push(`Current CTC: ${memory.compensation.currentSalary.value}`);
        alreadyDiscussed.push('current_salary');
        forbiddenQuestions.push('What is your current CTC?');
      } else {
        unresolved.push('Current CTC / In-hand salary');
      }

      if (memory.compensation.expectedSalary?.value) {
        verifiedSummary.push(`Expected CTC: ${memory.compensation.expectedSalary.value}`);
        alreadyDiscussed.push('expected_salary');
      } else {
        unresolved.push('Expected CTC');
      }

      if (memory.noticePeriod.days?.value !== undefined) {
        verifiedSummary.push(`Notice Period: ${memory.noticePeriod.days.value} Days`);
        alreadyDiscussed.push('notice_period');
        forbiddenQuestions.push('What is your notice period?');
      } else {
        unresolved.push('Notice Period / Earliest joining date');
      }

      if (memory.interviewAvailability.agreedSlot?.value) {
        verifiedSummary.push(`F2F Interview Slot: ${memory.interviewAvailability.agreedSlot.value}`);
        alreadyDiscussed.push('interview_booking');
      } else {
        unresolved.push('F2F Interview slot confirmation at Sector 67 HQ');
      }
    } else {
      unresolved.push('Candidate Introduction & Background Walkthrough');
      unresolved.push('Real Estate Experience');
      unresolved.push('Luxury ticket size closures');
      unresolved.push('Current and Expected CTC');
      unresolved.push('Notice Period');
      unresolved.push('F2F Interview Slot');
    }

    // Identify contradictions requiring clarification
    const contradictionsRequiringClarification: Array<{
      field: string;
      previousValue: string;
      newValue: string;
      clarificationPrompt: string;
    }> = [];

    if (memory) {
      for (const contra of memory.contradictions) {
        if (contra.status === 'PENDING_CLARIFICATION') {
          contradictionsRequiringClarification.push({
            field: contra.field,
            previousValue: contra.previousValue,
            newValue: contra.newValue,
            clarificationPrompt: `Earlier we noted ${contra.previousValue} regarding your ${contra.topic}, while you also mentioned ${contra.newValue}. Just to ensure our records are exact, could you clarify?`,
          });
        }
      }
    }

    // Determine recommended starting topic and opening line (Rule 34 Example)
    let startingTopic = 'candidate_introduction';
    let suggestedOpening = `Hi ${candidate.name}, am I speaking with ${candidate.name}?`;

    if (previousCalls.length > 0 && verifiedSummary.length > 0) {
      if (contradictionsRequiringClarification.length > 0) {
        startingTopic = 'clarification';
        suggestedOpening = `Hi ${candidate.name}, Arjun calling back from White Collar Realty. Following up on our previous discussion, I wanted to quickly clarify one detail regarding your experience.`;
      } else if (unresolved.length > 0) {
        const topUnresolved = unresolved[0];
        startingTopic = topUnresolved;
        
        if (topUnresolved.includes('closure')) {
          suggestedOpening = `Hi ${candidate.name}, Arjun here from White Collar Realty. In our last call you walked me through your Gurgaon luxury experience. I wanted to understand your closing track record a bit further—could you tell me about your highest-ticket personal closure?`;
        } else if (topUnresolved.includes('CTC')) {
          suggestedOpening = `Hi ${candidate.name}, Arjun from White Collar Realty HR. Picking up from our earlier discussion on the ${role} opportunity, I wanted to quickly check your current compensation structure and notice period.`;
        } else if (topUnresolved.includes('Interview')) {
          suggestedOpening = `Hi ${candidate.name}, Arjun from White Collar Realty. We reviewed your profile for the ${role} role and would like to invite you for a face-to-face round at our Sector 67 Gurugram HQ. Do you have a quick moment to lock in a slot?`;
        }
      }
    }

    const concerns = memory?.concerns.map((c) => c.concern) || [];
    const questionsToAddress = memory?.candidateQuestions.filter((q) => !q.answered).map((q) => q.question) || [];

    // Retrieve latest candidate communication & behavior intelligence (Rules 30, 31, 32)
    const latestBehavior = behaviorRepository.getLatestBehaviorReport(candidate.id);
    const adaptiveDirectives: string[] = [];

    if (latestBehavior) {
      if (latestBehavior.adaptiveRecommendations?.guidance) {
        adaptiveDirectives.push(latestBehavior.adaptiveRecommendations.guidance);
      }
      if (latestBehavior.communicationStyle.isBrief) {
        adaptiveDirectives.push('Candidate communicates concisely: keep questions direct and avoid lengthy preamble.');
      } else if (latestBehavior.communicationStyle.isDetailed) {
        adaptiveDirectives.push('Candidate provides detailed answers: allow conversational space for real estate examples.');
      }
      if (latestBehavior.conversationSignals.impatience.level !== 'NONE') {
        adaptiveDirectives.push('Candidate previously noted time constraints: prioritize essential screening milestones and slot booking.');
      }
      if (latestBehavior.conversationSignals.interruptions.classification === 'problematic interruption') {
        adaptiveDirectives.push('Candidate may interrupt before questions finish: use shorter speech turns and yield quickly.');
      }
    }

    const brief: NextCallBrief = {
      candidateId: candidate.id,
      candidateName: candidate.name,
      appliedRole: role,
      summaryOfPreviousInteractions:
        previousCalls.length > 0
          ? `${previousCalls.length} previous calls logged. Last call outcome: ${previousCalls[0].outcome || 'Completed'}.`
          : 'First outbound screening interaction.',
      lastInteractionTimestamp: previousCalls.length > 0 ? previousCalls[0].timestamp : new Date().toISOString(),
      alreadyDiscussedTopics: alreadyDiscussed,
      verifiedInformationSummary: verifiedSummary,
      unresolvedTopics: unresolved,
      forbiddenRepeatQuestions: forbiddenQuestions,
      candidateConcerns: concerns,
      candidateQuestionsToAddress: questionsToAddress,
      communicationPreferences: {
        language: latestBehavior?.candidatePreferences?.language || memory?.communicationPreferences?.preferredLanguage || 'Auto (Hinglish/Hindi/English)',
        responseStyle: latestBehavior?.candidatePreferences?.responseStyle || memory?.communicationPreferences?.communicationStyle || 'conversational',
        preferredTimeWindow: latestBehavior?.candidatePreferences?.preferredTime || memory?.communicationPreferences?.bestTimeToCall,
      },
      observedBehaviorSummary: latestBehavior?.communicationStyle?.summary,
      adaptiveConversationDirectives: adaptiveDirectives.length > 0 ? adaptiveDirectives : undefined,
      behaviorTrend: latestBehavior?.behaviorTrend?.trendDescription,
      humanReviewFlagged: latestBehavior?.humanReviewRequired,
      previousPromises: memory?.candidateSpecificLearnings || [],
      callbackRequestDetails: memory?.communicationPreferences?.preferredCallbackWindow
        ? { requestedTime: memory.communicationPreferences.preferredCallbackWindow }
        : undefined,
      interviewState: memory?.interviewAvailability?.agreedSlot?.value ? 'Slot Booked' : 'Not Scheduled',
      recommendedStartingTopic: startingTopic,
      suggestedOpeningStatement: suggestedOpening,
      targetScenariosToEvaluate: ['sc-hni-discount', 'sc-site-visit-no-show'],
      contradictionsRequiringClarification,
    };

    return brief;
  }
}

export const decisionEngine = new DecisionEngine();
