// Evidence Ledger - Immutable constitutional evidence storage
// Normative: OSA-Evidence-Specification-v1.0.md, OSA-Runtime-Specifications-v1.0.md §9

import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';

export interface EvidenceRecord {
  evidenceId: string;
  level: 'E0' | 'E1' | 'E2' | 'E3' | 'E4';
  timestamp: string;
  source: string;
  payload: any;
  payloadHash: string;
  previousEvidenceHash: string | null;
  chainHash: string;
  signature: string;
}

export interface LedgerEntry {
  sequence: number;
  evidence: EvidenceRecord;
  receivedAt: string;
  federationRef?: string;
}

export interface ChainVerificationResult {
  ok: boolean;
  entriesVerified: number;
  brokenAt?: number;
  expected?: string;
  actual?: string;
}

export interface Checkpoint {
  globalSequence: number;
  timestamp: string;
  levelCheckpoints: Record<string, LevelCheckpoint>;
  merkleRoot: string;
}

export interface LevelCheckpoint {
  lastSequence: number;
  lastChainHash: string;
  entryCount: number;
}

export interface AppendResult {
  sequence: number;
  chainHash: string;
  verified: boolean;
}

export interface QueryParams {
  level?: 'E0' | 'E1' | 'E2' | 'E3' | 'E4';
  source?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

export interface VerifyChainParams {
  source: string;
  level: 'E0' | 'E1' | 'E2' | 'E3' | 'E4';
  fromSequence?: number;
  toSequence?: number;
}

export interface CheckpointParams {
  atSequence?: number;
}

export interface ExportPackage {
  packageId: string;
  treatyId: string;
  exportedAt: string;
  evidence: EvidenceRecord[];
  causality: CausalityRecord[];
  events: EventRecord[];
  chainProof: ChainProof;
  exporterSignature: string;
}

export interface CausalityRecord {
  causalityId: string;
  cause: string;
  effect: string;
  relation: 'PROCESSES' | 'INPUTS_TO' | 'DECIDES_ON' | 'AUDITS' | 'REMEDIATES' | 'GOVERNS';
  strength: 'DEFINITIVE' | 'PROBABILISTIC' | 'CONTRIBUTORY';
  timestamp: string;
  establishedBy: string;
  signature: string;
}

export interface EventRecord {
  eventId: string;
  type: string;
  timestamp: string;
  source: string;
  payload: any;
  evidenceProduced: string[];
  causalityRefs: string[];
}

export interface ChainProof {
  evidenceId: string;
  merkleRoot: string;
  merklePath: string[];
  leafIndex: number;
}

export interface ImportResult {
  imported: number;
  failed: number;
  evidenceRefs: string[];
}

export interface EvidenceLedgerConfig {
  dataDir: string;
  signingKey: Uint8Array;
  verifyingKey: Uint8Array;
  checkpointInterval: number; // entries
  partitionByLevel: boolean;
}

export class EvidenceLedger {
  private db: Database.Database;
  private config: EvidenceLedgerConfig;
  private globalSequence = 0;
  private lastChainHashes: Map<string, string> = new Map(); // key: ${source}:${level}
  private checkpointTimer?: NodeJS.Timeout;

  constructor(config: EvidenceLedgerConfig) {
    this.config = config;
    
    this.db = new Database(`${config.dataDir}/ledger.sqlite`);
    this.initSchema();
    this.loadLastState();
    
    // Periodic checkpoint
    this.checkpointTimer = setInterval(() => this.createCheckpoint(), 3600000); // 1 hour
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        sequence INTEGER PRIMARY KEY,
        evidence_id TEXT UNIQUE NOT NULL,
        level TEXT NOT NULL,
        source TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        previous_hash TEXT,
        chain_hash TEXT NOT NULL,
        signature TEXT NOT NULL,
        received_at TEXT NOT NULL,
        federation_ref TEXT,
        payload_json TEXT NOT NULL,
        INDEX idx_level_source_time (level, source, timestamp)
      );
      
      CREATE TABLE IF NOT EXISTS causality (
        causality_id TEXT PRIMARY KEY,
        cause TEXT NOT NULL,
        effect TEXT NOT NULL,
        relation TEXT NOT NULL,
        strength TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        established_by TEXT NOT NULL,
        signature TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS events (
        event_id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        source TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        evidence_produced TEXT NOT NULL,
        causality_refs TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS checkpoints (
        global_sequence INTEGER PRIMARY KEY,
        timestamp TEXT NOT NULL,
        level_checkpoints TEXT NOT NULL,
        merkle_root TEXT NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_causality_cause ON causality(cause);
      CREATE INDEX IF NOT EXISTS idx_causality_effect ON causality(effect);
      CREATE INDEX IF NOT EXISTS idx_events_time ON events(timestamp);
    `);
  }

  private loadLastState(): void {
    const lastEntry = this.db.prepare('SELECT * FROM ledger_entries ORDER BY sequence DESC LIMIT 1').get() as any;
    if (lastEntry) {
      this.globalSequence = lastEntry.sequence;
    }

    // Load last chain hashes per source:level
    const rows = this.db.prepare('SELECT source, level, chain_hash FROM ledger_entries WHERE sequence = (SELECT MAX(sequence) FROM ledger_entries WHERE source = l.source AND level = l.level)').all() as any[];
    for (const row of rows) {
      this.lastChainHashes.set(`${row.source}:${row.level}`, row.chain_hash);
    }
  }

  // ========================================================================
  // Write Operations
  // ========================================================================

  async append(evidence: EvidenceRecord): Promise<AppendResult> {
    const key = `${evidence.source}:${evidence.level}`;
    const previousHash = this.lastChainHashes.get(key) || null;
    
    // Verify chain integrity
    const expectedChainHash = this.computeChainHash(evidence.payloadHash, previousHash);
    if (evidence.chainHash !== expectedChainHash) {
      throw new Error(`Chain hash mismatch: expected ${expectedChainHash}, got ${evidence.chainHash}`);
    }

    // Verify signature
    if (!this.verifySignature(evidence.chainHash, evidence.signature)) {
      throw new Error('Invalid signature');
    }

    this.globalSequence++;
    
    const entry: LedgerEntry = {
      sequence: this.globalSequence,
      evidence,
      receivedAt: new Date().toISOString(),
      federationRef: undefined
    };

    this.db.prepare(`
      INSERT INTO ledger_entries (sequence, evidence_id, level, source, timestamp, payload_hash, previous_hash, chain_hash, signature, received_at, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.sequence,
      evidence.evidenceId,
      evidence.level,
      evidence.source,
      evidence.timestamp,
      evidence.payloadHash,
      evidence.previousEvidenceHash,
      evidence.chainHash,
      evidence.signature,
      entry.receivedAt,
      JSON.stringify(evidence.payload)
    );

    this.lastChainHashes.set(key, evidence.chainHash);

    // Checkpoint if interval reached
    if (this.globalSequence % this.config.checkpointInterval === 0) {
      await this.createCheckpoint();
    }

    return { sequence: this.globalSequence, chainHash: evidence.chainHash, verified: true };
  }

  async appendBatch(entries: EvidenceRecord[]): Promise<AppendResult[]> {
    const results: AppendResult[] = [];
    for (const evidence of entries) {
      results.push(await this.append(evidence));
    }
    return results;
  }

  // ========================================================================
  // Read Operations
  // ========================================================================

  async get(evidenceId: string): Promise<LedgerEntry | null> {
    const row = this.db.prepare('SELECT * FROM ledger_entries WHERE evidence_id = ?').get(evidenceId) as any;
    if (!row) return null;
    return this.rowToEntry(row);
  }

  async query(params: QueryParams): Promise<LedgerEntry[]> {
    let sql = 'SELECT * FROM ledger_entries WHERE 1=1';
    const args: any[] = [];

    if (params.level) {
      sql += ' AND level = ?';
      args.push(params.level);
    }
    if (params.source) {
      sql += ' AND source = ?';
      args.push(params.source);
    }
    if (params.startTime) {
      sql += ' AND timestamp >= ?';
      args.push(params.startTime);
    }
    if (params.endTime) {
      sql += ' AND timestamp <= ?';
      args.push(params.endTime);
    }
    sql += ' ORDER BY sequence DESC';
    
    if (params.limit) {
      sql += ' LIMIT ?';
      args.push(params.limit);
    }
    if (params.offset) {
      sql += ' OFFSET ?';
      args.push(params.offset);
    }

    const rows = this.db.prepare(sql).all(...args) as any[];
    return rows.map(r => this.rowToEntry(r));
  }

  // ========================================================================
  // Chain Verification
  // ========================================================================

  async verifyChain(params: VerifyChainParams): Promise<ChainVerificationResult> {
    let sql = 'SELECT * FROM ledger_entries WHERE source = ? AND level = ?';
    const args: (string | number)[] = [params.source, params.level];
    
    if (params.fromSequence) {
      sql += ' AND sequence >= ?';
      args.push(params.fromSequence);
    }
    if (params.toSequence) {
      sql += ' AND sequence <= ?';
      args.push(params.toSequence);
    }
    sql += ' ORDER BY sequence ASC';

    const rows = this.db.prepare(sql).all(...args) as any[];
    
    let prevHash: string | null = null;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const expected = this.computeChainHash(row.payload_hash, prevHash);
      
      if (row.chain_hash !== expected) {
        return { ok: false, entriesVerified: i, brokenAt: row.sequence, expected, actual: row.chain_hash };
      }
      
      // Verify signature
      if (!this.verifySignature(row.chain_hash, row.signature)) {
        return { ok: false, entriesVerified: i, brokenAt: row.sequence, expected: 'valid signature', actual: 'invalid signature' };
      }
      
      prevHash = row.chain_hash;
    }

    return { ok: true, entriesVerified: rows.length };
  }

  // ========================================================================
  // Checkpointing
  // ========================================================================

  async createCheckpoint(atSequence?: number): Promise<Checkpoint> {
    const sequence = atSequence || this.globalSequence;
    const timestamp = new Date().toISOString();
    
    const levelCheckpoints: Record<string, LevelCheckpoint> = {};
    const levels = ['E0', 'E1', 'E2', 'E3', 'E4'];
    
    for (const level of levels) {
      const row = this.db.prepare('SELECT * FROM ledger_entries WHERE level = ? ORDER BY sequence DESC LIMIT 1').get(level) as any;
      if (row) {
        const count = this.db.prepare('SELECT COUNT(*) as c FROM ledger_entries WHERE level = ?').get(level) as any;
        levelCheckpoints[level] = {
          lastSequence: row.sequence,
          lastChainHash: row.chain_hash,
          entryCount: count.c
        };
      }
    }

    const merkleRoot = this.computeMerkleRoot(levelCheckpoints);

    const checkpoint: Checkpoint = {
      globalSequence: sequence,
      timestamp,
      levelCheckpoints,
      merkleRoot
    };

    this.db.prepare('INSERT INTO checkpoints (global_sequence, timestamp, level_checkpoints, merkle_root) VALUES (?, ?, ?, ?)')
      .run(sequence, timestamp, JSON.stringify(levelCheckpoints), merkleRoot);

    return checkpoint;
  }

  async getCheckpoint(params: CheckpointParams): Promise<Checkpoint | null> {
    let row: any;
    if (params.atSequence) {
      row = this.db.prepare('SELECT * FROM checkpoints WHERE global_sequence = ?').get(params.atSequence);
    } else {
      row = this.db.prepare('SELECT * FROM checkpoints ORDER BY global_sequence DESC LIMIT 1').get();
    }
    if (!row) return null;
    return {
      globalSequence: row.global_sequence,
      timestamp: row.timestamp,
      levelCheckpoints: JSON.parse(row.level_checkpoints),
      merkleRoot: row.merkle_root
    };
  }

  async *replayFrom(checkpoint: Checkpoint): AsyncIterator<LedgerEntry> {
    const rows = this.db.prepare('SELECT * FROM ledger_entries WHERE sequence > ? ORDER BY sequence ASC')
      .all(checkpoint.globalSequence) as any[];
    
    for (const row of rows) {
      yield this.rowToEntry(row);
    }
  }

  // ========================================================================
  // Federation
  // ========================================================================

  async importEvidence(evidence: EvidenceRecord, federationRef: string): Promise<ImportResult> {
    try {
      // Verify signature with federation gateway key (would be configured per treaty)
      if (!this.verifySignature(evidence.chainHash, evidence.signature)) {
        throw new Error('Federation signature verification failed');
      }

      const result = await this.append(evidence);
      
      // Record federation import
      this.db.prepare(`
        UPDATE ledger_entries SET federation_ref = ? WHERE evidence_id = ?
      `).run(federationRef, evidence.evidenceId);

      return { imported: 1, failed: 0, evidenceRefs: [evidence.evidenceId] };
    } catch (error) {
      return { imported: 0, failed: 1, evidenceRefs: [] };
    }
  }

  async exportEvidence(evidenceIds: string[]): Promise<ExportPackage> {
    const evidence: EvidenceRecord[] = [];
    const causality: CausalityRecord[] = [];
    const events: EventRecord[] = [];
    
    for (const id of evidenceIds) {
      const entry = await this.get(id);
      if (entry) evidence.push(entry.evidence);
    }

    // Fetch relevant causality and events
    // Simplified - in production would traverse lineage

    const packageId = `PKG-OSA-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 8)}`;
    const merkleRoot = this.computeMerkleRootFromEvidence(evidence);
    
    return {
      packageId,
      treatyId: '', // Would be set by caller
      exportedAt: new Date().toISOString(),
      evidence,
      causality,
      events,
      chainProof: {
        evidenceId: evidence[0]?.evidenceId || '',
        merkleRoot,
        merklePath: [],
        leafIndex: 0
      },
      exporterSignature: this.sign(merkleRoot)
    };
  }

  // ========================================================================
  // Utility
  // ========================================================================

  private computeChainHash(payloadHash: string, previousHash: string | null): string {
    const combined = previousHash ? payloadHash + previousHash : payloadHash + 'GENESIS';
    return `sha3-256:${createHash('sha3-256').update(combined).digest('hex')}`;
  }

  private computeMerkleRoot(levelCheckpoints: Record<string, LevelCheckpoint>): string {
    const leaves = Object.values(levelCheckpoints).map(c => c.lastChainHash);
    return this.merkleRoot(leaves);
  }

  private computeMerkleRootFromEvidence(evidence: EvidenceRecord[]): string {
    const leaves = evidence.map(e => e.chainHash);
    return this.merkleRoot(leaves);
  }

  private merkleRoot(leaves: string[]): string {
    if (leaves.length === 0) return `sha3-256:${createHash('sha3-256').update('EMPTY').digest('hex')}`;
    if (leaves.length === 1) return leaves[0];
    
    const nextLevel: string[] = [];
    for (let i = 0; i < leaves.length; i += 2) {
      const left = leaves[i];
      const right = leaves[i + 1] || left;
      nextLevel.push(`sha3-256:${createHash('sha3-256').update(left + right).digest('hex')}`);
    }
    return this.merkleRoot(nextLevel);
  }

  private sign(data: string): string {
    // Ed25519 signing - placeholder
    return `ed25519:${createHash('sha3-256').update(data + this.config.signingKey.toString()).digest('hex').slice(0, 64)}`;
  }

  private verifySignature(data: string, signature: string): boolean {
    // Ed25519 verification - placeholder
    const expected = this.sign(data);
    return signature === expected;
  }

  private rowToEntry(row: any): LedgerEntry {
    return {
      sequence: row.sequence,
      evidence: {
        evidenceId: row.evidence_id,
        level: row.level,
        timestamp: row.timestamp,
        source: row.source,
        payload: JSON.parse(row.payload_json),
        payloadHash: row.payload_hash,
        previousEvidenceHash: row.previous_hash,
        chainHash: row.chain_hash,
        signature: row.signature
      },
      receivedAt: row.received_at,
      federationRef: row.federation_ref
    };
  }

  close(): void {
    if (this.checkpointTimer) clearInterval(this.checkpointTimer);
    this.db.close();
  }
}