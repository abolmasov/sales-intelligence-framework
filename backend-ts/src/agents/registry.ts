/**
 * Agent Registry — singleton registry for discovering and instantiating agents.
 *
 * Concrete agents self-register at import time via `agentRegistry.register(...)`.
 */

import type { BaseAgent } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentFactory = () => BaseAgent;

export interface AgentRegistryEntry {
  id: string;
  name: string;
  description: string;
  factory: AgentFactory;
}

export interface AgentInfo {
  id: string;
  name: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

class AgentRegistry {
  private agents = new Map<string, AgentRegistryEntry>();

  /** Register an agent factory. Overwrites if same id already registered. */
  register(entry: AgentRegistryEntry): void {
    this.agents.set(entry.id, entry);
  }

  /** Instantiate an agent by id. Throws if not found. */
  get(id: string): BaseAgent {
    const entry = this.agents.get(id);
    if (!entry) {
      throw new Error(`Agent not found in registry: "${id}"`);
    }
    return entry.factory();
  }

  /** List all registered agents (metadata only). */
  list(): AgentInfo[] {
    return Array.from(this.agents.values()).map(({ id, name, description }) => ({
      id,
      name,
      description,
    }));
  }

  /** Check whether an agent id is registered. */
  has(id: string): boolean {
    return this.agents.has(id);
  }

  /** Remove an agent registration. */
  unregister(id: string): boolean {
    return this.agents.delete(id);
  }

  /** Total number of registered agents. */
  get size(): number {
    return this.agents.size;
  }
}

/** Singleton agent registry */
export const agentRegistry = new AgentRegistry();
