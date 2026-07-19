// Mission Orchestrator Client - Multi-step mission governance client
// Normative: OSA-CGL-v1.0.md

import { AuthorityId, PolicyId, AuthorizationId, EvidenceId, DecisionId, EvidenceSource, DecisionContext, DecisionOutcome, Obligation, MissionId, MissionPlan, MissionStatus, MissionAction, createMissionId, now, randomUUID } from '@osa/constitutional-types';

export interface MissionOrchestratorClientConfig {
  endpoint: string;
  authToken?: string;
  timeoutMs?: number;
}

export interface MissionPlan {
  missionId: MissionId;
  name: string;
  description: string;
  steps: MissionStep[];
  authorityRef: AuthorityId;
  policyRef: PolicyId;
  constraints: any;
  createdAt: string;
  createdBy: EvidenceSource;
}

export interface MissionStep {
  stepId: string;
  name: string;
  description: string;
  action: MissionAction;
  preconditions: any[];
  postconditions: any[];
  timeoutMs: number;
  retryPolicy: { maxRetries: number; backoffMs: number; retryOn: string[] };
  authorityScope: { resource: string; action: string }[];
}

export interface Mission {
  missionId: MissionId;
  plan: MissionPlan;
  authorityGrant: any;
  status: MissionStatus;
  currentStep: number;
  stepResults: StepResult[];
  evidenceRefs: EvidenceId[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  abortedAt?: string;
  abortReason?: string;
}

export interface StepResult {
  stepId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  decisionId?: DecisionId;
  evidenceRef?: EvidenceId;
  outcome?: any;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  retryCount: number;
}

export interface CreateMissionParams {
  plan: MissionPlan;
  holder: any;
  expiresAt?: string;
}

export interface ExecuteMissionParams {
  missionId: MissionId;
  inputEvidence: EvidenceId[];
}

export interface ExecuteStepParams {
  missionId: MissionId;
  stepId: string;
  inputEvidence: EvidenceId[];
}

export interface AbortMissionParams {
  missionId: MissionId;
  reason: string;
}

export class MissionOrchestratorClient {
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-OSA-Request-ID': randomUUID(),
      'X-OSA-Timestamp': now()
    };
    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs || 30000);

    try {
      const response = await fetch(`${this.config.endpoint}${path}`, {
        ...options,
        headers: { ...headers, ...options.headers },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  async createMission(params: CreateMissionParams): Promise<{ mission: Mission; evidenceRef: EvidenceId }> {
    return this.request('/api/v1/mission', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  async executeMission(params: ExecuteMissionParams): Promise<Mission> {
    return this.request<Mission>(`/api/v1/mission/${params.missionId}/execute`, {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  async executeStep(params: ExecuteStepParams): Promise<StepResult> {
    return this.request<StepResult>(`/api/v1/mission/${params.missionId}/step/${params.stepId}`, {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  async abortMission(params: AbortMissionParams): Promise<Mission> {
    return this.request<Mission>(`/api/v1/mission/${params.missionId}/abort`, {
      method: 'POST',
      body: JSON.stringify({ reason: params.reason })
    });
  }

  async getMission(missionId: MissionId): Promise<Mission | null> {
    return this.request<Mission | null>(`/api/v1/mission/${missionId}`);
  }

  async listMissions(): Promise<Mission[]> {
    return this.request<Mission[]>('/api/v1/mission');
  }

  async getMissionsByStatus(status: MissionStatus): Promise<Mission[]> {
    return this.request<Mission[]>(`/api/v1/mission?status=${status}`);
  }
}