// Agent Runtime - Main Export
// Normative: OSA-Runtime-Specifications-v1.0.md §5

export { AgentRuntime } from './agent-runtime.js';

export type {
  AgentRuntimeConfig,
  KernelClient,
  GrantAuthorityParams,
  AuthorityGrant,
  RevokeAuthorityParams,
  RevocationResult,
  DecisionEngineClient,
  DecideParams,
  EvidenceLedgerClient,
  Agent,
  AgentState,
  SpawnAgentParams,
  AgentActionParams,
  AgentActionResult,
  TerminateAgentParams,
  TerminationResult
} from './agent-runtime.js';