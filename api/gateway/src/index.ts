// OSA API Gateway - Layer 4 Intelligence Services
// Normative: OSA-API-Specifications-v1.0.md
// REST + GraphQL + WebSocket endpoints for all Layer 2 subsystems

import Fastify from 'fastify';
import { WebSocketServer } from '@fastify/websocket';
import { createYoga } from 'graphql-yoga';
import { createSchema } from './graphql/schema.js';
import { createRestRoutes } from './rest/routes.js';
import { createWebSocketHandlers } from './websocket/handlers.js';
import { KernelClient } from '@osa/governance-kernel';
import { LedgerClient } from '@osa/evidence-ledger';
import { DecisionClient } from '@osa/decision-engine';
import { AgentClient } from '@osa/agent-runtime';
import { MissionClient } from '@osa/mission-orchestrator';
import { SimulationClient } from '@osa/simulation-runtime';
import { createEvidenceSource, now, randomUUID } from '@osa/constitutional-types';

export interface ApiGatewayConfig {
  port: number;
  host: string;
  kernelEndpoint: string;
  ledgerEndpoint: string;
  decisionEndpoint: string;
  agentEndpoint?: string;
  missionEndpoint?: string;
  simulationEndpoint?: string;
  jwtSecret: string;
  corsOrigins: string[];
}

export class ApiGateway {
  private config: ApiGatewayConfig;
  private app: ReturnType<typeof Fastify>;
  private kernel: KernelClient;
  private ledger: LedgerClient;
  private decision: DecisionClient;
  private agent?: AgentClient;
  private mission?: MissionClient;
  private simulation?: SimulationClient;

  constructor(config: ApiGatewayConfig) {
    this.config = config;
    this.app = Fastify({ logger: true });
    this.kernel = new KernelClient({ endpoint: config.kernelEndpoint });
    this.ledger = new LedgerClient({ endpoint: config.ledgerEndpoint });
    this.decision = new DecisionClient({ endpoint: config.decisionEndpoint });
    
    if (config.agentEndpoint) this.agent = new AgentClient({ endpoint: config.agentEndpoint });
    if (config.missionEndpoint) this.mission = new MissionClient({ endpoint: config.missionEndpoint });
    if (config.simulationEndpoint) this.simulation = new SimulationClient({ endpoint: config.simulationEndpoint });
  }

  async start(): Promise<void> {
    // Register WebSocket support
    await this.app.register(WebSocketServer);

    // CORS
    this.app.addHook('onRequest', async (request, reply) => {
      reply.header('Access-Control-Allow-Origin', this.config.corsOrigins.join(', '));
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-OSA-CAL-Token, X-OSA-Request-ID');
    });

    // Request ID & timestamp middleware
    this.app.addHook('onRequest', async (request, reply) => {
      request.headers['x-osa-request-id'] = request.headers['x-osa-request-id'] || randomUUID();
      request.headers['x-osa-timestamp'] = now();
    });

    // CAL Token authentication for mutations
    this.app.addHook('preHandler', async (request, reply) => {
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
        const calToken = request.headers['x-osa-cal-token'];
        if (!calToken) {
          return reply.code(401).send({
            error: { code: 'AUTHENTICATION_REQUIRED', message: 'CAL token required', evidenceRef: '' }
          });
        }
        // Validate via kernel (simplified)
        const valid = await this.kernel.validateCalToken(calToken as string);
        if (!valid) {
          return reply.code(403).send({
            error: { code: 'AUTHORIZATION_DENIED', message: 'Invalid or revoked CAL token', evidenceRef: '' }
          });
        }
      }
    });

    // Register REST routes
    createRestRoutes(this.app, {
      kernel: this.kernel,
      ledger: this.ledger,
      decision: this.decision,
      agent: this.agent,
      mission: this.mission,
      simulation: this.simulation
    });

    // Register GraphQL
    const yoga = createYoga({
      schema: createSchema({
        kernel: this.kernel,
        ledger: this.ledger,
        decision: this.decision,
        agent: this.agent,
        mission: this.mission,
        simulation: this.simulation
      }),
      graphqlEndpoint: '/graphql',
      cors: { origin: this.config.corsOrigins }
    });
    this.app.route({ method: ['GET', 'POST', 'OPTIONS'], url: '/graphql', handler: yoga });

    // Register WebSocket handlers
    createWebSocketHandlers(this.app, {
      ledger: this.ledger,
      decision: this.decision,
      agent: this.agent,
      mission: this.mission,
      simulation: this.simulation
    });

    // Health check
    this.app.get('/health', async () => ({ status: 'OK', timestamp: now() }));

    // Start server
    await this.app.listen({ port: this.config.port, host: this.config.host });
    console.log(`OSA API Gateway running on http://${this.config.host}:${this.config.port}`);
    console.log(`  REST: http://${this.config.host}:${this.config.port}/api/v1/...`);
    console.log(`  GraphQL: http://${this.config.host}:${this.config.port}/graphql`);
    console.log(`  WebSocket: ws://${this.config.host}:${this.config.port}/ws`);
  }

  async stop(): Promise<void> {
    await this.app.close();
  }
}

// Client stubs for kernel, ledger, etc.
class KernelClient {
  constructor(private config: { endpoint: string }) {}
  async validateCalToken(token: string): Promise<boolean> { return true; }
  async getAuthority(authorityId: string): Promise<any> { return null; }
}

class LedgerClient {
  constructor(private config: { endpoint: string }) {}
  async append(entry: any): Promise<any> { return { sequence: 1, chainHash: '' }; }
  async get(evidenceId: string): Promise<any> { return null; }
  async query(params: any): Promise<any[]> { return []; }
}

class DecisionClient {
  constructor(private config: { endpoint: string }) {}
  async decide(params: any): Promise<any> { return { decisionId: '', outcome: { result: 'ALLOW' }, evidenceRef: '' }; }
  async replay(params: any): Promise<any> { return { match: true, evidenceRef: '' }; }
}

class AgentClient {
  constructor(private config: { endpoint: string }) {}
  async spawn(params: any): Promise<any> { return { agentId: '', evidenceRef: '' }; }
  async action(params: any): Promise<any> { return { actionId: '', outcome: { result: 'ALLOW' }, evidenceRef: '' }; }
}

class MissionClient {
  constructor(private config: { endpoint: string }) {}
  async create(params: any): Promise<any> { return { mission: {}, evidenceRef: '' }; }
  async execute(params: any): Promise<any> { return { mission: {} }; }
}

class SimulationClient {
  constructor(private config: { endpoint: string }) {}
  async create(params: any): Promise<any> { return { simulationId: '', evidenceRef: '' }; }
  async run(simulationId: string): Promise<any> { return { success: true }; }
}

// Run if main
if (import.meta.url === `file://${process.argv[1]}`) {
  const config: ApiGatewayConfig = {
    port: parseInt(process.env.PORT || '8080'),
    host: process.env.HOST || '0.0.0.0',
    kernelEndpoint: process.env.KERNEL_ENDPOINT || 'http://localhost:8081',
    ledgerEndpoint: process.env.LEDGER_ENDPOINT || 'http://localhost:8082',
    decisionEndpoint: process.env.DECISION_ENDPOINT || 'http://localhost:8083',
    agentEndpoint: process.env.AGENT_ENDPOINT,
    missionEndpoint: process.env.MISSION_ENDPOINT,
    simulationEndpoint: process.env.SIMULATION_ENDPOINT,
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*']
  };

  const gateway = new ApiGateway(config);
  await gateway.start();

  process.on('SIGTERM', async () => {
    await gateway.stop();
    process.exit(0);
  });
}