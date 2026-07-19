// Evidence Validator - Validates evidence conformance
// Normative: OSA-Conformance-Specification-v1.0.md

import { EvidenceId, EvidenceSource, Timestamp, Hash, Signature, createEvidenceSource, now, randomUUID } from '@osa/constitutional-types';

export class EvidenceValidator {
  private ledgerClient: any;

  constructor(ledgerClient: any) {
    this.ledgerClient = ledgerClient;
  }

  async validate(evidence: any, requirements: any): Promise<void> {
    if (requirements.level && evidence.level !== requirements.level) {
      throw new Error(`Evidence level mismatch: expected ${requirements.level}, got ${evidence.level}`);
    }

    if (requirements.min_count && (!evidence.evidenceProduced || evidence.evidenceProduced.length < requirements.min_count)) {
      throw new Error(`Insufficient evidence produced: expected ${requirements.min_count}, got ${evidence.evidenceProduced?.length || 0}`);
    }

    if (requirements.required_refs) {
      for (const ref of requirements.required_refs) {
        if (!evidence.evidenceProduced?.some((e: string) => e.includes(ref))) {
          throw new Error(`Missing required evidence reference: ${ref}`);
        }
      }
    }

    if (requirements.chain_valid) {
      const chainResult = await this.ledgerClient.verifyChain({ source: evidence.source, level: evidence.level });
      if (!chainResult.ok) {
        throw new Error(`Chain verification failed at ${chainResult.brokenAt}: expected ${chainResult.expected}, got ${chainResult.actual}`);
      }
    }

    if (requirements.causality_complete) {
      const causalityResult = await this.checkCausality(evidence.evidenceProduced || []);
      if (!causalityResult.complete) {
        throw new Error(`Causality incomplete: missing ${causalityResult.missingRefs.length} references`);
      }
    }
  }

  async validateChain(params: { source: string; level: string; fromSequence?: number; toSequence?: number }): Promise<any> {
    return this.ledgerClient.verifyChain(params);
  }

  private async checkCausality(evidenceIds: string[]): Promise<{ complete: boolean; missingRefs: string[] }> {
    // In production: query causality ledger for each evidence
    return { complete: true, missingRefs: [] };
  }
}