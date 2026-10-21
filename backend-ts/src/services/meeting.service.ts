import { PrismaClient, Meeting } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  expandMeetingIdentifiers,
  MeetingIdentifiers as SharedMeetingIdentifiers,
} from '../utils/idConversion';

const prisma = new PrismaClient();

/**
 * Meeting identifiers that can be used to find or create a meeting.
 * Any combination of these can identify the same meeting.
 */
export interface MeetingIdentifiers {
  meetingId?: string;
  calendarEventId?: string;
  onlineMeetingId?: string;
  icalUid?: string;
}

/**
 * Data for creating or updating a meeting
 */
export interface MeetingData {
  title?: string;
  meetingDate?: Date;
  durationMinutes?: number;
  notes?: string;
  dealId?: string;
  accountId?: string;
}

/**
 * Expand identifiers to include all possible format conversions.
 * This handles iCal UID format mismatches (hex vs base64).
 * Uses shared utility from utils/idConversion.ts
 */
function expandIdentifiers(identifiers: MeetingIdentifiers): string[] {
  return expandMeetingIdentifiers(identifiers);
}

/**
 * MeetingService - Centralized service for all meeting operations.
 *
 * GUARANTEES:
 * 1. No duplicate meetings will be created for the same calendar event
 * 2. All 4 ID formats are checked when finding meetings
 * 3. ID format conversions (hex/base64) are handled automatically
 * 4. Meeting data is merged intelligently (new data fills gaps, doesn't overwrite)
 */
export const MeetingService = {
  /**
   * Find an existing meeting by any combination of identifiers.
   * Handles hex/base64 format conversions automatically.
   */
  async findByIdentifiers(identifiers: MeetingIdentifiers): Promise<Meeting | null> {
    const expandedIds = expandIdentifiers(identifiers);

    if (expandedIds.length === 0) {
      return null;
    }

    return prisma.meeting.findFirst({
      where: {
        OR: [
          { meetingId: { in: expandedIds } },
          { calendarEventId: { in: expandedIds } },
          { onlineMeetingId: { in: expandedIds } },
          { icalUid: { in: expandedIds } },
        ],
      },
    });
  },

  /**
   * Find or create a meeting. This is the PRIMARY method for getting a meeting reference.
   *
   * - If a meeting exists with any of the provided identifiers, returns it (optionally updated)
   * - If no meeting exists, creates a new one
   *
   * @param identifiers - Any combination of meeting IDs
   * @param data - Meeting data (used for creation or optional update)
   * @param updateIfExists - If true, updates existing meeting with provided data
   */
  async findOrCreate(
    identifiers: MeetingIdentifiers,
    data: MeetingData = {},
    updateIfExists: boolean = false
  ): Promise<{ meeting: Meeting; created: boolean }> {
    // First, try to find existing meeting
    const existing = await this.findByIdentifiers(identifiers);

    if (existing) {
      if (updateIfExists) {
        // Update with new data (only fill in missing fields by default)
        const updated = await prisma.meeting.update({
          where: { meetingId: existing.meetingId },
          data: {
            // Only update if current value is null/empty
            title: data.title && !existing.title ? data.title : undefined,
            meetingDate: data.meetingDate && !existing.meetingDate ? data.meetingDate : undefined,
            durationMinutes: data.durationMinutes && !existing.durationMinutes ? data.durationMinutes : undefined,
            notes: data.notes && !existing.notes ? data.notes : undefined,
            // Always update these if provided (they represent current state)
            dealId: data.dealId ?? undefined,
            accountId: data.accountId ?? undefined,
            // Fill in missing identifiers
            calendarEventId: identifiers.calendarEventId && !existing.calendarEventId
              ? identifiers.calendarEventId : undefined,
            onlineMeetingId: identifiers.onlineMeetingId && !existing.onlineMeetingId
              ? identifiers.onlineMeetingId : undefined,
            icalUid: identifiers.icalUid && !existing.icalUid
              ? identifiers.icalUid : undefined,
          },
        });
        return { meeting: updated, created: false };
      }
      return { meeting: existing, created: false };
    }

    // Create new meeting
    const meetingId = identifiers.meetingId || randomUUID();

    const created = await prisma.meeting.create({
      data: {
        meetingId,
        calendarEventId: identifiers.calendarEventId || meetingId,
        onlineMeetingId: identifiers.onlineMeetingId || null,
        icalUid: identifiers.icalUid || null,
        title: data.title || 'Untitled Meeting',
        meetingDate: data.meetingDate || null,
        durationMinutes: data.durationMinutes || null,
        notes: data.notes || null,
        dealId: data.dealId || null,
        accountId: data.accountId || null,
      },
    });

    return { meeting: created, created: true };
  },

  /**
   * Link a meeting to a deal and account.
   * Finds the meeting by any identifier and updates the link.
   */
  async linkToDeal(
    identifiers: MeetingIdentifiers,
    dealId: string,
    accountId?: string
  ): Promise<Meeting | null> {
    const meeting = await this.findByIdentifiers(identifiers);

    if (!meeting) {
      return null;
    }

    return prisma.meeting.update({
      where: { meetingId: meeting.meetingId },
      data: {
        dealId,
        accountId: accountId || meeting.accountId,
      },
    });
  },

  /**
   * Get the canonical meeting ID for a given identifier.
   * Useful when you need to store a reference to a meeting.
   */
  async getCanonicalId(identifier: string): Promise<string | null> {
    const meeting = await this.findByIdentifiers({
      meetingId: identifier,
      calendarEventId: identifier,
      onlineMeetingId: identifier,
      icalUid: identifier,
    });

    return meeting?.meetingId || null;
  },

  /**
   * Find all meetings for a deal
   */
  async findByDealId(dealId: string): Promise<Meeting[]> {
    return prisma.meeting.findMany({
      where: { dealId },
      orderBy: { meetingDate: 'desc' },
    });
  },

  /**
   * Find all meetings for an account
   */
  async findByAccountId(accountId: string): Promise<Meeting[]> {
    return prisma.meeting.findMany({
      where: { accountId },
      orderBy: { meetingDate: 'desc' },
    });
  },
};

export default MeetingService;
