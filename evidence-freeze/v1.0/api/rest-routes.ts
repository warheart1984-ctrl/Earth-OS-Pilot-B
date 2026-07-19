// REST Routes - OSA Layer 4 Intelligence Services
// Normative: OSA-API-Specifications-v1.0.md

import { FastifyInstance } from 'fastify';

export interface ServiceClients {
  kernel: any;
  ledger: any;
  decision: any;
  agent?: any;
  mission?: any;
  simulation?: any;
}

export function createRestRoutes(app: FastifyInstance, clients: ServiceClients): void {
  const prefix = '/api/v1';

  // ========================================================================
  // Observation API
  // ========================================================================
  app.post(`${prefix}/observation/tasks/imaging`, async (request, reply) => {
    const { target, parameters, authority_ref, evidence_requirement } = request.body as any;
    const taskId = `task:osa:imaging:${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}`;
    const evidenceRef = `E1-OSA-OBS-${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}`;
    
    reply.header('X-OSA-Evidence-Ref', evidenceRef);
    reply.header('X-OSA-Authority-Ref', authority_ref);
    
    return { task_id: taskId, status: 'QUEUED', estimated_completion: new Date(Date.now() + 1800000).toISOString(), evidence_ref: evidenceRef };
  });

  app.get(`${prefix}/observation/catalog/imagery`, async (request, reply) => {
    const { region, start, end, bands, resolution_max } = request.query as any;
    return { results: [], evidence_refs: [] };
  });

  app.get(`${prefix}/observation/data/remote-sensing/:product_id`, async (request, reply) => {
    return { product_id: request.params.product_id, data: null, evidence_ref: '' };
  });

  app.get(`${prefix}/observation/data/environmental`, async (request, reply) => {
    const { parameters, region, start, end } = request.query as any;
    return { results: [], evidence_refs: [] };
  });

  // ========================================================================
  // Navigation API
  // ========================================================================
  app.post(`${prefix}/navigation/routes/compute`, async (request, reply) => {
    const { mission_profile, authority_ref, evidence_requirement } = request.body as any;
    const routeId = `route:osa:${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}`;
    const evidenceRef = `E2-OSA-NAV-${now().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 4)}`;
    
    reply.header('X-OSA-Evidence-Ref', evidenceRef);
    reply.header('X-OSA-Authority-Ref', authority_ref);
    
    return { route_id: routeId, maneuvers: [], total_delta_v: 0, evidence_ref: evidenceRef };
  });

  app.post(`${prefix}/navigation/routes/optimize`, async (request, reply) => {
    return { route_id: '', maneuvers: [], total_delta_v: 0, evidence_ref: '' };
  });

  app.post(`${prefix}/navigation/missions/plan`, async (request, reply) => {
    return { plan_id: '', evidence_ref: '' };
  });

  app.post(`${prefix}/navigation/missions/validate`, async (request, reply) => {
    return { valid: true, evidence_ref: '' };
  });

  // ========================================================================
  // Mission API
  // ========================================================================
  if (clients.mission) {
    app.post(`${prefix}/missions`, async (request, reply) => {
      const result = await clients.mission.create(request.body);
      reply.header('X-OSA-Evidence-Ref', result.evidenceRef);
      return result.mission;
    });

    app.get(`${prefix}/missions/:mission_id`, async (request, reply) => {
      return { mission_id: request.params.mission_id, status: 'RUNNING', evidence_refs: [] };
    });

    app.post(`${prefix}/missions/:mission_id/actions`, async (request, reply) => {
      const result = await clients.mission.execute({ missionId: request.params.mission_id, ...request.body });
      return result;
    });

    app.post(`${prefix}/missions/:mission_id/abort`, async (request, reply) => {
      const { reason } = request.body as any;
      await clients.mission.abort?.({ missionId: request.params.mission_id, reason });
      return { aborted: true };
    });
  }

  // ========================================================================
  // Knowledge API
  // ========================================================================
  app.post(`${prefix}/knowledge/entities`, async (request, reply) => {
    return { entity_ref: '', evidence_ref: '' };
  });

  app.get(`${prefix}/knowledge/entities/:entity_ref`, async (request, reply) => {
    return { entity_ref: request.params.entity_ref, properties: {}, evidence_refs: [] };
  });

  app.post(`${prefix}/knowledge/entities/query`, async (request, reply) => {
    return { results: [], evidence_refs: [] };
  });

  app.post(`${prefix}/knowledge/relationships`, async (request, reply) => {
    return { relationship_ref: '', evidence_ref: '' };
  });

  app.post(`${prefix}/knowledge/graph/traverse`, async (request, reply) => {
    return { nodes: [], edges: [], evidence_refs: [] };
  });

  // ========================================================================
  // Simulation API
  // ========================================================================
  if (clients.simulation) {
    app.post(`${prefix}/simulations`, async (request, reply) => {
      const result = await clients.simulation.create(request.body);
      reply.header('X-OSA-Evidence-Ref', result.evidenceRef);
      return { simulation_id: result.simulationId };
    });

    app.get(`${prefix}/simulations/:simulation_id`, async (request, reply) => {
      return { simulation_id: request.params.simulation_id, status: 'COMPLETED', evidence_ref: '' };
    });

    app.post(`${prefix}/simulations/:simulation_id/run`, async (request, reply) => {
      const result = await clients.simulation.run(request.params.simulation_id);
      return result;
    });
  }

  // ========================================================================
  // Evidence API
  // ========================================================================
  app.post(`${prefix}/evidence`, async (request, reply) => {
    const entry = request.body;
    const result = await clients.ledger.append(entry);
    reply.header('X-OSA-Evidence-Ref', entry.evidenceId);
    return { sequence: result.sequence, chain_hash: result.chainHash };
  });

  app.get(`${prefix}/evidence/:evidence_id`, async (request, reply) => {
    return await clients.ledger.get(request.params.evidence_id);
  });

  app.get(`${prefix}/evidence`, async (request, reply) => {
    return await clients.ledger.query(request.query);
  });

  app.get(`${prefix}/evidence/:evidence_id/lineage`, async (request, reply) => {
    return { nodes: [], edges: [], roots: [], leaves: [] };
  });

  app.get(`${prefix}/evidence/:evidence_id/verify`, async (request, reply) => {
    return { verified: true, evidence_ref: '' };
  });

  // ========================================================================
  // Verification API
  // ========================================================================
  app.post(`${prefix}/verification/decision`, async (request, reply) => {
    return { verification_id: '', passed: true, evidence_ref: '' };
  });

  app.post(`${prefix}/verification/evidence`, async (request, reply) => {
    return { verification_id: '', passed: true, evidence_ref: '' };
  });

  // ========================================================================
  // Governance API
  // ========================================================================
  app.post(`${prefix}/governance/authority/grant`, async (request, reply) => {
    const grant = await clients.kernel.grantAuthority(request.body);
    reply.header('X-OSA-Evidence-Ref', grant.evidenceRef);
    return { authority_id: grant.authorityId.value, evidence_ref: grant.evidenceRef.value };
  });

  app.post(`${prefix}/governance/authority/revoke`, async (request, reply) => {
    const { authority_id, trigger, evidence } = request.body as any;
    const result = await clients.kernel.revokeAuthority({ authorityId: { value: authority_id }, trigger, evidence: { value: evidence } });
    return { revoked: result.revoked, evidence_ref: result.evidenceRef.value };
  });

  app.post(`${prefix}/governance/policy/compile`, async (request, reply) => {
    const { source, metadata } = request.body as any;
    // Would call policy engine
    return { policy_id: '', wasm_hash: '', evidence_ref: '' };
  });

  app.post(`${prefix}/governance/policy/deploy`, async (request, reply) => {
    const { policy_id } = request.body as any;
    // Would call kernel
    return { deployed: true, deployment_id: '', evidence_ref: '' };
  });

  // ========================================================================
  // Agent API
  // ========================================================================
  if (clients.agent) {
    app.post(`${prefix}/agents`, async (request, reply) => {
      const result = await clients.agent.spawn(request.body);
      reply.header('X-OSA-Evidence-Ref', result.evidenceRef);
      return { agent_id: result.agentId, evidence_ref: result.evidenceRef };
    });

    app.post(`${prefix}/agents/:agent_id/action`, async (request, reply) => {
      const result = await clients.agent.action({ agentId: request.params.agent_id, ...request.body });
      return result;
    });

    app.post(`${prefix}/agents/:agent_id/terminate`, async (request, reply) => {
      const { reason } = request.body as any;
      await clients.agent.terminate({ agentId: request.params.agent_id, reason });
      return { terminated: true };
    });
  }

  // ========================================================================
  // Decision API (Direct)
  // ========================================================================
  app.post(`${prefix}/decision/decide`, async (request, reply) => {
    const result = await clients.decision.decide(request.body);
    reply.header('X-OSA-Evidence-Ref', result.evidenceRef);
    return { decision_id: result.decisionId, outcome: result.outcome, evidence_ref: result.evidenceRef };
  });

  app.post(`${prefix}/decision/replay`, async (request, reply) => {
    const result = await clients.decision.replay(request.body);
    return { match: result.match, evidence_ref: result.evidenceRef };
  });
}

// Utility functions
function now(): string { return new Date().toISOString(); }
function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}