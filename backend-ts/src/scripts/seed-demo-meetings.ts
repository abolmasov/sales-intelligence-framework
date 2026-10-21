/**
 * Seed demo accounts, meetings, and a sample transcript for local portfolio demos.
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

const DEMO_TRANSCRIPT_PATH = join(
  __dirname,
  '../../sample-data/demo-discovery-transcript.txt'
);

const demoMeetings = [
  {
    company: 'NovaPay Systems',
    domain: 'novapay.example',
    title: 'NovaPay — Platform modernization discovery',
    attendees: [
      { name: 'Alex Rivera', email: 'alex.rivera@novapay.example', role: 'VP Engineering' },
      { name: 'Jordan Lee', email: 'jordan.lee@novapay.example', role: 'Director, IT Operations' },
    ],
    daysFromNow: 2,
    duration: 60,
    bodyPreview:
      'Discovery on engineering velocity, ITSM modernization, and AI-assisted service desk goals.',
  },
  {
    company: 'Helios Analytics',
    domain: 'helios.example',
    title: 'Helios — AI operating model workshop prep',
    attendees: [
      { name: 'Sam Ortiz', email: 'sam.ortiz@helios.example', role: 'Chief Product Officer' },
      { name: 'Taylor Kim', email: 'taylor.kim@helios.example', role: 'Head of Platform' },
    ],
    daysFromNow: 5,
    duration: 45,
    bodyPreview: 'Pre-workshop call on AI governance, internal knowledge discovery, and roadmap alignment.',
  },
  {
    company: 'Meridian Retail Group',
    domain: 'meridian.example',
    title: 'Meridian — Post-discovery follow-up (transcript sample)',
    attendees: [
      { name: 'Casey Morgan', email: 'casey.morgan@meridian.example', role: 'SVP Technology' },
      { name: 'Riley Chen', email: 'riley.chen@meridian.example', role: 'IT Service Manager' },
    ],
    daysFromNow: -3,
    duration: 60,
    bodyPreview: 'Follow-up on ITSM automation, self-service, and phased AI enablement.',
    hasTranscript: true,
  },
];

async function seedDemoMeetings() {
  console.log('Seeding demo meetings...\n');

  const userId = 'demo-user-001';
  let transcriptTemplate = '';
  try {
    transcriptTemplate = readFileSync(DEMO_TRANSCRIPT_PATH, 'utf-8');
  } catch {
    transcriptTemplate =
      '[00:00:10] Prospect: We need a phased plan for ITSM automation and better routing.\n[00:01:00] SI Rep: Understood — let us align on outcomes and timeline.';
  }

  await prisma.user.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      username: 'demo',
      email: 'demo.user@example.com',
      fullName: 'Demo User',
    },
  });

  for (const meeting of demoMeetings) {
    const eventId = `demo-event-${meeting.company.toLowerCase().replace(/\s+/g, '-')}`;
    const meetingId = `demo-meeting-${meeting.company.toLowerCase().replace(/\s+/g, '-')}`;
    const onlineMeetingId = `demo-teams-${uuidv4()}`;

    const meetingDate = new Date();
    meetingDate.setDate(meetingDate.getDate() + meeting.daysFromNow);
    meetingDate.setHours(10, 0, 0, 0);

    const endDate = new Date(meetingDate);
    endDate.setMinutes(endDate.getMinutes() + meeting.duration);

    const transcript = meeting.hasTranscript ? transcriptTemplate : undefined;

    await prisma.userCalendarMeeting.upsert({
      where: { userId_eventId: { userId, eventId } },
      update: {
        subject: meeting.title,
        startUtc: meetingDate,
        endUtc: endDate,
        bodyPreview: meeting.bodyPreview,
        transcriptAvailable: Boolean(meeting.hasTranscript),
        externalAttendees: meeting.attendees.map((a) => ({
          name: a.name,
          email: a.email,
          type: 'required',
          status: 'accepted',
        })),
        internalAttendees: [
          {
            name: 'Demo Seller',
            email: 'seller@example.com',
            type: 'organizer',
            status: 'accepted',
          },
        ],
      },
      create: {
        userId,
        eventId,
        onlineMeetingId,
        icalUid: `ical-${eventId}`,
        subject: meeting.title,
        startUtc: meetingDate,
        endUtc: endDate,
        bodyPreview: meeting.bodyPreview,
        location: 'Microsoft Teams Meeting',
        joinUrl: 'https://teams.microsoft.com/l/meetup-join/demo',
        transcriptAvailable: Boolean(meeting.hasTranscript),
        externalAttendees: meeting.attendees.map((a) => ({
          name: a.name,
          email: a.email,
          type: 'required',
          status: 'accepted',
        })),
        internalAttendees: [
          {
            name: 'Demo Seller',
            email: 'seller@example.com',
            type: 'organizer',
            status: 'accepted',
          },
        ],
      },
    });

    const accountId = `account-${meeting.company.toLowerCase().replace(/\s+/g, '-')}`;
    await prisma.account.upsert({
      where: { accountId },
      update: {},
      create: {
        accountId,
        name: meeting.company,
        domain: meeting.domain,
        industry: 'Technology',
        type: 'Prospect',
      },
    });

    await prisma.meeting.upsert({
      where: { meetingId },
      update: {
        title: meeting.title,
        meetingDate,
        durationMinutes: meeting.duration,
        transcript: transcript || null,
        onlineMeetingId,
        icalUid: `ical-${eventId}`,
      },
      create: {
        meetingId,
        accountId,
        title: meeting.title,
        meetingDate,
        durationMinutes: meeting.duration,
        externalAttendees: JSON.stringify(meeting.attendees),
        internalAttendees: JSON.stringify([
          { name: 'Demo Seller', email: 'seller@example.com' },
        ]),
        transcript: transcript || null,
        onlineMeetingId,
        icalUid: `ical-${eventId}`,
        calendarEventId: eventId,
      },
    });

    if (meeting.hasTranscript && transcript) {
      const existingAnalysis = await prisma.transcriptAnalysis.findFirst({
        where: { meetingId },
      });
      if (!existingAnalysis) {
        await prisma.transcriptAnalysis.create({
          data: {
            analysisId: `transcript-analysis-${uuidv4()}`,
            meetingId,
            accountId,
            companyName: meeting.company,
            meetingTitle: meeting.title,
            status: 'completed',
            transcriptText: transcript,
            analysisResult: JSON.stringify({
              summary: 'Demo analysis seeded for portfolio walkthrough.',
              actionItems: ['Send phased roadmap', 'Schedule technical deep dive'],
            }),
          },
        });
      }
    }

    console.log(`Seeded: ${meeting.title}`);
  }

  console.log('\nDemo seed complete.');
}

seedDemoMeetings()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
