import { createHash } from 'node:crypto';

export interface FederatedCALToken {
  token_id: string;
  issued_by: string;
  issued_to: string;
  capabilities: string[];
  scope: { resources: string[]; time_limit_ms: number; intent_version: number };
  delegation_chain: string[];
  signature: string;
  revoked: boolean;
  federation_origin: string;
  federation_treaty_id: string;
  federated_signatures: string[];
}

export interface FederatedRegistryEntry {
  sequence: number;
  entry_type: 'token_issued' | 'token_revoked' | 'delegation_recorded' | 'federation_export' | 'federation_import';
  token_id: string;
  token?: FederatedCALToken;
  previous_entry_hash: string | null;
  entry_hash: string;
  timestamp: number;
  cluster_id: string;
  cross_cluster_reference?: string;
}

export interface FederatedRegistryState {
  registry_id: string;
  cluster_id: string;
  world_id: string;
  previous_registry_hash: string | null;
  registry_hash: string;
  entries: FederatedRegistryEntry[];
  created_at: number;
}

export interface FederationTreaty {
  treaty_id: string;
  clusters: string[];
  signed_at: number;
  terms: {
    recognize_tokens: boolean;
    propagate_revocation: boolean;
    share_evidence: boolean;
    sync_interval_ms: number;
  };
  signatures: string[];
}

export function hashFederatedToken(token: Omit<FederatedCALToken, 'signature' | 'revoked'>): string {
  const canonical = JSON.stringify(token, Object.keys(token).sort());
  return `sha3-256:${createHash('sha3-256').update(canonical, 'utf8').digest('hex')}`;
}
