// Evidence Ledger Client - Immutable evidence storage client
// Normative: OSA-CGL-v1.0.md

import { EvidenceId, Hash, Signature, Timestamp, EvidenceSource, createEvidenceSource, now, randomUUID } from '@osa/constitutional-types';

export interface EvidenceLedgerClientConfig {
  endpoint: string;
  authToken?: string;
  timeoutMs?: number;
}

export interface EvidenceRecord {
  evidenceId: EvidenceId;
  level: 'E0' | 'E1' | 'E2' | 'E3' | 'E4';
  timestamp: Timestamp;
  source: string;
  payload: any;
  payloadHash: Hash;
  previousEvidenceHash: Hash | null;
  chainHash: Hash;
  signature: Signature;
}

export interface LedgerEntry {
  sequence: number;
  evidence: EvidenceRecord;
  receivedAt: Timestamp;
  federationRef?: string;
}

export interface ChainVerificationResult {
  ok: boolean;
  entriesVerified: number;
  brokenAt?: number;
  expected?: Hash;
  actual?: Hash;
}

export interface Checkpoint {
  globalSequence: number;
  timestamp: Timestamp;
  levelCheckpoints: Record<string, LevelCheckpoint>;
  merkleRoot: Hash;
}

export interface LevelCheckpoint {
  lastSequence: number;
  lastChainHash: Hash;
  entryCount: number;
}

export interface AppendResult {
  sequence: number;
  chainHash: Hash;
  verified: boolean;
}

export interface QueryParams {
  level?: 'E0' | 'E1' | 'E2' | 'E3' | 'E4';
  source?: string;
  startTime?: Timestamp;
  endTime?: Timestamp;
  limit?: number;
  offset?: number;
}

export interface VerifyChainParams {
  source: string;
  level: 'E0' | 'E1' | 'E2' | 'E3' | 'E4';
  fromSequence?: number;
  toSequence?: number;
}

export interface ExportPackage {
  packageId: string;
  treatyId: string;
  exportedAt: Timestamp;
  evidence: EvidenceRecord[];
  causality: any[];
  events: any[];
  chainProof: ChainProof;
  exporterSignature: Signature;
}

export interface ChainProof {
  evidenceId: EvidenceId;
  merkleRoot: Hash;
  merklePath: Hash[];
  leafIndex: number;
}

export interface ImportResult {
  imported: number;
  failed: number;
  evidenceRefs: EvidenceId[];
}

export class EvidenceLedgerClient {
  private config: EvidenceLedgerClientConfig;

  constructor(config: EvidenceLedgerClientConfig) {
    this.config = config;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-OSA-Request-ID': randomUUID(),
      'X-OSA-Timestamp': now()
    };
    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs || 30000);

    try {
      const response = await fetch(`${this.config.endpoint}${path}`, {
        ...options,
        headers: { ...headers, ...options.headers },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  // Write Operations
  async append(entry: EvidenceRecord): Promise<AppendResult> {
    return this.request<AppendResult>('/api/v1/evidence', {
      method: 'POST',
      body: JSON.stringify(entry)
    });
  }

  async appendBatch(entries: EvidenceRecord[]): Promise<AppendResult[]> {
    const results: AppendResult[] = [];
    for (const entry of entries) {
      results.push(await this.append(entry));
    }
    return results;
  }

  // Read Operations
  async get(evidenceId: EvidenceId): Promise<LedgerEntry | null> {
    return this.request<LedgerEntry | null>(`/api/v1/evidence/${evidenceId}`);
  }

  async query(params: QueryParams): Promise<LedgerEntry[]> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.set(key, String(value));
    });
    return this.request<LedgerEntry[]>(`/api/v1/evidence?${searchParams}`);
  }

  // Integrity
  async verifyChain(params: VerifyChainParams): Promise<ChainVerificationResult> {
    return this.request<ChainVerificationResult>('/api/v1/evidence/verify', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  async getCheckpoint(params: { atSequence?: number } = {}): Promise<Checkpoint | null> {
    const searchParams = new URLSearchParams();
    if (params.atSequence) searchParams.set('atSequence', String(params.atSequence));
    return this.request<Checkpoint | null>(`/api/v1/evidence/checkpoint?${searchParams}`);
  }

  async *replayFrom(checkpoint: Checkpoint): AsyncIterator<LedgerEntry> {
    // In production: use WebSocket or Server-Sent Events for streaming
    // For now, fetch batch
    const entries = await this.request<LedgerEntry[]>(`/api/v1/evidence/replay?from=${checkpoint.globalSequence}`);
    for (const entry of entries) yield entry;
  }

  // Federation
  async importEvidence(evidence: EvidenceRecord, federationRef: string): Promise<ImportResult> {
    return this.request<ImportResult>('/api/v1/evidence/import', {
      method: 'POST',
      body: JSON.stringify({ evidence, federationRef })
    });
  }

  async exportEvidence(evidenceIds: EvidenceId[]): Promise<ExportPackage> {
    return this.request<ExportPackage>('/api/v1/evidence/export', {
      method: 'POST',
      body: JSON.stringify({ evidenceIds })
    });
  }
}