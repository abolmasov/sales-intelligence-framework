/**
 * AI Action Executor
 * Handles execution of AI-suggested actions in the application
 */

import { NavigateFunction } from 'react-router-dom';
import { AppShellContextValue } from '../context/AppShellContext';
import {
  AIAction,
  AIActionType,
  ActionResult,
  NavigatePayload,
  CreatePayload,
  SearchPayload,
  OpenModalPayload,
  TriggerPayload,
  AppPage,
} from '../types/aiChat';

// Page route mapping - extended to include all navigation targets
const PAGE_ROUTES: Record<string, string> = {
  calendar: '/app/calendar',
  deals: '/app/deals',
  accounts: '/app/accounts',
  analysis: '/app/analysis',
  'analysis-postcall': '/app/analysis/postcall',
  metrics: '/app/metrics',
  'rfp-generator': '/app/rfp-sow-generator',
  'ppt-generator': '/app/ppt-generator',
  'proposal-evaluation': '/app/proposal-evaluation',
  'atlassian-assessment': '/app/atlassian-assessment',
  settings: '/app/settings',
  help: '/app/help',
};

// Store interfaces (simplified - actual stores have more methods)
interface DealStore {
  createDeal: (data: any) => Promise<any>;
  fetchDeals: () => Promise<void>;
}

interface AccountStore {
  createAccount: (data: any) => Promise<any>;
  fetchAccounts: () => Promise<void>;
}

interface MeetingStore {
  createMeeting: (data: any) => Promise<any>;
  fetchMeetings: () => Promise<void>;
}

interface Stores {
  deals: DealStore;
  accounts: AccountStore;
  meetings: MeetingStore;
}

/**
 * AI Action Executor Class
 * Executes actions returned by the AI assistant
 */
export class AIActionExecutor {
  private navigate: NavigateFunction;
  private appShell: AppShellContextValue;
  private stores: Stores;
  private onActionStart?: (action: AIAction) => void;
  private onActionComplete?: (action: AIAction, result: ActionResult) => void;

  constructor(
    navigate: NavigateFunction,
    appShell: AppShellContextValue,
    stores: Stores,
    callbacks?: {
      onActionStart?: (action: AIAction) => void;
      onActionComplete?: (action: AIAction, result: ActionResult) => void;
    }
  ) {
    this.navigate = navigate;
    this.appShell = appShell;
    this.stores = stores;
    this.onActionStart = callbacks?.onActionStart;
    this.onActionComplete = callbacks?.onActionComplete;
  }

  /**
   * Execute an AI action
   */
  async execute(action: AIAction): Promise<ActionResult> {
    this.onActionStart?.(action);

    let result: ActionResult;

    try {
      switch (action.type) {
        case 'navigate':
          result = await this.handleNavigation(action.payload as NavigatePayload);
          break;
        case 'create':
          result = await this.handleCreate(action.payload as CreatePayload);
          break;
        case 'search':
          result = await this.handleSearch(action.payload as SearchPayload);
          break;
        case 'open_modal':
          result = await this.handleOpenModal(action.payload as OpenModalPayload);
          break;
        case 'trigger':
          result = await this.handleTrigger(action.payload as TriggerPayload);
          break;
        default:
          result = {
            success: false,
            error: `Unknown action type: ${action.type}`,
          };
      }
    } catch (error: any) {
      result = {
        success: false,
        error: error.message || 'Action execution failed',
      };
    }

    this.onActionComplete?.(action, result);

    // Show feedback message
    if (result.success && result.message) {
      this.appShell.showMessage({
        type: 'success',
        message: result.message,
      });
    } else if (!result.success && result.error) {
      this.appShell.showMessage({
        type: 'error',
        message: result.error,
      });
    }

    return result;
  }

  /**
   * Handle navigation actions
   */
  private async handleNavigation(payload: NavigatePayload): Promise<ActionResult> {
    const { page, recordId, recordType } = payload;

    let route = PAGE_ROUTES[page as AppPage] || `/app/${page}`;

    // Append record ID if provided
    if (recordId) {
      route = `${route}/${recordId}`;
    }

    // Navigate
    this.navigate(route);

    return {
      success: true,
      message: `Navigated to ${page}${recordId ? ` (${recordType || 'record'}: ${recordId})` : ''}`,
      data: { route },
    };
  }

  /**
   * Handle create record actions
   */
  private async handleCreate(payload: CreatePayload): Promise<ActionResult> {
    const { recordType, prefillData } = payload;

    switch (recordType) {
      case 'deal':
        // Navigate to deals page with create dialog trigger
        // Store prefill data in sessionStorage for the dialog to pick up
        if (prefillData) {
          sessionStorage.setItem('ai_prefill_deal', JSON.stringify(prefillData));
        }
        this.navigate('/app/deals?action=create');
        return {
          success: true,
          message: 'Opening deal creation...',
          data: { recordType, prefillData },
        };

      case 'account':
        if (prefillData) {
          sessionStorage.setItem('ai_prefill_account', JSON.stringify(prefillData));
        }
        this.navigate('/app/accounts?action=create');
        return {
          success: true,
          message: 'Opening account creation...',
          data: { recordType, prefillData },
        };

      case 'meeting':
        if (prefillData) {
          sessionStorage.setItem('ai_prefill_meeting', JSON.stringify(prefillData));
        }
        this.navigate('/app/calendar?action=create');
        return {
          success: true,
          message: 'Opening meeting creation...',
          data: { recordType, prefillData },
        };

      default:
        return {
          success: false,
          error: `Unknown record type: ${recordType}`,
        };
    }
  }

  /**
   * Handle search actions
   */
  private async handleSearch(payload: SearchPayload): Promise<ActionResult> {
    const { recordType, query, filters } = payload;

    // Build search params
    const searchParams = new URLSearchParams();
    searchParams.set('search', query);

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, String(value));
        }
      });
    }

    // Determine target page based on record type
    let targetPage: string;
    switch (recordType) {
      case 'deal':
        targetPage = '/app/deals';
        break;
      case 'account':
        targetPage = '/app/accounts';
        break;
      case 'meeting':
        targetPage = '/app/calendar';
        break;
      case 'all':
      default:
        // For "all" searches, go to accounts as the main search hub
        // Could also trigger the CommandPalette instead
        targetPage = '/app/accounts';
        break;
    }

    this.navigate(`${targetPage}?${searchParams.toString()}`);

    return {
      success: true,
      message: `Searching ${recordType === 'all' ? 'all records' : recordType + 's'} for "${query}"`,
      data: { recordType, query, filters },
    };
  }

  /**
   * Handle modal opening actions
   */
  private async handleOpenModal(payload: OpenModalPayload): Promise<ActionResult> {
    const { modal, data } = payload;

    switch (modal) {
      case 'proposal_flow':
        this.appShell.openProposalFlow(data);
        return {
          success: true,
          message: 'Opening proposal flow...',
        };

      case 'post_call_flow':
        this.appShell.openPostCallFlow(data);
        return {
          success: true,
          message: 'Opening post-call analysis...',
        };

      case 'create_deal':
        if (data) {
          sessionStorage.setItem('ai_prefill_deal', JSON.stringify(data));
        }
        this.navigate('/app/deals?action=create');
        return {
          success: true,
          message: 'Opening deal creation...',
        };

      case 'create_account':
        if (data) {
          sessionStorage.setItem('ai_prefill_account', JSON.stringify(data));
        }
        this.navigate('/app/accounts?action=create');
        return {
          success: true,
          message: 'Opening account creation...',
        };

      default:
        return {
          success: false,
          error: `Unknown modal type: ${modal}`,
        };
    }
  }

  /**
   * Handle workflow trigger actions
   */
  private async handleTrigger(payload: TriggerPayload): Promise<ActionResult> {
    const { workflow, targetId, targetName, data } = payload;

    switch (workflow) {
      case 'pre_call_analysis':
        // Build query params for pre-call analysis
        const preCallParams = new URLSearchParams();
        if (targetName) {
          preCallParams.set('company', targetName);
        }
        if (targetId) {
          preCallParams.set('meetingId', targetId);
        }
        if (data?.meetingContext) {
          preCallParams.set('meetingContext', data.meetingContext);
        }
        // Auto-start analysis when coming from AI assistant
        preCallParams.set('autoStart', 'true');

        const preCallQuery = preCallParams.toString();
        this.navigate(preCallQuery ? `/app/analysis?${preCallQuery}` : '/app/analysis');
        return {
          success: true,
          message: targetName
            ? `Starting pre-call analysis for ${targetName}...`
            : 'Opening analysis page...',
        };

      case 'post_call_analysis':
        if (targetId) {
          this.appShell.openPostCallFlow({ meetingId: targetId });
        } else {
          this.navigate('/app/analysis/postcall');
        }
        return {
          success: true,
          message: targetName
            ? `Starting post-call analysis for ${targetName}...`
            : 'Opening post-call analysis...',
        };

      case 'company_research':
        // Build query params for company research with autoStart
        const researchParams = new URLSearchParams();
        if (targetName) {
          researchParams.set('company', targetName);
          researchParams.set('autoStart', 'true');
        }
        if (data?.context) {
          researchParams.set('meetingContext', data.context);
        }

        const researchQuery = researchParams.toString();
        this.navigate(researchQuery ? `/app/analysis?${researchQuery}` : '/app/analysis');
        return {
          success: true,
          message: targetName
            ? `Starting research on ${targetName}...`
            : data?.internalKbQuery
              ? `Searching InternalKnowledge for "${data.internalKbQuery}"...`
              : 'Opening analysis page...',
        };

      case 'proposal_generation':
        this.appShell.openProposalFlow(data);
        return {
          success: true,
          message: 'Starting proposal generation...',
        };

      case 'rfp_analysis':
        this.navigate('/app/rfp-sow-generator');
        return {
          success: true,
          message: 'Opening RFP analysis...',
        };

      case 'ppt_generation':
        this.navigate('/app/ppt-generator');
        return {
          success: true,
          message: 'Opening presentation generator...',
        };

      case 'proposal_evaluation':
        this.navigate('/app/proposal-evaluation');
        return {
          success: true,
          message: 'Opening proposal evaluation...',
        };

      default:
        return {
          success: false,
          error: `Unknown workflow: ${workflow}`,
        };
    }
  }
}

/**
 * Create action executor instance
 */
export function createActionExecutor(
  navigate: NavigateFunction,
  appShell: AppShellContextValue,
  stores: Stores,
  callbacks?: {
    onActionStart?: (action: AIAction) => void;
    onActionComplete?: (action: AIAction, result: ActionResult) => void;
  }
): AIActionExecutor {
  return new AIActionExecutor(navigate, appShell, stores, callbacks);
}

/**
 * Generate a unique action ID
 */
export function generateActionId(): string {
  return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default AIActionExecutor;
