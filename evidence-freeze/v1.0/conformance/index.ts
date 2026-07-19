// OSA Conformance Test Suite - Main Entry Point
// Normative: OSA-Conformance-Specification-v1.0.md

// L1 - Specification Compliance Tests
export * from './L1-spec-compliance/index.js';

// L2 - Runtime Behavioral Tests
export * from './L2-runtime-behavioral/index.js';

// L3 - Evidence Integrity Tests
export * from './L3-evidence-integrity/index.js';

// L4 - Constitutional Governance Tests
export * from './L4-constitutional-governance/index.js';

// L5 - Federation Interop Tests
export * from './L5-federation-interop/index.js';

// Test Runner & Harness
export { ConformanceRunner } from './runner/conformance-runner.js';
export { EvidenceValidator } from './runner/evidence-validator.js';
export { ReplayVerifier } from './runner/replay-verifier.js';
export { CausalityChecker } from './runner/causality-checker.js';
export { FederationSimulator } from './runner/federation-simulator.js';

// Test Vector Management
export { TestVectorLoader } from './vectors/test-vector-loader.js';
export { EvidenceTestVectors } from './vectors/evidence-vectors.js';
export { PolicyTestVectors } from './vectors/policy-vectors.js';
export { DecisionTestVectors } from './vectors/decision-vectors.js';
export { MissionTestVectors } from './vectors/mission-vectors.js';
export { FederationTestVectors } from './vectors/federation-vectors.js';
export { ConstitutionalActVectors } from './vectors/constitutional-act-vectors.js';

// Report Generation
export { CertificationReportGenerator } from './reporting/certification-report.js';
export { EvidenceSummaryGenerator } from './reporting/evidence-summary.js';

// Certification
export { L1Certifier, L2Certifier, L3Certifier, L4Certifier, L5Certifier } from './certification/index.js';

// Types
export type {
  TestVector, TestSetup, TestExpectation, TestExpectation, EvidenceExpectation,
  ErrorExpectation, MetricExpectation, TestResult, TestSuiteResult, TestReport,
  ConformanceLevel, CertificationResult
} from './types.js';

// Conformance Level Constants
export const CONFORMANCE_LEVELS = {
  L1: 'L1',
  L2: 'L2',
  L3: 'L3',
  L4: 'L4',
  L5: 'L5'
} as const;

export type ConformanceLevel = typeof CONFORMANCE_LEVELS[keyof typeof CONFORMANCE_LEVELS];

// Test ID Prefixes
export const TEST_ID_PREFIXES = {
  L1_SCHEMA: 'L1-SCHEMA',
  L1_META: 'L1-META',
  L1_API: 'L1-API',
  L1_STATIC: 'L1-STATIC',
  L2_GK: 'L2-GK',
  L2_PE: 'L2-PE',
  L2_DE: 'L2-DE',
  L2_MO: 'L2-MO',
  L2_AR: 'L2-AR',
  L2_SR: 'L2-SR',
  L2_RE: 'L2-RE',
  L2_VE: 'L2-VE',
  L2_EL: 'L2-EL',
  L3_EP: 'L3-EP',
  L3_CV: 'L3-CV',
  L3_CC: 'L3-CC',
  L3_CB: 'L3-CB',
  L3_RD: 'L3-RD',
  L4_AL: 'L4-AL',
  L4_PL: 'L4-PL',
  L4_DG: 'L4-DG',
  L4_AE: 'L4-AE',
  L4_CE: 'L4-CE',
  L4_SO: 'L4-SO',
  L4_PG: 'L4-PG',
  L5_TN: 'L5-TN',
  L5_TE: 'L5-TE',
  L5_EE: 'L5-EE',
  L5_RP: 'L5-RP',
  L5_AP: 'L5-AP',
  L5_CD: 'L5-CD'
} as const;

// Certification Requirements
export const CERTIFICATION_REQUIREMENTS = {
  L1: {
    description: 'Specification Compliance',
    requiredTests: ['L1-SCHEMA', 'L1-META', 'L1-API', 'L1-STATIC'],
    minPassRate: 1.0
  },
  L2: {
    description: 'Runtime Behavioral',
    requiredTests: ['L2-GK', 'L2-PE', 'L2-DE', 'L2-MO', 'L2-AR', 'L2-SR', 'L2-RE', 'L2-VE', 'L2-EL'],
    minPassRate: 1.0
  },
  L3: {
    description: 'Evidence Integrity',
    requiredTests: ['L3-EP', 'L3-CV', 'L3-CC', 'L3-CB', 'L3-RD'],
    minPassRate: 1.0
  },
  L4: {
    description: 'Constitutional Governance',
    requiredTests: ['L4-AL', 'L4-PL', 'L4-DG', 'L4-AE', 'L4-CE', 'L4-SO', 'L4-PG'],
    minPassRate: 1.0,
    productionMinimum: true
  },
  L5: {
    description: 'Federation Interop',
    requiredTests: ['L5-TN', 'L5-TE', 'L5-EE', 'L5-RP', 'L5-AP', 'L5-CD'],
    minPassRate: 1.0,
    federationRequired: true
  }
} as const;