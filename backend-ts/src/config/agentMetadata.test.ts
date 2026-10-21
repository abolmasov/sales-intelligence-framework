import { describe, it, expect } from 'vitest';
import { AGENT_METADATA, getAgentMetadata, AgentMetadata } from './agentMetadata';

describe('agentMetadata', () => {
  it('exports a non-empty array of agents', () => {
    expect(Array.isArray(AGENT_METADATA)).toBe(true);
    expect(AGENT_METADATA.length).toBeGreaterThanOrEqual(9);
  });

  it('every agent has required fields', () => {
    for (const agent of AGENT_METADATA) {
      expect(agent.id).toBeTruthy();
      expect(agent.name).toBeTruthy();
      expect(agent.description).toBeTruthy();
      expect(agent.icon).toBeTruthy();
      expect(agent.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(['analysis', 'generation', 'research', 'automation']).toContain(agent.category);
      expect(Array.isArray(agent.capabilities)).toBe(true);
      expect(agent.capabilities.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate agent IDs', () => {
    const ids = AGENT_METADATA.map((a) => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all input fields have valid types', () => {
    const validTypes = ['text', 'select', 'textarea', 'deal_select', 'account_select', 'meeting_select', 'workspace_select'];
    for (const agent of AGENT_METADATA) {
      if (agent.inputFields) {
        for (const field of agent.inputFields) {
          expect(field.name).toBeTruthy();
          expect(field.label).toBeTruthy();
          expect(validTypes).toContain(field.type);
        }
      }
    }
  });

  it('input fields have name and label', () => {
    for (const agent of AGENT_METADATA) {
      if (agent.inputFields) {
        for (const field of agent.inputFields) {
          expect(field.name, `${agent.id} field missing name`).toBeTruthy();
          expect(field.label, `${agent.id} field missing label`).toBeTruthy();
        }
      }
    }
  });

  describe('getAgentMetadata', () => {
    it('returns agent for valid ID', () => {
      const agent = getAgentMetadata('transcript-analysis');
      expect(agent).toBeDefined();
      expect(agent!.name).toBe('Transcript Analyzer');
    });

    it('returns undefined for unknown ID', () => {
      const agent = getAgentMetadata('nonexistent-agent');
      expect(agent).toBeUndefined();
    });

    it('returns correct agent for each known ID', () => {
      const knownIds = [
        'transcript-analysis',
        'pre-call-research',
        'proposal-generation',
        'pptx-generation',
        'discovery',
        'workshop-analysis',
        'user-story-generation',
        'workshop-prep',
        'bulk-analysis',
      ];
      for (const id of knownIds) {
        const agent = getAgentMetadata(id);
        expect(agent).toBeDefined();
        expect(agent!.id).toBe(id);
      }
    });
  });

  describe('specific agents', () => {
    it('workshop-prep has workspace_select input', () => {
      const agent = getAgentMetadata('workshop-prep');
      expect(agent!.inputFields).toBeDefined();
      const wsField = agent!.inputFields!.find((f) => f.type === 'workspace_select');
      expect(wsField).toBeDefined();
      expect(wsField!.required).toBe(true);
    });

    it('transcript-analysis requires meeting with transcript', () => {
      const agent = getAgentMetadata('transcript-analysis');
      const meetingField = agent!.inputFields!.find((f) => f.type === 'meeting_select');
      expect(meetingField).toBeDefined();
      expect(meetingField!.requiresTranscript).toBe(true);
    });

    it('bulk-analysis accepts deal or account', () => {
      const agent = getAgentMetadata('bulk-analysis');
      const fields = agent!.inputFields!;
      expect(fields.find((f) => f.type === 'deal_select')).toBeDefined();
      expect(fields.find((f) => f.type === 'account_select')).toBeDefined();
    });
  });
});
