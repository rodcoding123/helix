/**
 * Smart Scheduling Service - Phase 7 Track 3
 * Finds optimal meeting times across multiple attendee calendars
 */

import { supabase } from '@/lib/supabase';
import { logToDiscord } from '@/helix/logging';
import type { TimeSlot, SchedulingSuggestion } from './automation.types.js';

interface CalendarEvent {
  start: Date;
  end: Date;
  busy: boolean;
}

interface SchedulingParams {
  attendeeEmails: string[];
  duration: number; // minutes
  dateRange: { start: Date; end: Date };
  preferences?: {
    preferredTimes?: { start: string; end: string };
    avoidTimes?: { start: string; end: string }[];
    timezone?: string;
  };
}

export class SmartSchedulingService {
  private static instance: SmartSchedulingService;

  private constructor() {}

  static getInstance(): SmartSchedulingService {
    if (!SmartSchedulingService.instance) {
      SmartSchedulingService.instance = new SmartSchedulingService();
    }
    return SmartSchedulingService.instance;
  }

  /**
   * Find best meeting times for all attendees
   */
  async findBestMeetingTimes(params: SchedulingParams): Promise<TimeSlot[]> {
    try {
      // Get calendars for all attendees
      const calendars = await this.getAttendeesCalendars(params.attendeeEmails, params.dateRange);

      // Calculate free slots
      const freeSlots = this.calculateFreeSlots(
        calendars,
        params.duration,
        params.dateRange,
        params.preferences
      );

      // Score and sort
      const scoredSlots = freeSlots.map((slot) =>
        this.scoreTimeSlot(slot, params.attendeeEmails.length, params.preferences)
      );

      const sortedSlots = scoredSlots.sort((a, b) => (b.score || 0) - (a.score || 0));

      // Log to Discord
      await logToDiscord({
        channel: 'helix-automation',
        type: 'smart_scheduling_calculated',
        attendeeCount: params.attendeeEmails.length,
        suggestionsGenerated: sortedSlots.length,
        topScore: sortedSlots[0]?.score,
        timestamp: new Date().toISOString(),
      });

      return sortedSlots.slice(0, 5); // Return top 5
    } catch (error) {
      await logToDiscord({
        channel: 'helix-alerts',
        type: 'smart_scheduling_failed',
        error: String(error),
        attendeeCount: params.attendeeEmails.length,
      });
      throw error;
    }
  }

  /**
   * Get calendars for attendees
   */
  private async getAttendeesCalendars(
    emails: string[],
    dateRange: { start: Date; end: Date }
  ): Promise<CalendarEvent[][]> {
    const calendars: CalendarEvent[][] = [];

    for (const email of emails) {
      try {
        const { data, error } = await supabase
          .from('calendar_events')
          .select('*')
          .eq('attendee_email', email)
          .gte('start_time', dateRange.start.toISOString())
          .lte('start_time', dateRange.end.toISOString());

        if (error || !data) {
          calendars.push([]);
          continue;
        }

        calendars.push(
          data.map((event) => ({
            start: new Date(event.start_time),
            end: new Date(event.end_time),
            busy: !event.is_free_time,
          }))
        );
      } catch (error) {
        calendars.push([]);
      }
    }

    return calendars;
  }

  /**
   * Calculate free slots across all attendees
   */
  private calculateFreeSlots(
    calendars: CalendarEvent[][],
    durationMinutes: number,
    dateRange: { start: Date; end: Date },
    preferences?: {
      preferredTimes?: { start: string; end: string };
      avoidTimes?: { start: string; end: string }[];
    }
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const slotDuration = durationMinutes * 60 * 1000; // Convert to ms

    // Generate candidate slots (30-minute intervals)
    let current = new Date(dateRange.start);
    while (current < dateRange.end) {
      const slotEnd = new Date(current.getTime() + slotDuration);

      if (slotEnd > dateRange.end) {
        break;
      }

      // Check if slot is free for all attendees
      let isFree = true;
      for (const calendar of calendars) {
        if (this.hasConflict(calendar, current, slotEnd)) {
          isFree = false;
          break;
        }
      }

      if (isFree) {
        slots.push({
          start: new Date(current),
          end: new Date(slotEnd),
          attendeeCount: calendars.length,
          score: 0, // To be calculated later
        });
      }

      // Move to next 30-minute slot
      current = new Date(current.getTime() + 30 * 60 * 1000);
    }

    return slots;
  }

  /**
   * Check if time slot has conflicts
   */
  private hasConflict(events: CalendarEvent[], start: Date, end: Date): boolean {
    for (const event of events) {
      // Check if slot overlaps with event
      if (event.busy && start < event.end && end > event.start) {
        return true;
      }
    }
    return false;
  }

  /**
   * Score a time slot based on multiple factors
   */
  private scoreTimeSlot(
    slot: TimeSlot,
    attendeeCount: number,
    preferences?: {
      preferredTimes?: { start: string; end: string };
      timezone?: string;
    }
  ): TimeSlot {
    let score = 50; // Base score

    const hour = slot.start.getHours();
    const day = slot.start.getDay();

    // Time of day scoring
    if (hour >= 9 && hour < 11) {
      score += 20; // Morning preference
    } else if (hour >= 12 && hour < 13) {
      score -= 30; // Lunch penalty
    } else if (hour >= 13 && hour < 15) {
      score -= 15; // Post-lunch dip
    } else if (hour >= 15 && hour < 17) {
      score += 10; // Afternoon recovery
    } else if (hour >= 17) {
      score -= 25; // End of day penalty
    }

    // Day of week scoring
    if (day === 0 || day === 6) {
      score -= 50; // Weekend
    } else if (day === 1) {
      score -= 5; // Monday
    } else if (day === 3) {
      score += 10; // Wednesday (mid-week focus)
    } else if (day === 5) {
      score -= 10; // Friday
    }

    // Attendee count penalty (larger meetings get harder to schedule)
    if (attendeeCount > 5) {
      score -= (attendeeCount - 5) * 2;
    }

    // Preference matching
    if (
      preferences?.preferredTimes &&
      this.isInTimeRange(hour, preferences.preferredTimes)
    ) {
      score += 15;
    }

    // Avoid times
    if (
      preferences?.preferredTimes &&
      this.isInTimeRange(hour, preferences.preferredTimes)
    ) {
      score -= 20;
    }

    return {
      ...slot,
      score: Math.max(0, Math.min(100, score)),
      scoreBreakdown: {
        timeOfDayScore: this.scoreTimeOfDay(hour),
        dayOfWeekScore: this.scoreDayOfWeek(day),
        attendeeAvailabilityScore: 30,
        preferenceScore: this.scorePreferences(hour, preferences),
      },
    };
  }

  /**
   * Score time of day
   */
  private scoreTimeOfDay(hour: number): number {
    if (hour >= 9 && hour < 11) return 20;
    if (hour >= 12 && hour < 13) return -30;
    if (hour >= 13 && hour < 15) return -15;
    if (hour >= 15 && hour < 17) return 10;
    if (hour >= 17) return -25;
    return 0;
  }

  /**
   * Score day of week
   */
  private scoreDayOfWeek(day: number): number {
    if (day === 0 || day === 6) return -50;
    if (day === 1) return -5;
    if (day === 3) return 10;
    if (day === 5) return -10;
    return 5;
  }

  /**
   * Score preferences
   */
  private scorePreferences(
    hour: number,
    preferences?: {
      preferredTimes?: { start: string; end: string };
    }
  ): number {
    if (!preferences?.preferredTimes) {
      return 0;
    }

    if (this.isInTimeRange(hour, preferences.preferredTimes)) {
      return 25;
    }

    return -10;
  }

  /**
   * Check if hour is in time range
   */
  private isInTimeRange(
    hour: number,
    timeRange: { start: string; end: string }
  ): boolean {
    const [startHour] = timeRange.start.split(':').map(Number);
    const [endHour] = timeRange.end.split(':').map(Number);
    return hour >= startHour && hour < endHour;
  }

  /**
   * Get scheduling suggestion
   */
  async getSuggestion(params: SchedulingParams): Promise<SchedulingSuggestion | null> {
    try {
      const slots = await this.findBestMeetingTimes(params);

      if (slots.length === 0) {
        return null;
      }

      return {
        attendeeEmails: params.attendeeEmails,
        duration: params.duration,
        suggestedSlots: slots,
        bestSlot: slots[0],
        timezone: params.preferences?.timezone || 'UTC',
        createdAt: new Date(),
      };
    } catch (error) {
      console.error('Failed to get scheduling suggestion:', error);
      return null;
    }
  }
}

export function getSmartSchedulingService(): SmartSchedulingService {
  return SmartSchedulingService.getInstance();
}
