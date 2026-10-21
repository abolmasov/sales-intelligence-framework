/**
 * ChatWidgetRenderer
 * Dispatches a ChatWidget to the appropriate widget component based on type
 */

import React from 'react';
import {
  ChatWidget,
  DataTableWidgetData,
  InlineFormWidgetData,
  ApprovalWidgetData,
  AgentCardWidgetData,
  SummaryCardWidgetData,
  AIAction,
} from '../../types/aiChat';
import DataTableWidget from './widgets/DataTableWidget';
import InlineFormWidget from './widgets/InlineFormWidget';
import ApprovalWidget from './widgets/ApprovalWidget';
import AgentCardWidget from './widgets/AgentCardWidget';
import SummaryCardWidget from './widgets/SummaryCardWidget';

interface ChatWidgetRendererProps {
  widget: ChatWidget;
  onFormSubmit?: (formId: string, values: Record<string, any>) => void;
  onFormCancel?: () => void;
  onApprove?: (approvalId: string) => void;
  onReject?: (approvalId: string) => void;
  onAgentStart?: (agentId: string, input?: Record<string, any>) => void;
  onRowClick?: (row: Record<string, any>) => void;
  onAction?: (action: AIAction) => void;
}

const ChatWidgetRenderer: React.FC<ChatWidgetRendererProps> = ({
  widget,
  onFormSubmit,
  onFormCancel,
  onApprove,
  onReject,
  onAgentStart,
  onRowClick,
  onAction,
}) => {
  switch (widget.type) {
    case 'data_table':
      return (
        <DataTableWidget
          data={widget.data as DataTableWidgetData}
          onRowClick={onRowClick}
        />
      );

    case 'inline_form':
      return (
        <InlineFormWidget
          data={widget.data as InlineFormWidgetData}
          onSubmit={onFormSubmit ?? (() => {})}
          onCancel={onFormCancel}
        />
      );

    case 'approval':
      return (
        <ApprovalWidget
          data={widget.data as ApprovalWidgetData}
          onApprove={onApprove ?? (() => {})}
          onReject={onReject ?? (() => {})}
        />
      );

    case 'agent_card':
      return (
        <AgentCardWidget
          data={widget.data as AgentCardWidgetData}
          onStart={onAgentStart ?? (() => {})}
        />
      );

    case 'summary_card':
      return (
        <SummaryCardWidget
          data={widget.data as SummaryCardWidgetData}
          onAction={onAction}
        />
      );

    default:
      return null;
  }
};

export default ChatWidgetRenderer;
