import { format, addDays, startOfWeek } from '../utils/dateHelpers';

export type StageStatus = 'not_started' | 'in_progress' | 'completed';

export interface PipelineStage {
  id: 'precall' | 'postcall' | 'proposal' | 'deck';
  label: string;
  description: string;
}

export interface Meeting {
  id: string;
  title: string;
  accountId: string;
  accountName: string;
  date: string;
  start: string;
  end: string;
  location: string;
  channel: 'Teams' | 'Zoom' | 'Onsite';
  preCallDone: boolean;
  postCallDone: boolean;
  proposalGenerated: boolean;
  attendees: Array<{
    name: string;
    title: string;
  }>;
  notes?: string;
}

export interface PreCallBrief {
  id: string;
  meetingId?: string;
  title: string;
  createdBy: string;
  createdAt: string;
  confidence: number;
  summary: string;
}

export interface PostCallAnalysis {
  id: string;
  meetingId: string;
  meetingTitle: string;
  accountId: string;
  accountName: string;
  date: string;
  opportunityScore: number;
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  successProbability: number;
  summary: string;
}

export interface Proposal {
  id: string;
  accountId: string;
  name: string;
  status: 'Draft' | 'Sent';
  createdAt: string;
  originatingAnalysisId: string;
  documentUrl?: string;
  deckUrl?: string;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  artifactLabel: string;
  artifactId: string;
}

export interface AccountRecord {
  id: string;
  name: string;
  domain: string;
  owner: string;
  industry: string;
  location?: string;
  stageStatus: {
    precall: StageStatus;
    postcall: StageStatus;
    proposal: StageStatus;
    deck: StageStatus;
  };
  metrics: {
    meetingsLast30: number;
    postCalls: number;
    proposals: number;
    decks: number;
  };
  summary: string;
  summaryUpdated: string;
  meetings: Meeting[];
  upcomingMeetings: Meeting[];
  preCallBriefs: PreCallBrief[];
  postCallAnalyses: PostCallAnalysis[];
  proposals: Proposal[];
  activity: ActivityEvent[];
}

export interface ResearchRecord {
  id: string;
  accountId: string;
  accountName: string;
  purpose: string;
  notes: string;
  createdAt: string;
  createdBy: string;
  externalAttendeeResearch?: Array<{
    name: string;
    company?: string;
    research?: string;
    summary?: string;
  }>;
}

export const pipelineStages: PipelineStage[] = [
  {
    id: 'precall',
    label: 'Pre-Call Research',
    description: 'Company intelligence, news, and talk tracks.',
  },
  {
    id: 'postcall',
    label: 'Post-Call Analysis',
    description: 'Transcript insights, sentiment, and pursuit brief.',
  },
  {
    id: 'proposal',
    label: 'Proposal / RFP',
    description: 'Tailored recommendations and commercial structure.',
  },
  {
    id: 'deck',
    label: 'Executive PPT',
    description: 'Client-ready storytelling assets.',
  },
];

const start = startOfWeek(new Date(), { weekStartsOn: 1 });

const uid = () => `mtg-${Math.random().toString(36).substring(2, 9)}`;

const buildMeeting = (overrides: Partial<Meeting>): Meeting => ({
  id: uid(),
  title: 'Enterprise Discovery',
  accountId: 'glean',
  accountName: 'Glean',
  date: format(start, 'yyyy-MM-dd'),
  start: '09:00',
  end: '10:00',
  location: 'Virtual',
  channel: 'Teams',
  preCallDone: true,
  postCallDone: false,
  proposalGenerated: false,
  attendees: [
    { name: 'Jordan Kim', title: 'AE' },
    { name: 'Priya Raman', title: 'VP Engineering' },
  ],
  notes: 'Discovery focus on AI-powered search roadmap.',
  ...overrides,
});

export const calendarMeetings: Meeting[] = [
  buildMeeting({
    id: 'meet-glean-1',
    title: 'Quarterly Value Review',
    date: format(addDays(start, 1), 'yyyy-MM-dd'),
    start: '10:00',
    end: '11:00',
    preCallDone: true,
    postCallDone: true,
    proposalGenerated: true,
    accountId: 'glean',
    accountName: 'Glean',
  }),
  buildMeeting({
    id: 'meet-northwind-1',
    title: 'Modernization Workshop',
    date: format(addDays(start, 2), 'yyyy-MM-dd'),
    start: '13:00',
    end: '14:30',
    accountId: 'northwind-bank',
    accountName: 'Northwind Bank',
    preCallDone: true,
    postCallDone: false,
    proposalGenerated: false,
    attendees: [
      { name: 'Amelia Wright', title: 'CIO' },
      { name: 'Marcus Hale', title: 'Digital Lead' },
    ],
  }),
  buildMeeting({
    id: 'meet-orbit-1',
    title: 'Executive Alignment',
    date: format(addDays(start, 3), 'yyyy-MM-dd'),
    start: '08:30',
    end: '09:15',
    accountId: 'orbit-robotics',
    accountName: 'Orbit Robotics',
    preCallDone: false,
    postCallDone: false,
    proposalGenerated: false,
    channel: 'Onsite',
  }),
  buildMeeting({
    id: 'meet-glean-2',
    title: 'RFP Clarifications',
    date: format(addDays(start, 4), 'yyyy-MM-dd'),
    start: '15:00',
    end: '16:00',
    accountId: 'glean',
    accountName: 'Glean',
    preCallDone: true,
    postCallDone: true,
    proposalGenerated: false,
    channel: 'Zoom',
    attendees: [
      { name: 'Jordan Kim', title: 'AE' },
      { name: 'Lena Brooks', title: 'Procurement' },
    ],
  }),
];

const sharedPreCalls: PreCallBrief[] = [
  {
    id: 'pc-glean-1',
    meetingId: 'meet-glean-1',
    title: 'AI Roadmap Deep Dive',
    createdBy: 'Jordan Kim',
    createdAt: format(addDays(new Date(), -4), 'yyyy-MM-dd'),
    confidence: 0.86,
    summary: 'Focus on consolidating internal search, highlight security hardening roadmap.',
  },
  {
    id: 'pc-northwind-1',
    meetingId: 'meet-northwind-1',
    title: 'Core Banking Modernization',
    createdBy: 'Alex Patel',
    createdAt: format(addDays(new Date(), -6), 'yyyy-MM-dd'),
    confidence: 0.78,
    summary: 'Northwind wants to reduce call-center AHT and digitize onboarding.',
  },
  {
    id: 'pc-orbit-1',
    meetingId: 'meet-orbit-1',
    title: 'Manufacturing Automation Vision',
    createdBy: 'Devon Lee',
    createdAt: format(addDays(new Date(), -2), 'yyyy-MM-dd'),
    confidence: 0.73,
    summary: 'Orbit needs robotics orchestration for new Kansas facility launch.',
  },
];

const sharedPostCalls: PostCallAnalysis[] = [
  {
    id: 'post-glean-1',
    meetingId: 'meet-glean-1',
    meetingTitle: 'Quarterly Value Review',
    accountId: 'glean',
    accountName: 'Glean',
    date: format(addDays(new Date(), -3), 'yyyy-MM-dd'),
    opportunityScore: 82,
    sentiment: 'Positive',
    successProbability: 74,
    summary: 'Lightweight renewal, upsell AI copilots and sandbox governance.',
  },
  {
    id: 'post-northwind-1',
    meetingId: 'meet-northwind-1',
    meetingTitle: 'Modernization Workshop',
    accountId: 'northwind-bank',
    accountName: 'Northwind Bank',
    date: format(addDays(new Date(), -1), 'yyyy-MM-dd'),
    opportunityScore: 68,
    sentiment: 'Neutral',
    successProbability: 55,
    summary: 'Need architecture doc plus SOC2 addendum before progressing.',
  },
  {
    id: 'post-glean-2',
    meetingId: 'meet-glean-2',
    meetingTitle: 'RFP Clarifications',
    accountId: 'glean',
    accountName: 'Glean',
    date: format(new Date(), 'yyyy-MM-dd'),
    opportunityScore: 77,
    sentiment: 'Positive',
    successProbability: 63,
    summary: 'Procurement comfortable; awaiting compliance redlines.',
  },
];

const sharedProposals: Proposal[] = [
  {
    id: 'prop-glean-1',
    accountId: 'glean',
    name: 'Glean Copilot Expansion',
    status: 'Sent',
    createdAt: format(addDays(new Date(), -2), 'yyyy-MM-dd'),
    originatingAnalysisId: 'post-glean-1',
    documentUrl: '#',
    deckUrl: '#',
  },
  {
    id: 'prop-northwind-1',
    accountId: 'northwind-bank',
    name: 'Northwind Modernization Sprint Plan',
    status: 'Draft',
    createdAt: format(addDays(new Date(), -1), 'yyyy-MM-dd'),
    originatingAnalysisId: 'post-northwind-1',
    documentUrl: '#',
    deckUrl: '#',
  },
];

export const accounts: AccountRecord[] = [
  {
    id: 'glean',
    name: 'Glean',
    domain: 'glean.com',
    owner: 'Jordan Kim',
    industry: 'SaaS / Search',
    stageStatus: {
      precall: 'completed',
      postcall: 'completed',
      proposal: 'in_progress',
      deck: 'not_started',
    },
    metrics: {
      meetingsLast30: 5,
      postCalls: 3,
      proposals: 2,
      decks: 1,
    },
    summary:
      'Glean is consolidating enterprise knowledge search and evaluating AI copilots for support teams.',
    summaryUpdated: format(addDays(new Date(), -1), 'PP'),
    meetings: calendarMeetings.filter((m) => m.accountId === 'glean'),
    upcomingMeetings: calendarMeetings.filter(
      (m) => m.accountId === 'glean' && new Date(m.date) >= new Date()
    ),
    preCallBriefs: sharedPreCalls.filter((p) => p.meetingId?.includes('glean')),
    postCallAnalyses: sharedPostCalls.filter((p) => p.accountId === 'glean'),
    proposals: sharedProposals.filter((p) => p.accountId === 'glean'),
    activity: [
      {
        id: 'activity-glean-1',
        timestamp: format(addDays(new Date(), -1), 'yyyy-MM-dd HH:mm'),
        user: 'Jordan Kim',
        action: 'Generated Post-Call analysis',
        artifactLabel: 'RFP Clarifications',
        artifactId: 'post-glean-2',
      },
      {
        id: 'activity-glean-2',
        timestamp: format(addDays(new Date(), -2), 'yyyy-MM-dd HH:mm'),
        user: 'Priya Raman',
        action: 'Shared proposal',
        artifactLabel: 'Copilot Expansion',
        artifactId: 'prop-glean-1',
      },
    ],
  },
  {
    id: 'northwind-bank',
    name: 'Northwind Bank',
    domain: 'northwindbank.com',
    owner: 'Alex Patel',
    industry: 'Financial Services',
    stageStatus: {
      precall: 'completed',
      postcall: 'in_progress',
      proposal: 'not_started',
      deck: 'not_started',
    },
    metrics: {
      meetingsLast30: 3,
      postCalls: 1,
      proposals: 1,
      decks: 0,
    },
    summary:
      'Regional bank migrating core banking to cloud-native services with new onboarding experiences.',
    summaryUpdated: format(addDays(new Date(), -2), 'PP'),
    meetings: calendarMeetings.filter((m) => m.accountId === 'northwind-bank'),
    upcomingMeetings: calendarMeetings.filter(
      (m) => m.accountId === 'northwind-bank' && new Date(m.date) >= new Date()
    ),
    preCallBriefs: sharedPreCalls.filter((p) => p.meetingId?.includes('northwind')),
    postCallAnalyses: sharedPostCalls.filter((p) => p.accountId === 'northwind-bank'),
    proposals: sharedProposals.filter((p) => p.accountId === 'northwind-bank'),
    activity: [
      {
        id: 'activity-northwind-1',
        timestamp: format(addDays(new Date(), -1), 'yyyy-MM-dd HH:mm'),
        user: 'Alex Patel',
        action: 'Ran post-call analysis',
        artifactLabel: 'Modernization Workshop',
        artifactId: 'post-northwind-1',
      },
    ],
  },
  {
    id: 'orbit-robotics',
    name: 'Orbit Robotics',
    domain: 'orbitrobotics.com',
    owner: 'Devon Lee',
    industry: 'Manufacturing',
    stageStatus: {
      precall: 'in_progress',
      postcall: 'not_started',
      proposal: 'not_started',
      deck: 'not_started',
    },
    metrics: {
      meetingsLast30: 2,
      postCalls: 0,
      proposals: 0,
      decks: 0,
    },
    summary:
      'Industrial automation firm launching new robotics orchestration platform for automotive lines.',
    summaryUpdated: format(addDays(new Date(), -5), 'PP'),
    meetings: calendarMeetings.filter((m) => m.accountId === 'orbit-robotics'),
    upcomingMeetings: calendarMeetings.filter(
      (m) => m.accountId === 'orbit-robotics' && new Date(m.date) >= new Date()
    ),
    preCallBriefs: sharedPreCalls.filter((p) => p.meetingId?.includes('orbit')),
    postCallAnalyses: sharedPostCalls.filter((p) => p.accountId === 'orbit-robotics'),
    proposals: sharedProposals.filter((p) => p.accountId === 'orbit-robotics'),
    activity: [
      {
        id: 'activity-orbit-1',
        timestamp: format(addDays(new Date(), -6), 'yyyy-MM-dd HH:mm'),
        user: 'Devon Lee',
        action: 'Started pre-call research',
        artifactLabel: 'Manufacturing Automation Vision',
        artifactId: 'pc-orbit-1',
      },
    ],
  },
];

export const recentResearch: ResearchRecord[] = [
  {
    id: 'res-glean-1',
    accountId: 'glean',
    accountName: 'Glean',
    purpose: 'Executive renewal alignment',
    notes: 'Focus on value delivered + AI expansion guardrails.',
    createdAt: format(addDays(new Date(), -2), 'PPpp'),
    createdBy: 'Jordan Kim',
    externalAttendeeResearch: [
      { name: 'Priya Raman', summary: 'VP Engineering; led rollout of AI search pilots across CS and Eng; previously at Atlassian.' },
      { name: 'Jordan Kim', summary: 'AE sponsor; focused on renewal success metrics and roadmap co-funding.' },
    ],
  },
  {
    id: 'res-northwind-1',
    accountId: 'northwind-bank',
    accountName: 'Northwind Bank',
    purpose: 'Digital onboarding follow-up',
    notes: 'Need AML/KYC differentiators ready.',
    createdAt: format(addDays(new Date(), -4), 'PPpp'),
    createdBy: 'Alex Patel',
    externalAttendeeResearch: [
      { name: 'Amelia Wright', summary: 'CIO; championing branchless onboarding; public talks on cloud risk posture.' },
    ],
  },
  {
    id: 'res-orbit-1',
    accountId: 'orbit-robotics',
    accountName: 'Orbit Robotics',
    purpose: 'Plant tour preparation',
    notes: 'Highlight supply-chain resilience case studies.',
    createdAt: format(addDays(new Date(), -1), 'PPpp'),
    createdBy: 'Devon Lee',
    externalAttendeeResearch: [
      { name: 'Marcus Hale', summary: 'Digital Lead; spearheading robotics orchestration; active in SCADA modernization forums.' },
    ],
  },
];

export const proposalOutlineSections = [
  {
    id: 'exec-summary',
    title: 'Executive Summary',
    description: 'Business context, objectives, and success criteria.',
    recommended: true,
  },
  {
    id: 'current-state',
    title: 'Current State Findings',
    description: 'Key insights from discovery and post-call analysis.',
    recommended: true,
  },
  {
    id: 'solution-approach',
    title: 'Solution Approach',
    description: 'Phased delivery plan, workstreams, and team.',
    recommended: true,
  },
  {
    id: 'commercials',
    title: 'Commercials & Timeline',
    description: 'Investment summary, timeline, assumptions.',
    recommended: true,
  },
  {
    id: 'risks',
    title: 'Risks & Dependencies',
    description: 'Known constraints, mitigation plan.',
    recommended: false,
  },
  {
    id: 'pov-deck',
    title: 'Executive PPT Teaser',
    description: 'Slides packaged for steering committee.',
    recommended: false,
  },
];

export const findAccount = (accountId?: string) =>
  accountId ? accounts.find((account) => account.id === accountId) : undefined;

export const findMeeting = (meetingId?: string) =>
  meetingId ? calendarMeetings.find((meeting) => meeting.id === meetingId) : undefined;

export const findPostCall = (analysisId?: string) =>
  analysisId ? sharedPostCalls.find((analysis) => analysis.id === analysisId) : undefined;

export const postCallAnalyses = sharedPostCalls;
export const preCallBriefs = sharedPreCalls;
export const proposalLibrary = sharedProposals;
