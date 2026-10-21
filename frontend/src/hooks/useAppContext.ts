/**
 * useAppContext Hook
 * Gathers current application context for AI assistant awareness
 */

import { useMemo, useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useDealStore } from '../store/dealStore';
import { useMeetingStore } from '../store/meetingStore';
import { useAccountsStore } from '../store/accountsStore';
import { AppContext, AppPage, RecordType } from '../types/aiChat';

// Storage key for recent pages
const RECENT_PAGES_KEY = 'ai_chat_recent_pages';
const MAX_RECENT_PAGES = 10;

/**
 * Maps pathname to page identifier
 */
function getPageFromPath(pathname: string): AppPage | string {
  const path = pathname.replace('/app/', '').split('/')[0];

  const pageMap: Record<string, AppPage> = {
    '': 'calendar',
    'calendar': 'calendar',
    'deals': 'deals',
    'accounts': 'accounts',
    'analysis': 'analysis',
    'metrics': 'metrics',
    'rfp-sow-generator': 'rfp-generator',
    'ppt-generator': 'ppt-generator',
    'proposal-evaluation': 'proposal-evaluation',
    'atlassian-assessment': 'atlassian-assessment',
    'settings': 'settings',
    'help': 'help',
  };

  return pageMap[path] || path;
}

/**
 * Get human-readable page name
 */
function getPageName(page: AppPage | string): string {
  const names: Record<string, string> = {
    calendar: 'Calendar',
    deals: 'Deals',
    accounts: 'Accounts',
    analysis: 'Company Research',
    'analysis-postcall': 'Post-Call Analysis',
    metrics: 'Metrics',
    'rfp-generator': 'RFP Generator',
    'ppt-generator': 'PPT Generator',
    'proposal-evaluation': 'Proposal Evaluation',
    'atlassian-assessment': 'Atlassian Assessment',
    settings: 'Settings',
    help: 'Help',
  };

  return names[page] || page;
}

/**
 * Get context-aware quick suggestions based on current page
 */
export function getContextSuggestions(page: AppPage | string, selectedRecord?: { type: string; name: string } | null): string[] {
  const baseSuggestions: Record<string, string[]> = {
    calendar: [
      'Run pre-call analysis for my next meeting',
      'What meetings do I have this week?',
      'Help me prepare for an upcoming call',
    ],
    deals: [
      'Show deals closing this month',
      'Which deals need follow-up?',
      'Create a new deal',
    ],
    accounts: [
      'Research this company',
      'Show deal history for this account',
      'Find similar accounts',
    ],
    analysis: [
      'Research a company before my call',
      'Find relevant case studies',
      'What should I know about this prospect?',
    ],
    'analysis-postcall': [
      'Help me analyze a transcript',
      'Extract action items from the call',
      'Generate a meeting summary',
    ],
    'rfp-generator': [
      'How do I use the RFP generator?',
      'Find case studies for my RFP',
      'Help me respond to requirements',
    ],
    'ppt-generator': [
      'How do I create a presentation?',
      'What slides can I generate?',
      'Create a pitch deck',
    ],
    'proposal-evaluation': [
      'How does proposal evaluation work?',
      'Start evaluating a proposal',
      'Explain the scoring criteria',
    ],
    'atlassian-assessment': [
      'Help with cloud migration assessment',
      'What services should I recommend?',
      'Guide me through the decision flow',
    ],
    metrics: [
      "What's my win rate?",
      'Show pipeline summary',
      'Which stage has most deals?',
    ],
  };

  const suggestions = baseSuggestions[page] || [
    'What can you help me with?',
    'Show my upcoming meetings',
    'Research a company',
  ];

  // Add record-specific suggestions if a record is selected
  if (selectedRecord) {
    if (selectedRecord.type === 'deal') {
      return [
        `Research ${selectedRecord.name}`,
        `What do we know about ${selectedRecord.name}?`,
        ...suggestions.slice(0, 2),
      ];
    }
    if (selectedRecord.type === 'account') {
      return [
        `Research ${selectedRecord.name}`,
        `Show deals with ${selectedRecord.name}`,
        ...suggestions.slice(0, 2),
      ];
    }
    if (selectedRecord.type === 'meeting') {
      return [
        `Prepare for ${selectedRecord.name}`,
        'Run pre-call analysis',
        ...suggestions.slice(0, 2),
      ];
    }
  }

  return suggestions;
}

/**
 * Get recent pages from localStorage
 */
function getRecentPages(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_PAGES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Add a page to recent pages
 */
function addRecentPage(page: string): void {
  try {
    const recent = getRecentPages();
    const filtered = recent.filter(p => p !== page);
    const updated = [page, ...filtered].slice(0, MAX_RECENT_PAGES);
    localStorage.setItem(RECENT_PAGES_KEY, JSON.stringify(updated));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Custom hook to get current application context
 */
export function useAppContext(): AppContext & {
  pageName: string;
  hasSelectedRecord: boolean;
  contextSummary: string;
} {
  const location = useLocation();
  const params = useParams<{ dealId?: string; accountId?: string; meetingId?: string }>();

  // Get store states
  const { selectedDeal } = useDealStore();
  const { selectedMeeting } = useMeetingStore();
  const { accountDetails } = useAccountsStore();

  // Determine current page
  const currentPage = getPageFromPath(location.pathname);
  const pageName = getPageName(currentPage);

  // Track page visits
  useEffect(() => {
    addRecentPage(location.pathname);
  }, [location.pathname]);

  // Determine selected record based on route and store state
  const selectedRecord = useMemo(() => {
    // Check route params first
    if (params.dealId && selectedDeal?.deal_id === params.dealId) {
      return {
        type: 'deal' as RecordType,
        id: selectedDeal.deal_id,
        name: selectedDeal.opportunity_name || selectedDeal.company_name || 'Deal',
        data: {
          company: selectedDeal.company_name,
          stage: selectedDeal.stage,
          value: selectedDeal.estimated_value,
        },
      };
    }

    if (params.accountId) {
      const account = accountDetails[params.accountId];
      if (account) {
        return {
          type: 'account' as RecordType,
          id: params.accountId,
          name: account.name || 'Account',
          data: {
            industry: account.industry,
            domain: account.domain,
          },
        };
      }
    }

    if (params.meetingId && selectedMeeting?.meeting_id === params.meetingId) {
      return {
        type: 'meeting' as RecordType,
        id: selectedMeeting.meeting_id,
        name: selectedMeeting.title || 'Meeting',
        data: {
          date: selectedMeeting.meeting_date,
          sentiment: selectedMeeting.sentiment,
        },
      };
    }

    // Check store selections if no route params
    if (selectedDeal) {
      return {
        type: 'deal' as RecordType,
        id: selectedDeal.deal_id,
        name: selectedDeal.opportunity_name || selectedDeal.company_name || 'Deal',
        data: {
          company: selectedDeal.company_name,
          stage: selectedDeal.stage,
          value: selectedDeal.estimated_value,
        },
      };
    }

    if (selectedMeeting) {
      return {
        type: 'meeting' as RecordType,
        id: selectedMeeting.meeting_id,
        name: selectedMeeting.title || 'Meeting',
        data: {
          date: selectedMeeting.meeting_date,
          sentiment: selectedMeeting.sentiment,
        },
      };
    }

    return null;
  }, [params, selectedDeal, selectedMeeting, accountDetails]);

  // Generate context summary for display
  const contextSummary = useMemo(() => {
    const parts: string[] = [`Viewing ${pageName}`];

    if (selectedRecord) {
      parts.push(`• ${selectedRecord.type}: ${selectedRecord.name}`);
    }

    return parts.join(' ');
  }, [pageName, selectedRecord]);

  return {
    currentPage,
    currentRoute: location.pathname,
    selectedRecord,
    recentPages: getRecentPages(),
    pageName,
    hasSelectedRecord: !!selectedRecord,
    contextSummary,
  };
}

/**
 * Get minimal context for API calls
 */
export function getMinimalContext(context: ReturnType<typeof useAppContext>): AppContext {
  return {
    currentPage: context.currentPage,
    currentRoute: context.currentRoute,
    selectedRecord: context.selectedRecord,
    recentPages: context.recentPages,
  };
}

export default useAppContext;
