// Kernel Client - Governance Kernel HTTP client
// Normative: OSA-CGL-v1.0.md, OSA-Runtime-Specifications-v1.0.md §1

use reqwest::Client;
use serde::{Deserialize, Serialize};
use super::types::*;
use crate::types::*;

#[derive(Clone)]
pub struct KernelClient {
    client: Client,
    endpoint: String,
    auth_token: Option<String>,
}

impl KernelClient {
    pub fn new(endpoint: &str) -> Self {
        Self {
            client: Client::new(),
            endpoint: endpoint.trim_end_matches('/').to_string(),
            auth_token: None,
        }
    }

    pub fn with_auth(mut self, token: String) -> Self {
        self.auth_token = Some(token);
        self
    }

    fn auth_header(&self, mut req: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        if let Some(token) = &self.auth_token {
            req = req.header("Authorization", format!("Bearer {}", token));
        }
        req
    }

    async fn request<T: for<'de> Deserialize<'de>>(&self, path: &str, body: Option<&impl Serialize>) -> Result<T, reqwest::Error> {
        let url = format!("{}{}", self.endpoint, path);
        let mut req = self.client.post(&url).json(body.unwrap_or(&serde_json::json!({})));
        req = self.auth_header(req);
        req = req.header("Content-Type", "application/json");
        req = req.header("X-OSA-Request-ID", Uuid::new_v4().to_string());
        req = req.header("X-OSA-Timestamp", Utc::now().to_rfc3339());

        let response = req.send().await?;
        if !response.status().is_success() {
            return Err(response.error_for_status().unwrap_err());
        }
        response.json().await
    }

    // Authority Management
    pub async fn verify_authority(&self, params: VerifyAuthorityParams) -> Result<AuthorizationResult, reqwest::Error> {
        self.request("/api/v1/kernel/authority/verify", Some(&params)).await
    }

    pub async fn grant_authority(&self, params: GrantAuthorityParams) -> Result<AuthorityGrant, reqwest::Error> {
        self.request("/api/v1/kernel/authority/grant", Some(&params)).await
    }

    pub async fn revoke_authority(&self, params: RevokeAuthorityParams) -> Result<RevocationResult, reqwest::Error> {
        self.request("/api/v1/kernel/authority/revoke", Some(&params)).await
    }

    pub async fn delegate_authority(&self, params: DelegateAuthorityParams) -> Result<AuthorityGrant, reqwest::Error> {
        self.request("/api/v1/kernel/authority/delegate", Some(&params)).await
    }

    // Policy Management
    pub async fn compile_policy(&self, params: CompilePolicyParams) -> Result<CompiledPolicy, reqwest::Error> {
        self.request("/api/v1/kernel/policy/compile", Some(&params)).await
    }

    pub async fn deploy_policy(&self, params: DeployPolicyParams) -> Result<DeploymentResult, reqwest::Error> {
        self.request("/api/v1/kernel/policy/deploy", Some(&params)).await
    }

    pub async fn validate_policy(&self, params: ValidatePolicyParams) -> Result<ValidationResult, reqwest::Error> {
        self.request("/api/v1/kernel/policy/validate", Some(&params)).await
    }

    // Decision Authorization
    pub async fn authorize_decision(&self, params: AuthorizeDecisionParams) -> Result<AuthorizationResult, reqwest::Error> {
        self.request("/api/v1/kernel/decision/authorize", Some(&params)).await
    }

    // Audit
    pub async fn emit_audit(&self, params: EmitAuditParams) -> Result<AuditRecord, reqwest::Error> {
        self.request("/api/v1/kernel/audit", Some(&params)).await
    }

    // State
    pub async fn get_constitutional_state(&self) -> Result<ConstitutionalState, reqwest::Error> {
        self.request("/api/v1/kernel/state", None).await
    }
}

// Request/Response Types
#[derive(Debug, Serialize)]
pub struct VerifyAuthorityParams {
    pub authority_id: AuthorityId,
    pub holder: EvidenceSource,
    pub action: ActionSpec,
    pub context: DecisionContext,
}

#[derive(Debug, Serialize)]
pub struct GrantAuthorityParams {
    pub holder: EvidenceSource,
    pub scope: Vec<Capability>,
    pub constraints: Constraints,
    pub delegation_permitted: bool,
    pub revocation_triggers: Vec<RevocationTrigger>,
    pub evidence_requirement: EvidenceLevelRequirement,
    pub constitutional_basis: String,
    pub expires_at: Option<Timestamp>,
}

#[derive(Debug, Serialize)]
pub struct RevokeAuthorityParams {
    pub authority_id: AuthorityId,
    pub trigger: RevocationTrigger,
    pub evidence: EvidenceId,
}

#[derive(Debug, Serialize)]
pub struct DelegateAuthorityParams {
    pub parent_authority_id: AuthorityId,
    pub delegatee: EvidenceSource,
    pub scope: Vec<Capability>,
    pub constraints: Constraints,
}

#[derive(Debug, Serialize)]
pub struct CompilePolicyParams {
    pub source: String,
    pub metadata: ConstitutionalMetadata,
}

#[derive(Debug, Serialize)]
pub struct DeployPolicyParams {
    pub policy_id: PolicyId,
}

#[derive(Debug, Serialize)]
pub struct ValidatePolicyParams {
    pub policy_id: PolicyId,
}

#[derive(Debug, Serialize)]
pub struct AuthorizeDecisionParams {
    pub authority_id: AuthorityId,
    pub policy_id: PolicyId,
    pub kernel_authz_id: AuthorizationId,
    pub input_evidence: Vec<EvidenceId>,
    pub context: DecisionContext,
    pub decision_type: String,
}

#[derive(Debug, Serialize)]
pub struct EmitAuditParams {
    pub event_type: AuditEventType,
    pub actor: EvidenceSource,
    pub subject_refs: Vec<EvidenceId>,
    pub findings: Vec<AuditFinding>,
    pub risk_level: RiskLevel,
}