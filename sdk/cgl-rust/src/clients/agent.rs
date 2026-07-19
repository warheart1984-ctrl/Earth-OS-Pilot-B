// Agent Runtime Client - Autonomous agents client
// Normative: OSA-CGL-v1.0.md

use reqwest::Client;
use serde::{Deserialize, Serialize};
use crate::types::*;

#[derive(Clone)]
pub struct AgentRuntimeClient {
    client: Client,
    endpoint: String,
    auth_token: Option<String>,
}

impl AgentRuntimeClient {
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

    pub async fn spawn_agent(&self, params: SpawnAgentParams) -> Result<Agent, reqwest::Error> {
        self.request("/api/v1/agent/spawn", Some(&params)).await
    }

    pub async fn execute_action(&self, params: AgentActionParams) -> Result<AgentActionResult, reqwest::Error> {
        self.request("/api/v1/agent/action", Some(&params)).await
    }

    pub async fn get_agent(&self, agent_id: &AgentId) -> Result<Option<Agent>, reqwest::Error> {
        self.request(&format!("/api/v1/agent/{}", agent_id.0), None).await
    }

    pub async fn terminate_agent(&self, params: TerminateAgentParams) -> Result<TerminationResult, reqwest::Error> {
        self.request(&format!("/api/v1/agent/{}/terminate", params.agent_id.0), Some(&params)).await
    }

    pub async fn list_agents(&self) -> Result<Vec<Agent>, reqwest::Error> {
        self.request("/api/v1/agent", None).await
    }

    pub async fn get_agents_by_policy(&self, policy_id: &str) -> Result<Vec<Agent>, reqwest::Error> {
        self.request(&format!("/api/v1/agent?policy_id={}", policy_id), None).await
    }
}

#[derive(Debug, Serialize)]
pub struct SpawnAgentParams {
    pub policy_id: PolicyId,
    pub initial_state: Option<serde_json::Value>,
    pub capabilities: Vec<Capability>,
    pub constraints: Constraints,
    pub authority_basis: String,
    pub expires_at: Option<Timestamp>,
}

#[derive(Debug, Deserialize)]
pub struct Agent {
    pub agent_id: AgentId,
    pub authority_id: AuthorityId,
    pub policy_id: PolicyId,
    pub state: serde_json::Value,
    pub capabilities: Vec<Capability>,
    pub constraints: Constraints,
    pub spawned_at: Timestamp,
    pub last_action_at: Option<Timestamp>,
    pub evidence_refs: Vec<EvidenceId>,
    pub status: AgentStatus,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AgentStatus {
    Spawning,
    Running,
    Paused,
    Terminating,
    Terminated,
}

#[derive(Debug, Serialize)]
pub struct AgentActionParams {
    pub agent_id: AgentId,
    pub action: AgentAction,
    pub input_evidence: Vec<EvidenceId>,
}

#[derive(Debug, Serialize)]
pub struct AgentAction {
    pub resource: String,
    pub action: String,
    pub parameters: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct AgentActionResult {
    pub action_id: String,
    pub outcome: DecisionOutcome,
    pub evidence_ref: EvidenceId,
    pub new_state: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct TerminateAgentParams {
    pub agent_id: AgentId,
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct TerminationResult {
    pub terminated: bool,
    pub agent_id: AgentId,
    pub evidence_ref: EvidenceId,
}