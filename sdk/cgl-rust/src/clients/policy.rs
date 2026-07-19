// Policy Engine Client - Rego→WASM compilation client
// Normative: OSA-CGL-v1.0.md

use reqwest::Client;
use serde::{Deserialize, Serialize};
use crate::types::*;

#[derive(Clone)]
pub struct PolicyEngineClient {
    client: Client,
    endpoint: String,
    auth_token: Option<String>,
}

impl PolicyEngineClient {
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

    pub async fn compile_policy(&self, params: CompilePolicyParams) -> Result<CompiledPolicy, reqwest::Error> {
        self.request("/api/v1/policy/compile", Some(&params)).await
    }

    pub async fn evaluate_policy(&self, params: EvaluatePolicyParams) -> Result<PolicyEvaluation, reqwest::Error> {
        self.request(&format!("/api/v1/policy/{}/evaluate", params.policy_id.0), Some(&params.input)).await
    }

    pub async fn get_policy(&self, policy_id: PolicyId) -> Result<CompiledPolicy, reqwest::Error> {
        self.request(&format!("/api/v1/policy/{}", policy_id.0), None).await
    }

    pub async fn list_policies(&self) -> Result<Vec<CompiledPolicy>, reqwest::Error> {
        self.request("/api/v1/policy", None).await
    }

    pub async fn remove_policy(&self, policy_id: PolicyId) -> Result<bool, reqwest::Error> {
        let _: serde_json::Value = self.client.delete(&format!("{}/api/v1/policy/{}", self.endpoint, policy_id.0)).send().await?.json().await?;
        Ok(true)
    }

    pub async fn validate_policy(&self, params: ValidatePolicyParams) -> Result<ValidationResult, reqwest::Error> {
        self.request("/api/v1/policy/validate", Some(&params)).await
    }
}

#[derive(Debug, Serialize)]
pub struct CompilePolicyParams {
    pub source: String,
    pub metadata: ConstitutionalMetadata,
    pub dependencies: Option<Vec<PolicyId>>,
}

#[derive(Debug, Serialize)]
pub struct EvaluatePolicyParams {
    pub policy_id: PolicyId,
    pub input: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct ValidatePolicyParams {
    pub source: String,
}