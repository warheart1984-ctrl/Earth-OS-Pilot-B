// Mission Orchestrator Client
// Normative: OSA-CGL-v1.0.md

use reqwest::Client;
use serde::{Deserialize, Serialize};
use crate::types::*;

#[derive(Clone)]
pub struct MissionOrchestratorClient {
    client: Client,
    endpoint: String,
    auth_token: Option<String>,
}

impl MissionOrchestratorClient {
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

    pub async fn create_mission(&self, params: CreateMissionParams) -> Result<MissionResult, reqwest::Error> {
        self.request("/api/v1/mission", Some(&params)).await
    }

    pub async fn execute_mission(&self, params: ExecuteMissionParams) -> Result<Mission, reqwest::Error> {
        self.request(&format!("/api/v1/mission/{}/execute", params.mission_id.0), Some(&params)).await
    }

    pub async fn execute_step(&self, params: ExecuteStepParams) -> Result<StepResult, reqwest::Error> {
        self.request(&format!("/api/v1/mission/{}/step/{}", params.mission_id.0, params.step_id), Some(&params)).await
    }

    pub async fn abort_mission(&self, params: AbortMissionParams) -> Result<Mission, reqwest::Error> {
        self.request(&format!("/api/v1/mission/{}/abort", params.mission_id.0), Some(&params)).await
    }

    pub async fn get_mission(&self, mission_id: MissionId) -> Result<Option<Mission>, reqwest::Error> {
        self.request(&format!("/api/v1/mission/{}", mission_id.0), None).await
    }

    pub async fn list_missions(&self) -> Result<Vec<Mission>, reqwest::Error> {
        self.request("/api/v1/mission", None).await
    }

    pub async fn get_missions_by_status(&self, status: MissionStatus) -> Result<Vec<Mission>, reqwest::Error> {
        self.request(&format!("/api/v1/mission?status={}", status), None).await
    }
}

#[derive(Debug, Serialize)]
pub struct CreateMissionParams {
    pub plan: MissionPlan,
    pub holder: EvidenceSource,
    pub expires_at: Option<Timestamp>,
}

#[derive(Debug, Serialize)]
pub struct ExecuteMissionParams {
    pub mission_id: MissionId,
    pub input_evidence: Vec<EvidenceId>,
}

#[derive(Debug, Serialize)]
pub struct ExecuteStepParams {
    pub mission_id: MissionId,
    pub step_id: String,
    pub input_evidence: Vec<EvidenceId>,
}

#[derive(Debug, Serialize)]
pub struct AbortMissionParams {
    pub mission_id: MissionId,
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct MissionResult {
    pub mission: Mission,
    pub evidence_ref: EvidenceId,
}

#[derive(Debug, Deserialize)]
pub struct Mission {
    pub mission_id: MissionId,
    pub plan: MissionPlan,
    pub authority_grant: AuthorityGrant,
    pub status: MissionStatus,
    pub current_step: u32,
    pub step_results: Vec<StepResult>,
    pub evidence_refs: Vec<EvidenceId>,
    pub created_at: Timestamp,
    pub started_at: Option<Timestamp>,
    pub completed_at: Option<Timestamp>,
    pub aborted_at: Option<Timestamp>,
    pub abort_reason: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum MissionStatus {
    Created,
    Running,
    Paused,
    Completed,
    Failed,
    Aborted,
}

#[derive(Debug, Deserialize)]
pub struct StepResult {
    pub step_id: String,
    pub status: StepStatus,
    pub decision_id: Option<DecisionId>,
    pub evidence_ref: Option<EvidenceId>,
    pub outcome: Option<DecisionOutcome>,
    pub started_at: Option<Timestamp>,
    pub completed_at: Option<Timestamp>,
    pub error: Option<String>,
    pub retry_count: u32,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum StepStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Skipped,
}

#[derive(Debug, Deserialize)]
pub struct MissionPlan {
    pub mission_id: MissionId,
    pub name: String,
    pub description: String,
    pub steps: Vec<MissionStep>,
    pub authority_ref: AuthorityId,
    pub policy_ref: PolicyId,
    pub constraints: Constraints,
    pub created_at: Timestamp,
    pub created_by: EvidenceSource,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct MissionStep {
    pub step_id: String,
    pub name: String,
    pub description: String,
    pub action: MissionAction,
    pub preconditions: Vec<Precondition>,
    pub postconditions: Vec<Postcondition>,
    pub timeout_ms: u64,
    pub retry_policy: RetryPolicy,
    pub authority_scope: Vec<Capability>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct MissionAction {
    #[serde(rename = "type")]
    pub action_type: MissionActionType,
    pub resource: String,
    pub action: String,
    pub parameters: serde_json::Value,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum MissionActionType {
    OrbitalManeuver,
    ObservationTask,
    DataCollection,
    Communication,
    Computation,
    Custom,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Precondition {
    #[serde(rename = "type")]
    pub precondition_type: PreconditionType,
    pub parameters: serde_json::Value,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PreconditionType {
    EvidenceExists,
    StateMatches,
    AuthorityValid,
    Custom,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Postcondition {
    #[serde(rename = "type")]
    pub postcondition_type: PostconditionType,
    pub parameters: serde_json::Value,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PostconditionType {
    EvidenceProduced,
    StateUpdated,
    NotificationSent,
    Custom,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct RetryPolicy {
    pub max_retries: u32,
    pub backoff_ms: u64,
    pub retry_on: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct CreateMissionParams {
    pub plan: MissionPlan,
    pub holder: EvidenceSource,
    pub expires_at: Option<Timestamp>,
}

#[derive(Debug, Serialize)]
pub struct ExecuteMissionParams {
    pub mission_id: MissionId,
    pub input_evidence: Vec<EvidenceId>,
}

#[derive(Debug, Serialize)]
pub struct ExecuteStepParams {
    pub mission_id: MissionId,
    pub step_id: String,
    pub input_evidence: Vec<EvidenceId>,
}

#[derive(Debug, Serialize)]
pub struct AbortMissionParams {
    pub mission_id: MissionId,
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct MissionResult {
    pub mission: Mission,
    pub evidence_ref: EvidenceId,
}