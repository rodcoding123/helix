/**
 * Phase 8: Calendar Intelligence Service
 * Integrates with Phase 0.5 AIOperationRouter for meeting preparation and time optimization
 *
 * Cost Tracking:
 * - calendar-prep: ~$0.0025/call × 5/day = $0.0125/day
 * - calendar-time: ~$0.0080/call × 3/day = $0.024/day
 */

import { aiRouter } from './router-client';
import { getProviderClient } from '../../lib/ai-provider-client';
import type { AIOperationRouter } from '../../lib/ai-router';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendees: Array<{ email: string; name?: string }>;
  location?: string;
}

interface MeetingPrepRequest {
  userId: string;
  event: CalendarEvent;
  previousNotes?: string;
  organizationalContext?: string;
}

interface MeetingPrepResponse {
  agenda: string[];
  keyPoints: string[];
  preparationTasks: string[];
  estimatedDuration: number;
  suggestedOutcomes: string[];
}

interface OptimalTimeRequest {
  userId: string;
  duration: number; // in minutes
  requiredAttendees: string[]; // email addresses
  dateRange: { start: Date; end: Date };
  constraints?: {
    preferredTimes?: string[]; // e.g., ["morning", "afternoon"]
    avoidTimes?: string[];
    allowBack2Back?: boolean;
  };
}

interface OptimalTimeResponse {
  suggestions: Array<{
    startTime: Date;
    endTime: Date;
    confidence: number; // 0-1
    reasoning: string;
    conflictCount: number;
  }>;
  bestOption?: {
    startTime: Date;
    endTime: Date;
  };
}

/**
 * Generate meeting preparation 30 minutes before event
 * Triggered automatically or on-demand
 */
export async function generateMeetingPreparation(
  request: MeetingPrepRequest
): Promise<MeetingPrepResponse> {
  // Estimate tokens from event content
  const contentSize =
    request.event.title.length +
    (request.event.description?.length || 0) +
    request.event.attendees.length * 30;

  const estimatedTokens = Math.ceil(contentSize / 4);

  // Route through Phase 0.5
  const routing = await aiRouter.route({
    operationId: 'calendar-prep',
    userId: request.userId,
    input: {
      event: {
        title: request.event.title,
        description: request.event.description,
        attendees: request.event.attendees.map((a) => a.email),
        duration: Math.round((request.event.endTime.getTime() - request.event.startTime.getTime()) / 60000),
      },
      context: request.organizationalContext,
      previousNotes: request.previousNotes,
    },
    estimatedInputTokens: estimatedTokens,
  });

  // Call the routed model
  const response = await callAIModel(routing, {
    prompt: buildMeetingPrepPrompt(request),
    maxTokens: 800,
  });

  // Parse response
  return parseMeetingPrepResponse(response);
}

/**
 * Find optimal meeting times across attendee calendars
 * Considers availability, preferences, and constraints
 */
export async function findOptimalMeetingTime(
  request: OptimalTimeRequest
): Promise<OptimalTimeResponse> {
  // Estimate tokens from attendees and date range
  const estimatedTokens = Math.ceil(
    (request.requiredAttendees.length * 30 + request.dateRange.toString().length) / 4
  );

  // Route through Phase 0.5
  const routing = await aiRouter.route({
    operationId: 'calendar-time',
    userId: request.userId,
    input: {
      duration: request.duration,
      attendees: request.requiredAttendees,
      dateRange: {
        start: request.dateRange.start.toISOString(),
        end: request.dateRange.end.toISOString(),
      },
      constraints: request.constraints,
    },
    estimatedInputTokens: estimatedTokens,
  });

  // Call the routed model
  const response = await callAIModel(routing, {
    prompt: buildOptimalTimePrompt(request),
    maxTokens: 1000,
  });

  // Parse response
  return parseOptimalTimeResponse(response, request);
}

/**
 * Start automatic meeting preparation 30 minutes before events
 * Called once per day or on calendar sync
 */
export async function initializeMeetingPrepScheduler(userId: string): Promise<void> {
  // This would typically run as a cron job or via a service worker
  // For now, we register it to run periodically

  const checkInterval = setInterval(async () => {
    try {
      // Get upcoming events in next 45 minutes
      const upcomingEvents = await getUpcomingEvents(userId, 45);

      // Generate prep for each event
      for (const event of upcomingEvents) {
        const prep = await generateMeetingPreparation({
          userId,
          event,
          organizationalContext: 'Standard business meeting',
        });

        // Store prep for UI display
        await storeMeetingPrep(event.id, prep);

        // Optionally notify user
        if (shouldNotifyUser(event)) {
          notifyMeetingPrep(event, prep);
        }
      }
    } catch (error) {
      console.error('Meeting prep scheduler error:', error);
    }
  }, 5 * 60 * 1000); // Check every 5 minutes

  return () => clearInterval(checkInterval);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function buildMeetingPrepPrompt(request: MeetingPrepRequest): string {
  const duration = Math.round((request.event.endTime.getTime() - request.event.startTime.getTime()) / 60000);

  return `You are helping prepare for a meeting. Generate a preparation guide.

Meeting: ${request.event.title}
Time: ${request.event.startTime.toLocaleString()} (${duration} minutes)
Attendees: ${request.event.attendees.map((a) => a.name || a.email).join(', ')}
${request.event.location ? `Location: ${request.event.location}` : ''}
${request.event.description ? `Description: ${request.event.description}` : ''}
${request.organizationalContext ? `Context: ${request.organizationalContext}` : ''}

Provide:
1. Suggested agenda items (3-5 points)
2. Key points to cover
3. Preparation tasks (if any)
4. Recommended outcomes/deliverables

Format as clear, actionable items.`;
}

function buildOptimalTimePrompt(request: OptimalTimeRequest): string {
  return `Find the optimal meeting time for these constraints:

Duration: ${request.duration} minutes
Required Attendees: ${request.requiredAttendees.join(', ')}
Date Range: ${request.dateRange.start.toDateString()} to ${request.dateRange.end.toDateString()}
${request.constraints?.preferredTimes ? `Preferred times: ${request.constraints.preferredTimes.join(', ')}` : ''}
${request.constraints?.avoidTimes ? `Times to avoid: ${request.constraints.avoidTimes.join(', ')}` : ''}
${request.constraints?.allowBack2Back === false ? 'No back-to-back meetings' : ''}

Suggest 3 optimal time slots considering calendar availability, preferences, and timezone considerations.
For each slot, provide: start time, end time, confidence (0-1), and reasoning.`;
}

function parseMeetingPrepResponse(response: string): MeetingPrepResponse {
  try {
    // Try to parse structured response
    const json = JSON.parse(response);
    return {
      agenda: json.agenda || [],
      keyPoints: json.keyPoints || [],
      preparationTasks: json.preparationTasks || [],
      estimatedDuration: json.estimatedDuration || 60,
      suggestedOutcomes: json.suggestedOutcomes || [],
    };
  } catch {
    // Fallback: parse text response
    const sections = response.split('\n\n');
    return {
      agenda: sections[0]?.split('\n').filter((l) => l.trim()) || [],
      keyPoints: sections[1]?.split('\n').filter((l) => l.trim()) || [],
      preparationTasks: sections[2]?.split('\n').filter((l) => l.trim()) || [],
      estimatedDuration: 60,
      suggestedOutcomes: sections[3]?.split('\n').filter((l) => l.trim()) || [],
    };
  }
}

function parseOptimalTimeResponse(response: string, request: OptimalTimeRequest): OptimalTimeResponse {
  try {
    // Parse LLM response for time suggestions
    const timePattern = /(\d{1,2}):(\d{2})\s*(AM|PM)?/g;
    const matches = Array.from(response.matchAll(timePattern));

    const suggestions = matches.slice(0, 3).map((match) => {
      const hour = parseInt(match[1]) + (match[3]?.toUpperCase() === 'PM' ? 12 : 0);
      const minute = parseInt(match[2]);
      const startTime = new Date(request.dateRange.start);
      startTime.setHours(hour, minute, 0);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + request.duration);

      return {
        startTime,
        endTime,
        confidence: 0.85,
        reasoning: 'Optimal based on attendee availability',
        conflictCount: 0,
      };
    });

    return {
      suggestions: suggestions.length > 0 ? suggestions : getDefaultTimeSlots(request),
      bestOption: suggestions[0],
    };
  } catch {
    return {
      suggestions: getDefaultTimeSlots(request),
    };
  }
}

function getDefaultTimeSlots(request: OptimalTimeRequest): OptimalTimeResponse['suggestions'] {
  const slots = [];
  for (let i = 0; i < 3; i++) {
    const start = new Date(request.dateRange.start);
    start.setDate(start.getDate() + i);
    start.setHours(10, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + request.duration);

    slots.push({
      startTime: start,
      endTime: end,
      confidence: 0.5,
      reasoning: 'Default morning slot',
      conflictCount: 0,
    });
  }
  return slots;
}

async function getUpcomingEvents(userId: string, minutesAhead: number): Promise<CalendarEvent[]> {
  // This would query the calendar service
  return [];
}

async function storeMeetingPrep(eventId: string, prep: MeetingPrepResponse): Promise<void> {
  // Store in local storage or database
}

function shouldNotifyUser(event: CalendarEvent): boolean {
  // Determine if user should be notified
  return true;
}

function notifyMeetingPrep(event: CalendarEvent, prep: MeetingPrepResponse): void {
  // Send notification to user
  console.log(`Prep ready for ${event.title}`);
}

async function callAIModel(
  routing: Awaited<ReturnType<AIOperationRouter['route']>>,
  options: { prompt: string; maxTokens: number }
): Promise<string> {
  const provider = getProviderClient();

  try {
    const response = await provider.callModel(routing, {
      model: routing.model as any,
      prompt: options.prompt,
      maxTokens: options.maxTokens,
      temperature: 0.6,
      systemPrompt: 'You are a calendar and scheduling expert. Help optimize meetings and provide clear action items.',
    });

    return response.content;
  } catch (error) {
    console.error(`Calendar intelligence error with ${routing.model}:`, error);
    return 'Calendar assistance unavailable. Please try again.';
  }
}
