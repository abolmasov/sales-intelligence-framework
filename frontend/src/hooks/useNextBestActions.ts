import { useMemo, useState, useCallback } from 'react';
import { useCalendarMeetingsStore } from '../store/calendarMeetingsStore';
import { useDealStore } from '../store/dealStore';
import type { CalendarMeeting } from '../types/calendarMeeting';
import type { Deal } from '../../../shared/types';

export type ActionType =
  | 'upcoming_no_prep'
  | 'transcript_ready'
  | 'completed_no_analysis'
  | 'analyzed_no_proposal'
  | 'deal_at_risk';

export interface NextBestAction {
  id: string;
  type: ActionType;
  priority: number;
  title: string;
  description: string;
  ctaLabel: string;
  meetingId?: string;
  dealId?: string;
  meeting?: CalendarMeeting;
  deal?: Deal;
  count?: number;
  iconType: 'precall' | 'transcript' | 'meeting' | 'proposal' | 'deal';
}

const MAX_ACTIONS = 5;
const SESSION_KEY = 'nba_dismissed';

const getDismissedIds = (): Set<string> => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

const saveDismissedIds = (ids: Set<string>) => {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify([...ids]));
};

const getMeetingStart = (m: CalendarMeeting): Date | null => {
  if (m.startDateTime) return new Date(m.startDateTime);
  if (m.date && m.time) return new Date(`${m.date}T${m.time}`);
  if (m.date) return new Date(`${m.date}T00:00:00`);
  return null;
};

const formatTimeUntil = (hours: number): string => {
  if (hours < 1) return 'less than an hour';
  if (hours < 24) return `${Math.round(hours)} hours`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'tomorrow' : `in ${days} days`;
};

export const useNextBestActions = () => {
  const meetings = useCalendarMeetingsStore((s) => s.meetings);
  const deals = useDealStore((s) => s.deals);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(getDismissedIds);

  const dismiss = useCallback((id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissedIds(next);
      return next;
    });
  }, []);

  const dismissAll = useCallback((actionIds: string[]) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      actionIds.forEach((id) => next.add(id));
      saveDismissedIds(next);
      return next;
    });
  }, []);

  const actions = useMemo(() => {
    const now = new Date();
    const result: NextBestAction[] = [];

    // Signal 1: Upcoming meetings without prep (within 72 hours)
    const upcomingNoPrep = meetings.filter((m) => {
      if (m.status !== 'scheduled') return false;
      const start = getMeetingStart(m);
      if (!start || start <= now) return false;
      const hoursUntil = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntil > 72) return false;
      const hasPreCall = (m.analysisSummary?.preCall || []).some(
        (pc) => pc.status === 'completed'
      );
      return !hasPreCall;
    }).sort((a, b) => {
      const aStart = getMeetingStart(a)?.getTime() || 0;
      const bStart = getMeetingStart(b)?.getTime() || 0;
      return aStart - bStart;
    });

    if (upcomingNoPrep.length > 0) {
      const first = upcomingNoPrep[0];
      const start = getMeetingStart(first);
      const hoursUntil = start ? (start.getTime() - now.getTime()) / (1000 * 60 * 60) : 72;
      const timeLabel = formatTimeUntil(hoursUntil);

      result.push({
        id: `upcoming_no_prep_${first.id}`,
        type: 'upcoming_no_prep',
        priority: hoursUntil < 24 ? 1 : 2,
        title: upcomingNoPrep.length === 1
          ? `Meeting ${timeLabel} with no prep`
          : `${upcomingNoPrep.length} upcoming meetings with no prep`,
        description: upcomingNoPrep.length === 1
          ? `${first.company} — ${first.title}`
          : `Next: ${first.company} — ${first.title} (${timeLabel})`,
        ctaLabel: 'Prepare',
        meetingId: first.id,
        meeting: first,
        count: upcomingNoPrep.length,
        iconType: 'precall',
      });
    }

    // Signal 2: Transcript available, not analyzed
    const transcriptReady = meetings.filter((m) => {
      if (!m.transcriptAvailable) return false;
      if (m.status === 'analyzing') return false;
      const hasPostCall = (m.analysisSummary?.postCall || []).some(
        (pc) => pc.status === 'completed'
      );
      return !hasPostCall;
    });

    if (transcriptReady.length > 0) {
      const first = transcriptReady[0];
      result.push({
        id: `transcript_ready_${first.id}`,
        type: 'transcript_ready',
        priority: 2,
        title: transcriptReady.length === 1
          ? 'Transcript ready for analysis'
          : `${transcriptReady.length} transcripts ready for analysis`,
        description: transcriptReady.length === 1
          ? `${first.company} — ${first.title}`
          : `Including: ${first.company} — ${first.title}`,
        ctaLabel: 'Analyze',
        meetingId: first.id,
        meeting: first,
        count: transcriptReady.length,
        iconType: 'transcript',
      });
    }

    // Signal 3: Completed meeting, nothing done
    const completedNoAnalysis = meetings.filter((m) => {
      if (m.status !== 'completed') return false;
      if (m.transcriptAvailable) return false; // handled by Signal 2
      const hasPostCall = (m.analysisSummary?.postCall || []).length > 0;
      const hasPreCall = (m.analysisSummary?.preCall || []).some(
        (pc) => pc.status === 'completed'
      );
      return !hasPostCall && !hasPreCall;
    });

    if (completedNoAnalysis.length > 0) {
      const first = completedNoAnalysis[0];
      result.push({
        id: `completed_no_analysis_${first.id}`,
        type: 'completed_no_analysis',
        priority: 3,
        title: completedNoAnalysis.length === 1
          ? 'Completed meeting needs review'
          : `${completedNoAnalysis.length} completed meetings need review`,
        description: completedNoAnalysis.length === 1
          ? `${first.company} — ${first.title}`
          : `Including: ${first.company} — ${first.title}`,
        ctaLabel: 'View Meeting',
        meetingId: first.id,
        meeting: first,
        count: completedNoAnalysis.length,
        iconType: 'meeting',
      });
    }

    // Signal 4: Analysis done, no proposal
    const analyzedNoProposal = meetings.filter((m) => {
      if (m.status !== 'analyzed') return false;
      const hasProposal = (m.analysisSummary?.proposals || []).length > 0;
      return !hasProposal;
    });

    if (analyzedNoProposal.length > 0) {
      const first = analyzedNoProposal[0];
      result.push({
        id: `analyzed_no_proposal_${first.id}`,
        type: 'analyzed_no_proposal',
        priority: 4,
        title: analyzedNoProposal.length === 1
          ? 'Analysis complete — proposal ready to generate'
          : `${analyzedNoProposal.length} meetings ready for proposals`,
        description: analyzedNoProposal.length === 1
          ? `${first.company} — ${first.title}`
          : `Including: ${first.company} — ${first.title}`,
        ctaLabel: 'Generate Proposal',
        meetingId: first.id,
        meeting: first,
        count: analyzedNoProposal.length,
        iconType: 'proposal',
      });
    }

    // Signal 5: Deals at risk
    const atRiskDeals = deals.filter((d) => {
      if (d.status !== 'active') return false;
      if (!d.close_date) return false;
      const closeDate = new Date(d.close_date);
      const daysUntilClose = (closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return daysUntilClose > 0 && daysUntilClose <= 30 && d.progress_percentage < 50;
    });

    if (atRiskDeals.length > 0) {
      const first = atRiskDeals[0];
      const closeDate = new Date(first.close_date!);
      const daysLeft = Math.round((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      result.push({
        id: `deal_at_risk_${first.deal_id}`,
        type: 'deal_at_risk',
        priority: 3,
        title: atRiskDeals.length === 1
          ? `Deal closing in ${daysLeft} days at ${first.progress_percentage}%`
          : `${atRiskDeals.length} deals at risk of missing close date`,
        description: atRiskDeals.length === 1
          ? `${first.opportunity_name} — ${first.company_name}`
          : `Including: ${first.opportunity_name} — ${first.company_name}`,
        ctaLabel: 'View Deal',
        dealId: first.deal_id,
        deal: first,
        count: atRiskDeals.length,
        iconType: 'deal',
      });
    }

    // Sort by priority, filter dismissed, cap at MAX
    result.sort((a, b) => a.priority - b.priority);
    return result.filter((a) => !dismissedIds.has(a.id)).slice(0, MAX_ACTIONS);
  }, [meetings, deals, dismissedIds]);

  return {
    actions,
    isEmpty: actions.length === 0,
    dismiss,
    dismissAll: () => dismissAll(actions.map((a) => a.id)),
  };
};
