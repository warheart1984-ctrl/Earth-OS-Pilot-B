// Decision Engine Client - Governed decisions client
// Normative: OSA-CGL-v1.0.md

use reqwest::Client;
use serde::{Deserialize, Serialize};
use crate::types::*;

#[derive(Clone)]
pub struct DecisionEngineClient {
    client: Client,
    endpoint: String,
    auth_token: Option<String>,
}

impl DecisionEngineClient {
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

    async fn request<T: for<'de> Deserialize<'de>>(&self, path: &str, body: Option<&impl Serialize>) -> Result<T, reqwest::Error> {
        let url = format!("{}{}", self.endpoint, path);
        let mut req = reqwest::Client::new().post(&url).json(body.unwrap_or(&serde_json::json!({})));
        
        if let Some(token) = &self.auth_token {
            req = req.header("Authorization", format!("Bearer {}", token));
        }
        req = req.header("Content-Type", "application/json");
        req = req.header("X-OSA-Request-ID", Uuid::new_v4().to_string());
        req = req.header("X-OSA-Timestamp", Utc::now().to_rfc3339());

        let response = req.send().await?;
        if !response.status().is_success() {
            return Err(response.error_for_status().unwrap_err());
        }
        response.json().await
    }

    pub async fn decide(&self, params: DecideParams) -> Result<DecisionResult, reqwest::Error> {
        self.request("/api/v1/decision/decide", Some(&params)).await
    }

    pub async fn replay(&self, params: ReplayParams) -> Result<ReplayResult, reqwest::Error> {
        self.request("/api/v1/decision/replay", Some(&params)).await
    }
}

#[derive(Debug, Serialize)]
pub struct DecideParams {
    pub authority_id: AuthorityId,
    pub policy_id: PolicyId,
    pub kernel_authz_id: AuthorizationId,
    pub input_evidence: Vec<EvidenceId>,
    pub context: DecisionContext,
    pub decision_type: String,
}

#[derive(Debug, Deserialize)]
pub struct DecisionResult {
    pub decision_id: DecisionId,
    pub outcome: DecisionOutcome,
    pub evidence_ref: EvidenceId,
    pub evaluation: PolicyEvaluation,
    pub obligations: Vec<Obligation>,
    pub timestamp: Timestamp,
    pub duration_ms: u64,
}

#[derive(Debug, Serialize)]
pub struct ReplayParams {
    pub decision_id: DecisionId,
    pub policy_wasm_hash: Hash,
    pub input_evidence_hashes: Vec<Hash>,
    pub runtime_version: String,
    pub deterministic_seed: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReplayResult {
    pub original_outcome: DecisionOutcome,
    pub replay_outcome: Option<DecisionOutcome>,
    pub match_result: bool,
    pub divergence_details: Option<DivergenceDetails>,
    pub evidence_ref: EvidenceId,
}