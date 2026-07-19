// Test Vector: Evidence (L3-EP, L3-CV, L3-CC, L3-CB, L3-RD)
// Normative: OSA-Conformance-Specification-v1.0.md §5

import { EvidenceId, EvidenceSource, Timestamp, Hash, Signature, createEvidenceSource, now, randomUUID } from '@osa/constitutional-types';

export const evidenceVectors = {
  'L3-EP-001': {
    id: 'L3-EP-001',
    level: 'L3' as const,
    category: 'evidence-production',
    description: 'Sensor gateway produces valid E₀ evidence',
    setup: {
      preconditions: ['GPS sensor SAT-123 active', 'Sensor gateway configured'],
      fixtures: {}
    },
    input: {
      sensorType: 'GPS',
      satelliteId: 'SAT-123',
      reading: { lat: 45.123, lon: -122.456, alt: 408000, velocity: 7660 },
      metadata: { instrument: 'GPS-Receiver', mode: 'precise', calibrationVersion: 'v2.1' }
    },
    expected: {
      status: 'PASS',
      output: {
        evidenceId: 'E0-OSA-TEL-20260719-0001',
        level: 'E0',
        validSignature: true,
        chainHash: 'sha3-256:valid'
      },
      evidence: { level: 'E0', minCount: 1 }
    },
    evidenceRequirements: { level: 'E0', trigger: 'sensor_reading', required: true },
    timeoutMs: 5000,
    retryCount: 0,
    deterministic: true
  },

  'L3-EP-002': {
    id: 'L3-EP-002',
    level: 'L3' as const,
    category: 'evidence-production',
    description: 'Processor produces valid E₁ with refs',
    input: {
      transform: {
        type: 'ORBIT_DETERMINATION',
        algorithm: 'batch_least_squares',
        version: '2.1.0',
        parameters: { gravityModel: 'EGM2008', dragModel: 'NRLMSISE-00' },
        softwareHash: 'sha3-256:processor-artifact',
        softwareVersion: '2.1.0'
      },
      inputEvidenceRefs: ['E0-OSA-TEL-001', 'E0-OSA-TEL-002', 'E0-OSA-TEL-003'],
      payload: { orbitalElements: { sma: 6778.137, ecc: 0.000123, inc: 51.6416 } }
    },
    expected: {
      status: 'PASS',
      output: { level: 'E1', inputRefsValid: true, transformSpecComplete: true },
      evidence: { level: 'E1', minCount: 1 }
    },
    evidenceRequirements: { level: 'E1', trigger: 'transform_complete', required: true },
    timeoutMs: 5000
  },

  'L3-EP-003': {
    id: 'L3-EP-003',
    level: 'L3' as const,
    category: 'evidence-production',
    description: 'Decision produces valid E₂ with all refs',
    input: {
      authorityRef: 'auth:osa:orbital-awareness:satellite-tracking',
      policyRef: 'pol:osa:orbital-tracking:v1.2',
      policyVersionHash: 'sha3-256:policy-wasm-hash',
      kernelAuthorizationRef: 'authz:gk:20260719-0001',
      inputEvidenceRefs: ['E1-OSA-ORB-001', 'E1-OSA-ORB-002'],
      decision: {
        type: 'CONJUNCTION_ASSESSMENT',
        primary: 'SAT-123', secondary: 'SAT-456',
        tca: '2026-07-19T18:30:00Z',
        missDistanceKm: 1.2,
        collisionProbability: 0.023,
        action: 'alert_issued',
        alertLevel: 'YELLOW'
      },
      replayContext: { policyWasmHash: 'sha3-256:policy-wasm-hash', inputEvidenceHashes: ['sha3-256:E1-001', 'sha3-256:E1-002'], runtimeVersion: 'decision-engine-1.0.0' }
    },
    expected: {
      status: 'PASS',
      output: { 
        level: 'E2', 
        authorityRefValid: true, 
        policyRefValid: true, 
        kernelAuthzValid: true,
        replayWorks: true 
      },
      evidence: { level: 'E2', minCount: 1, requiredRefs: ['authority_ref', 'policy_ref', 'kernel_authorization_ref', 'input_evidence_refs'] }
    },
    evidenceRequirements: { level: 'E2', trigger: 'authority_exercise', required: true },
    timeoutMs: 5000
  },

  'L3-EP-004': {
    id: 'L3-EP-004',
    level: 'L3' as const,
    category: 'evidence-production',
    description: 'Audit produces valid E₃ with findings',
    input: {
      auditor: 'constitutional-review-council',
      auditType: 'ROUTINE_COMPLIANCE',
      subjectEvidenceRefs: ['E2-OSA-ORB-001', 'E2-OSA-ORB-002'],
      findings: [
        { rule: 'ACC-CONFORMANCE-2', status: 'COMPLIANT', details: 'E2 evidence produced for all exercises' },
        { rule: 'CSD-T-004', status: 'COMPLIANT', details: 'Decision produces E2 evidence' }
      ],
      remediationRefs: [],
      riskAssessment: 'NONE'
    },
    expected: {
      status: 'PASS',
      output: { level: 'E3', auditorAuthorized: true, findingsStructured: true },
      evidence: { level: 'E3', minCount: 1 }
    },
    evidenceRequirements: { level: 'E3', trigger: 'audit_complete', required: true },
    timeoutMs: 5000
  },

  'L3-EP-005': {
    id: 'L3-EP-005',
    level: 'L3' as const,
    category: 'evidence-production',
    description: 'Constitutional act produces valid E₄',
    input: {
      constitutionalAct: 'TREATY_RATIFICATION',
      actRef: 'treaty:osa:earthos-pilot-b:20260719',
      authorityBasis: 'OSA-Constitution-v1.0 Article 8',
      participants: ['OSA', 'EarthOS-Pilot-B'],
      process: {
        type: 'VOTE',
        threshold: '2/3',
        votes: { 'OSA': 'YES', 'EarthOS-Pilot-B': 'YES' }
      },
      outcome: { result: 'RATIFIED', effectiveDate: '2026-07-19' },
      artifactsHash: 'sha3-256:treaty-document-hash'
    },
    expected: {
      status: 'PASS',
      output: { level: 'E4', authorizedBody: true, processValid: true },
      evidence: { level: 'E4', minCount: 1 }
    },
    evidenceRequirements: { level: 'E4', trigger: 'constitutional_act', required: true },
    timeoutMs: 5000
  },

  // Chain Verification
  'L3-CV-001': {
    id: 'L3-CV-001',
    level: 'L3' as const,
    category: 'chain-verification',
    description: 'Single-source single-level chain valid',
    input: { source: 'sensor:sat-123:gps', level: 'E0', count: 1000 },
    expected: { status: 'PASS', output: { verified: true, entriesVerified: 1000 } },
    timeoutMs: 30000
  },

  'L3-CV-002': {
    id: 'L3-CV-002',
    level: 'L3' as const,
    category: 'chain-verification',
    description: 'Multi-source chain valid',
    input: { sources: ['sensor:sat-123:gps', 'processor:orbital-determinator:v2.1'], level: 'E1', count: 5000 },
    expected: { status: 'PASS', output: { verified: true } },
    timeoutMs: 30000
  },

  'L3-CV-003': {
    id: 'L3-CV-003',
    level: 'L3' as const,
    category: 'chain-verification',
    description: 'Tampered payload detected',
    input: { source: 'agent:tracker', level: 'E2', tamperedEntry: 42, tamperType: 'payload_bit_flip' },
    expected: { status: 'PASS', output: { detected: true, brokenAt: 42 } },
    timeoutMs: 30000
  },

  'L3-CV-004': {
    id: 'L3-CV-004',
    level: 'L3' as const,
    category: 'chain-verification',
    description: 'Tampered chain_hash detected',
    input: { source: 'governance-kernel', level: 'E3', tamperedEntry: 17, tamperType: 'chain_hash_modified' },
    expected: { status: 'PASS', output: { detected: true, brokenAt: 17 } },
    timeoutMs: 30000
  },

  'L3-CV-005': {
    id: 'L3-CV-005',
    level: 'L3' as const,
    category: 'chain-verification',
    description: 'Missing previous entry detected',
    input: { source: 'processor:orbital-determinator:v2.1', level: 'E1', missingSequence: 100 },
    expected: { status: 'PASS', output: { detected: true, brokenAt: 100 } },
    timeoutMs: 30000
  },

  'L3-CV-006': {
    id: 'L3-CV-006',
    level: 'L3' as const,
    category: 'chain-verification',
    description: 'Genesis chain_hash correct',
    input: { source: 'sensor:sat-123:gps', level: 'E0' },
    expected: { status: 'PASS', output: { genesisValid: true } },
    timeoutMs: 5000
  },

  // Causality Completeness
  'L3-CC-001': {
    id: 'L3-CC-001',
    level: 'L3' as const,
    category: 'causality-completeness',
    description: 'All E₁ refs have PROCESSES causality',
    input: { level: 'E1', count: 1000 },
    expected: { status: 'PASS', output: { complete: true, missingCount: 0 } },
    timeoutMs: 10000
  },

  'L3-CC-002': {
    id: 'L3-CC-002',
    level: 'L3' as const,
    category: 'causality-completeness',
    description: 'All E₂ refs have INPUTS_TO causality',
    input: { level: 'E2', count: 1000 },
    expected: { status: 'PASS', output: { complete: true } },
    timeoutMs: 10000
  },

  'L3-CC-003': {
    id: 'L3-CC-003',
    level: 'L3' as const,
    category: 'causality-completeness',
    description: 'All E₃ refs have AUDITS causality',
    input: { level: 'E3', count: 100 },
    expected: { status: 'PASS', output: { complete: true } },
    timeoutMs: 10000
  },

  'L3-CC-004': {
    id: 'L3-CC-004',
    level: 'L3' as const,
    category: 'causality-completeness',
    description: 'All E₄ refs have GOVERNS causality',
    input: { level: 'E4', count: 10 },
    expected: { status: 'PASS', output: { complete: true } },
    timeoutMs: 10000
  },

  'L3-CC-005': {
    id: 'L3-CC-005',
    level: 'L3' as const,
    category: 'causality-completeness',
    description: 'No orphan references in evidence',
    input: { fullScan: true },
    expected: { status: 'PASS', output: { orphans: 0 } },
    timeoutMs: 30000
  },

  // Constitutional Binding
  'L3-CB-001': {
    id: 'L3-CB-001',
    level: 'L3' as const,
    category: 'constitutional-binding',
    description: 'E₂ authority_ref resolves to valid grant',
    input: { evidenceId: 'E2-OSA-ORB-001', authorityRef: 'auth:osa:orbital-awareness:satellite-tracking' },
    expected: { status: 'PASS', output: { grantValid: true, grantActive: true } },
    timeoutMs: 5000
  },

  'L3-CB-002': {
    id: 'L3-CB-002',
    level: 'L3' as const,
    category: 'constitutional-binding',
    description: 'E₂ policy_ref resolves to compiled policy',
    input: { evidenceId: 'E2-OSA-ORB-001', policyRef: 'pol:osa:orbital-tracking:v1.2' },
    expected: { status: 'PASS', output: { policyCompiled: true, policyVerified: true } },
    timeoutMs: 5000
  },

  'L3-CB-003': {
    id: 'L3-CB-003',
    level: 'L3' as const,
    category: 'constitutional-binding',
    description: 'E₂ policy_version_hash matches Kernel WASM',
    input: { evidenceId: 'E2-OSA-ORB-001', expectedHash: 'sha3-256:kernel-wasm-hash' },
    expected: { status: 'PASS', output: { hashMatches: true } },
    timeoutMs: 5000
  },

  'L3-CB-004': {
    id: 'L3-CB-004',
    level: 'L3' as const,
    category: 'constitutional-binding',
    description: 'E₂ kernel_authorization_ref resolves to granted authz',
    input: { evidenceId: 'E2-OSA-ORB-001', authzRef: 'authz:gk:20260719-0001' },
    expected: { status: 'PASS', output: { authzGranted: true } },
    timeoutMs: 5000
  },

  'L3-CB-005': {
    id: 'L3-CB-005',
    level: 'L3' as const,
    category: 'constitutional-binding',
    description: 'E₂ evidence_requirement met',
    input: { evidenceId: 'E2-OSA-ORB-001', requiredLevel: 'E2', actualLevel: 'E2' },
    expected: { status: 'PASS', output: { requirementMet: true } },
    timeoutMs: 5000
  },

  // Replay Determinism
  'L3-RD-001': {
    id: 'L3-RD-001',
    level: 'L3' as const,
    category: 'replay-determinism',
    description: '1000 random decisions replay bitwise',
    input: { count: 1000, randomSeed: 'test-seed-2026' },
    expected: { status: 'PASS', output: { matches: 1000, divergences: 0 } },
    timeoutMs: 120000
  },

  'L3-RD-002': {
    id: 'L3-RD-002',
    level: 'L3' as const,
    category: 'replay-determinism',
    description: '100 random simulations replay bitwise',
    input: { count: 100, randomSeed: 'sim-seed-2026' },
    expected: { status: 'PASS', output: { matches: 100, divergences: 0 } },
    timeoutMs: 120000
  },

  'L3-RD-003': {
    id: 'L3-RD-003',
    level: 'L3' as const,
    category: 'replay-determinism',
    description: '100 random missions replay bitwise',
    input: { count: 100, randomSeed: 'mission-seed-2026' },
    expected: { status: 'PASS', output: { matches: 100, divergences: 0 } },
    timeoutMs: 120000
  },

  'L3-RD-004': {
    id: 'L3-RD-004',
    level: 'L3' as const,
    category: 'replay-determinism',
    description: 'Tampered WASM detected in replay',
    input: { evidenceId: 'E2-OSA-ORB-001', tamperedWasm: true },
    expected: { status: 'PASS', output: { divergenceDetected: true, point: 'policy_evaluation' } },
    timeoutMs: 10000
  },

  'L3-RD-005': {
    id: 'L3-RD-005',
    level: 'L3' as const,
    category: 'replay-determinism',
    description: 'Tampered input evidence detected in replay',
    input: { evidenceId: 'E2-OSA-ORB-001', tamperedInput: true },
    expected: { status: 'PASS', output: { divergenceDetected: true, point: 'input_evidence' } },
    timeoutMs: 10000
  }
};