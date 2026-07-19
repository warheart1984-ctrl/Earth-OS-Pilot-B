// Test Vector: Policy Lifecycle (L2-PE, L4-PL)
// Normative: OSA-Conformance-Specification-v1.0.md §4.2, §6.2

import { EvidenceSource, Timestamp, Hash, createEvidenceSource, now, randomUUID } from '@osa/constitutional-types';

export const policyVectors = {
  'L2-PE-001': {
    id: 'L2-PE-001',
    level: 'L2' as const,
    category: 'policy-engine',
    description: 'Rego → WASM compilation succeeds',
    setup: {
      preconditions: ['Policy Engine running', 'OPA compiler available'],
      fixtures: {}
    },
    input: {
      source: `
package osa.orbital.awareness

__constitutional__ := {
  "authority": "auth:osa:orbital-awareness:satellite-tracking",
  "evidence_level": "E2",
  "replay_required": true,
  "verification_required": true,
  "constitutional_version": "OSA-Constitution-v1.0",
  "acc_version": "OSA-ACC-v1.0",
  "csd_version": "OSA-CSD-v1.0"
}

allow_tracking(agent, satellite) {
  has_authority(agent, "satellite:catalog", "read")
  satellite.classification <= agent.clearance
  not revoked(agent.authority_id)
}

evidence_decision(decision) {
  decision.evidence_level = "E2"
  decision.authority_ref = input.authority_id
  decision.policy_ref = "pol:osa:orbital-tracking:v1.2"
  decision.kernel_authz_ref = input.kernel_authz_id
}
`,
      metadata: {
        authority: 'auth:osa:orbital-awareness:satellite-tracking',
        evidenceLevel: 'E2' as const,
        replayRequired: true,
        verificationRequired: true,
        constitutionalVersion: 'OSA-Constitution-v1.0',
        accVersion: 'OSA-ACC-v1.0',
        csdVersion: 'OSA-CSD-v1.0',
        cecdVersion: 'OSA-CECD-v1.0',
        ecedVersion: 'OSA-ECED-v1.0'
      }
    },
    expected: {
      status: 'PASS',
      output: { compiled: true, wasmSize: 1024, wasmHash: 'sha3-256:expected' },
      evidence: { level: 'E2', minCount: 1, requiredRefs: ['wasm', 'wasm_hash', 'verification_proof'] }
    },
    evidenceRequirements: { level: 'E2', trigger: 'policy_compile', required: true },
    timeoutMs: 30000,
    retryCount: 1,
    deterministic: true
  },

  'L2-PE-002': {
    id: 'L2-PE-002',
    level: 'L2' as const,
    category: 'policy-engine',
    description: 'Verification proof generated',
    input: { policyId: 'pol:osa:orbital-tracking:v1.2' },
    expected: {
      status: 'PASS',
      output: { verificationProof: { proofType: 'CONFORMANCE_TEST', testsPassed: 8 } }
    },
    timeoutMs: 30000
  },

  'L2-PE-003': {
    id: 'L2-PE-003',
    level: 'L2' as const,
    category: 'policy-engine',
    description: 'Policy evaluation deterministic',
    input: {
      policyId: 'pol:osa:orbital-tracking:v1.2',
      input: { authority: 'auth:osa:orbital-awareness:satellite-tracking', holder: 'agent:tracker', action: { resource: 'satellite:catalog', action: 'read' }, environment: { classification: 'UNCLASSIFIED' }, evidence: ['E1-OSA-ORB-001'] }
    },
    expected: {
      status: 'PASS',
      output: { result: 'ALLOW', deterministic: true }
    },
    timeoutMs: 5000
  },

  'L2-PE-004': {
    id: 'L2-PE-004',
    level: 'L2' as const,
    category: 'policy-engine',
    description: 'Constitutional metadata enforced',
    input: {
      source: `
package osa.test

# Missing __constitutional__ metadata
allow() { true }
`
    },
    expected: {
      status: 'FAIL',
      error: { code: 'MISSING_CONSTITUTIONAL_METADATA', messageContains: '__constitutional__' }
    },
    timeoutMs: 5000
  },

  'L2-PE-005': {
    id: 'L2-PE-005',
    level: 'L2' as const,
    category: 'policy-engine',
    description: 'Policy version lineage maintained',
    input: { policyId: 'pol:osa:orbital-tracking:v1.2', newVersion: 'v1.3' },
    expected: {
      status: 'PASS',
      output: { lineageMaintained: true, previousVersion: 'v1.2' }
    },
    timeoutMs: 5000
  },

  'L4-PL-001': {
    id: 'L4-PL-001',
    level: 'L4' as const,
    category: 'policy-lifecycle',
    description: 'Compile → verify → deploy → execute full lifecycle',
    setup: {
      preconditions: ['Policy Engine running', 'Governance Kernel running'],
      fixtures: {}
    },
    input: {
      source: `
package osa.test.lifecycle

__constitutional__ := {
  "authority": "auth:osa:test:lifecycle",
  "evidence_level": "E2",
  "replay_required": true,
  "verification_required": true,
  "constitutional_version": "OSA-Constitution-v1.0",
  "acc_version": "OSA-ACC-v1.0",
  "csd_version": "OSA-CSD-v1.0"
}

allow(actor, resource) {
  has_authority(actor, resource, "read")
}
`,
      metadata: {
        authority: 'auth:osa:test:lifecycle',
        evidenceLevel: 'E2' as const,
        replayRequired: true,
        verificationRequired: true,
        constitutionalVersion: 'OSA-Constitution-v1.0',
        accVersion: 'OSA-ACC-v1.0',
        csdVersion: 'OSA-CSD-v1.0',
        cecdVersion: 'OSA-CECD-v1.0',
        ecedVersion: 'OSA-ECED-v1.0'
      }
    },
    expected: {
      status: 'PASS',
      output: { compiled: true, verified: true, deployed: true, executed: true },
      evidence: { level: 'E2', minCount: 4, requiredRefs: ['compilation', 'verification', 'deployment', 'execution'] }
    },
    evidenceRequirements: { level: 'E2', trigger: 'policy_lifecycle', required: true },
    timeoutMs: 60000,
    retryCount: 1,
    deterministic: true
  },

  'L4-PL-002': {
    id: 'L4-PL-002',
    level: 'L4' as const,
    category: 'policy-lifecycle',
    description: 'Policy update invalidates old WASM',
    input: { oldPolicyId: 'pol:osa:test:v1.2', newPolicyId: 'pol:osa:test:v1.3' },
    expected: { status: 'PASS', output: { oldWasmInvalidated: true } },
    timeoutMs: 5000
  },

  'L4-PL-003': {
    id: 'L4-PL-003',
    level: 'L4' as const,
    category: 'policy-lifecycle',
    description: 'Policy rollback produces evidence',
    input: { policyId: 'pol:osa:test:v1.3', rollbackTo: 'pol:osa:test:v1.2' },
    expected: { status: 'PASS', evidence: { level: 'E2', minCount: 1 } },
    timeoutMs: 5000
  },

  'L4-PL-004': {
    id: 'L4-PL-004',
    level: 'L4' as const,
    category: 'policy-lifecycle',
    description: 'Unverified policy rejected',
    input: { policyId: 'pol:osa:unverified:v1.0', verificationProof: null },
    expected: { status: 'FAIL', error: { code: 'VERIFICATION_FAILED' } },
    timeoutMs: 5000
  }
};