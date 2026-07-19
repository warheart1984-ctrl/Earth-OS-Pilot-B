// Constitutional Types for OSA Rust SDK
// Normative: OSA-Constitution-v1.0.md, OSA-ACC-v1.0.md, OSA-CSD-v1.0.md, OSA-CECD-v1.0.md, OSA-ECED-v1.0.md

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use std::collections::HashMap;

// ============================================================================
// Core Identity Types (Branded Strings)
// ============================================================================

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AuthorityId(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PolicyId(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AuthorizationId(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct DecisionId(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct EvidenceId(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CausalityId(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct EventId(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AuditId(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Hash(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Signature(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Timestamp(pub DateTime<Utc>);

// ============================================================================
// Evidence Source (ECED §1.3)
// ============================================================================

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EvidenceSourceType {
    Sensor,
    Processor,
    Agent,
    GovernanceKernel,
    AuditEngine,
    RatificationAssembly,
    ConstitutionalReviewCouncil,
    EvidenceStewardshipBoard,
    PromotionAuthority,
    FederationGateway,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EvidenceSource {
    pub source_type: EvidenceSourceType,
    pub identifier: String,
    pub version: Option<String>,
}

impl EvidenceSource {
    pub fn new(source_type: EvidenceSourceType, identifier: String, version: Option<String>) -> Self {
        Self { source_type, identifier, version }
    }

    pub fn to_string(&self) -> String {
        match &self.version {
            Some(v) => format!("{}:{}:{}", self.source_type, self.identifier, v),
            None => format!("{}:{}", self.source_type, self.identifier),
        }
    }
}

// ============================================================================
// Evidence Levels (CECD §1, ECED §2)
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum EvidenceLevel {
    E0,
    E1,
    E2,
    E3,
    E4,
}

// ============================================================================
// Capability & Constraints (ACC §1.2)
// ============================================================================

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Capability {
    pub resource: String,
    pub action: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Constraints {
    pub time_window: Option<TimeWindow>,
    pub classification_max: Option<ClassificationLevel>,
    pub resource_filters: Option<Vec<ResourceFilter>>,
    pub context_requirements: Option<Vec<ContextRequirement>>,
    pub quota: Option<QuotaSpec>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TimeWindow {
    pub start: Timestamp,
    pub end: Timestamp,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum ClassificationLevel {
    Unclassified,
    Confidential,
    Secret,
    TopSecret,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResourceFilter {
    pub pattern: String,
    pub action: FilterAction,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FilterAction {
    Allow,
    Deny,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ContextRequirement {
    pub key: String,
    pub operator: ContextOperator,
    pub value: serde_json::Value,
    pub delegated_from: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ContextOperator {
    Eq,
    Ne,
    Gt,
    Gte,
    Lt,
    Lte,
    In,
    Contains,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct QuotaSpec {
    pub requests_per_second: u32,
    pub requests_per_day: u32,
    pub burst_allowance: u32,
}

// ============================================================================
// Revocation Triggers (ACC §2.4)
// ============================================================================

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "parameters")]
pub enum RevocationTrigger {
    Expiry,
    ClassificationBreach { max_level: ClassificationLevel },
    ScopeExceedance,
    EvidenceFailure,
    IdentityCompromise,
    ParentRevoked { parent_authority_id: AuthorityId },
}

// ============================================================================
// Evidence Level Requirement
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum EvidenceLevelRequirement {
    E2,
    E3,
    E4,
}

// ============================================================================
// Constitutional Metadata (CSD §2.2)
// ============================================================================

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ConstitutionalMetadata {
    pub authority: AuthorityId,
    pub evidence_level: EvidenceLevelRequirement,
    pub replay_required: bool,
    pub verification_required: bool,
    pub constitutional_version: String,
    pub acc_version: String,
    pub csd_version: String,
    pub cecd_version: Option<String>,
    pub eced_version: Option<String>,
}

// ============================================================================
// Action Specification
// ============================================================================

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ActionSpec {
    pub resource: String,
    pub action: String,
    pub context: Option<HashMap<String, serde_json::Value>>,
}

// ============================================================================
// Decision Context & Outcome (ECED §6)
// ============================================================================

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DecisionContext {
    pub actor: EvidenceSource,
    pub request: serde_json::Value,
    pub environment: HashMap<String, serde_json::Value>,
    pub constraints: Constraints,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DecisionOutcome {
    pub result: DecisionResult,
    pub action: Option<String>,
    pub classification: Option<String>,
    pub parameters: Option<HashMap<String, serde_json::Value>>,
    pub obligations: Option<Vec<Obligation>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum DecisionResult {
    Allow,
    Deny,
    Conditional,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Obligation {
    #[serde(rename = "type")]
    pub obligation_type: ObligationType,
    pub parameters: HashMap<String, serde_json::Value>,
    pub deadline: Option<Timestamp>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ObligationType {
    ProduceEvidence,
    EmitAudit,
    Notify,
    ScheduleReplay,
    ScheduleVerification,
}

// ============================================================================
// Policy Evaluation (RT §2.5)
// ============================================================================

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PolicyEvaluation {
    pub policy_wasm_hash: Hash,
    pub input_hash: Hash,
    pub result: DecisionResult,
    pub obligations: Vec<Obligation>,
    pub explanation: String,
    pub evaluation_timestamp: Timestamp,
    pub evaluator_version: String,
}

// ============================================================================
// Replay & Verification Context (ECED §3.3)
// ============================================================================

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ReplayContext {
    pub policy_wasm_hash: Hash,
    pub input_evidence_hashes: Vec<Hash>,
    pub runtime_version: String,
    pub deterministic_seed: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VerificationContext {
    pub verifier: EvidenceSource,
    pub method: VerificationMethod,
    pub verification_policy_hash: Option<Hash>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum VerificationMethod {
    Replay,
    IndependentEvaluation,
    FormalProof,
}

// ============================================================================
// Authorization Result (RT §1.3)
// ============================================================================

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AuthorizationResult {
    pub authorized: bool,
    pub authorization_id: Option<AuthorizationId>,
    pub evidence_ref: EvidenceId,
    pub reason: Option<String>,
    pub obligations: Vec<Obligation>,
}

// ============================================================================
// Authority Grant (ACC §1.2, §2.1)
// ============================================================================

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AuthorityGrant {
    pub authority_id: AuthorityId,
    pub holder: EvidenceSource,
    pub scope: Vec<Capability>,
    pub constraints: Constraints,
    pub delegation_permitted: bool,
    pub revocation_triggers: Vec<RevocationTrigger>,
    pub evidence_requirement: EvidenceLevelRequirement,
    pub issued_at: Timestamp,
    pub expires_at: Option<Timestamp>,
    pub constitutional_basis: String,
    pub evidence_ref: EvidenceId,
    pub signature: Signature,
}

// ============================================================================
// Revocation Result (ACC §2.4)
// ============================================================================

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RevocationResult {
    pub revoked: bool,
    pub authority_id: AuthorityId,
    pub trigger: RevocationTrigger,
    pub cascaded_delegations: Vec<AuthorityId>,
    pub evidence_ref: EvidenceId,
    pub timestamp: Timestamp,
}

// ============================================================================
// Compiled Policy (CSD §2.2, RT §2)
// ============================================================================

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CompiledPolicy {
    pub policy_id: PolicyId,
    pub wasm: Vec<u8>,
    pub wasm_hash: Hash,
    pub metadata: ConstitutionalMetadata,
    pub verification_proof: VerificationProof,
    pub compiled_at: Timestamp,
    pub compiled_by: EvidenceSource,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VerificationProof {
    pub proof_type: ProofType,
    pub formal_verification: Option<FormalVerificationResult>,
    pub conformance_tests: Option<Vec<ConformanceTestResult>>,
    pub verified_at: Timestamp,
    pub verified_by: EvidenceSource,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ProofType {
    FormalVerification,
    ConformanceTest,
    Both,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FormalVerificationResult {
    pub prover: String,
    pub version: String,
    pub properties_verified: Vec<String>,
    pub proof_artifact_hash: Hash,
    pub result: VerificationResult,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum VerificationResult {
    Pass,
    Fail,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ConformanceTestResult {
    pub test_id: String,
    pub name: String,
    pub result: VerificationResult,
    pub duration_ms: u64,
}

// ============================================================================
// Deployment & Validation Results (RT §2.6, §2.7)
// ============================================================================

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DeploymentResult {
    pub deployed: bool,
    pub policy_id: PolicyId,
    pub deployment_id: String,
    pub evidence_ref: EvidenceId,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
    pub evidence_ref: Option<EvidenceId>,
}

// ============================================================================
// Audit Types (CECD §3, RT §10)
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AuditEventType {
    AuthorityGrant,
    AuthorityExercise,
    AuthorityRevoke,
    AuthorityDelegate,
    PolicyCompiled,
    PolicyDeployed,
    PolicyRollback,
    KernelAuthzGranted,
    KernelAuthzDenied,
    DecisionMade,
    DecisionDenied,
    DecisionReplayed,
    DecisionVerified,
    ReplayDiverged,
    VerificationFailed,
    ChainVerified,
    ChainBroken,
    RoutineAudit,
    TriggeredAudit,
    FindingIssued,
    RemediationMandated,
    FederationEvent,
    ConstitutionalAmendment,
    TreatyRatified,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AuditFinding {
    pub rule: String,
    pub status: FindingStatus,
    pub details: String,
    pub evidence_refs: Option<Vec<EvidenceId>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FindingStatus {
    Compliant,
    NonCompliant,
    Partial,
    NotApplicable,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AuditRecord {
    pub audit_id: AuditId,
    pub event_type: AuditEventType,
    pub timestamp: Timestamp,
    pub actor: EvidenceSource,
    pub subject_refs: Vec<EvidenceId>,
    pub findings: Vec<AuditFinding>,
    pub risk_level: RiskLevel,
    pub evidence_ref: EvidenceId,
    pub chain_hash: Hash,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RiskLevel {
    Critical,
    High,
    Medium,
    Low,
    None,
}

// ============================================================================
// Constitutional State (RT §1.5)
// ============================================================================

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ConstitutionalState {
    pub authority_grants: HashMap<String, AuthorityGrant>,
    pub compiled_policies: HashMap<String, CompiledPolicy>,
    pub active_authorizations: HashMap<String, AuthorizationRecord>,
    pub revocation_list: Vec<String>,
    pub metadata: ConstitutionalMetadata,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AuthorizationRecord {
    pub authorization_id: AuthorizationId,
    pub authority_id: AuthorityId,
    pub holder: EvidenceSource,
    pub policy_id: PolicyId,
    pub input_evidence: Vec<EvidenceId>,
    pub context: DecisionContext,
    pub granted: bool,
    pub timestamp: Timestamp,
    pub evidence_ref: EvidenceId,
}

// ============================================================================
// Decision Record (ECED §3.3, §6.2)
// ============================================================================

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DecisionRecord {
    pub decision_type: String,
    pub timestamp: String,
    pub actor: EvidenceSource,
    pub context: DecisionRecordContext,
    pub outcome: DecisionOutcome,
    pub rationale: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DecisionRecordContext {
    pub policy_inputs: serde_json::Value,
    pub authority_constraints: Constraints,
    pub environmental_state: HashMap<String, serde_json::Value>,
}

// ============================================================================
// Replay Types (RT §7)
// ============================================================================

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ReplayParams {
    pub decision_id: DecisionId,
    pub policy_wasm_hash: Hash,
    pub input_evidence_hashes: Vec<Hash>,
    pub runtime_version: String,
    pub deterministic_seed: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ReplayResult {
    pub original_outcome: DecisionOutcome,
    pub replay_outcome: Option<DecisionOutcome>,
    pub match_result: bool,
    pub divergence_details: Option<DivergenceDetails>,
    pub evidence_ref: EvidenceId,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DivergenceDetails {
    pub point: String,
    pub original_hash: Hash,
    pub replay_hash: Hash,
}

// ============================================================================
// Evidence Ledger Types (OSA-Evidence-Specification-v1.0.md)
// ============================================================================

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EvidenceLedgerEntry {
    pub evidence_id: EvidenceId,
    pub level: EvidenceLevel,
    pub timestamp: Timestamp,
    pub source: EvidenceSource,
    pub authority_ref: Option<AuthorityId>,
    pub policy_ref: Option<PolicyId>,
    pub policy_version_hash: Option<Hash>,
    pub kernel_authorization_ref: Option<AuthorizationId>,
    pub input_evidence_refs: Vec<EvidenceId>,
    pub decision: Option<DecisionRecord>,
    pub payload_hash: Hash,
    pub previous_evidence_hash: Option<Hash>,
    pub chain_hash: Hash,
    pub signature: Signature,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AppendResult {
    pub sequence: u64,
    pub chain_hash: Hash,
    pub verified: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct QueryParams {
    pub level: Option<EvidenceLevel>,
    pub source: Option<String>,
    pub start_time: Option<Timestamp>,
    pub end_time: Option<Timestamp>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VerifyChainParams {
    pub source: String,
    pub level: EvidenceLevel,
    pub from_sequence: Option<u64>,
    pub to_sequence: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChainVerificationResult {
    pub ok: bool,
    pub entries_verified: u64,
    pub broken_at: Option<u64>,
    pub expected: Option<Hash>,
    pub actual: Option<Hash>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Checkpoint {
    pub global_sequence: u64,
    pub timestamp: Timestamp,
    pub level_checkpoints: HashMap<String, LevelCheckpoint>,
    pub merkle_root: Hash,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LevelCheckpoint {
    pub last_sequence: u64,
    pub last_chain_hash: Hash,
    pub entry_count: u64,
}

// ============================================================================
// Utility Functions
// ============================================================================

impl Timestamp {
    pub fn now() -> Self {
        Self(Utc::now())
    }
}

impl From<DateTime<Utc>> for Timestamp {
    fn from(dt: DateTime<Utc>) -> Self {
        Self(dt)
    }
}

impl From<Timestamp> for DateTime<Utc> {
    fn from(ts: Timestamp) -> Self {
        ts.0
    }
}

pub fn create_authority_id(value: String) -> AuthorityId {
    AuthorityId(value)
}

pub fn create_policy_id(value: String) -> PolicyId {
    PolicyId(value)
}

pub fn create_evidence_id(value: String) -> EvidenceId {
    EvidenceId(value)
}

pub fn create_hash(value: String) -> Hash {
    Hash(value)
}

pub fn create_signature(value: String) -> Signature {
    Signature(value)
}

pub fn random_uuid() -> String {
    Uuid::new_v4().to_string()
}