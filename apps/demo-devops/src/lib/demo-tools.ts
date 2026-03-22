export type ServiceStatus = 'healthy' | 'degraded' | 'down';

export interface Service {
  id: string;
  name: string;
  status: ServiceStatus;
  cpu: number;
  memory: number;
  memoryUsed: string;
  memoryTotal: string;
  requestsPerSecond: number;
  errorRate: number;
  instances: number;
  version: string;
  lastDeploy: string;
  region: string;
  uptime: string;
  alert?: string;
}

export const SERVICES: Record<string, Service> = {
  'api-gateway': {
    id: 'api-gateway',
    name: 'API Gateway',
    status: 'healthy',
    cpu: 34,
    memory: 52,
    memoryUsed: '2.1 GB',
    memoryTotal: '4 GB',
    requestsPerSecond: 1247,
    errorRate: 0.02,
    instances: 4,
    version: 'v2.14.3',
    lastDeploy: '2026-03-21T14:30:00Z',
    region: 'us-east-1',
    uptime: '14d 6h',
  },
  'user-service': {
    id: 'user-service',
    name: 'User Service',
    status: 'degraded',
    cpu: 78,
    memory: 89,
    memoryUsed: '3.6 GB',
    memoryTotal: '4 GB',
    requestsPerSecond: 892,
    errorRate: 1.4,
    instances: 3,
    version: 'v1.8.7',
    lastDeploy: '2026-03-20T09:15:00Z',
    region: 'us-east-1',
    uptime: '2d 23h',
    alert: 'Memory usage critical — approaching OOM threshold',
  },
  'payment-processor': {
    id: 'payment-processor',
    name: 'Payment Processor',
    status: 'healthy',
    cpu: 22,
    memory: 45,
    memoryUsed: '1.8 GB',
    memoryTotal: '4 GB',
    requestsPerSecond: 456,
    errorRate: 0.001,
    instances: 6,
    version: 'v3.2.1',
    lastDeploy: '2026-03-19T16:45:00Z',
    region: 'us-east-1',
    uptime: '3d 15h',
  },
};

export interface LogEntry {
  time: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  msg: string;
}

export const LOGS: Record<string, LogEntry[]> = {
  'user-service': [
    { time: '08:14:23', level: 'WARN', msg: 'Memory usage at 89% — approaching OOM kill threshold' },
    { time: '08:14:22', level: 'ERROR', msg: 'Connection pool exhausted — 3 requests queued (pool size: 20)' },
    { time: '08:14:20', level: 'INFO', msg: 'GET /api/users/profile → 200 (234ms)' },
    { time: '08:14:18', level: 'WARN', msg: 'Slow query: SELECT * FROM users WHERE... (1.2s)' },
    { time: '08:14:15', level: 'INFO', msg: 'Health check: degraded (memory pressure)' },
    { time: '08:14:10', level: 'ERROR', msg: 'Timeout on downstream cache service call (5000ms)' },
    { time: '08:14:05', level: 'INFO', msg: 'POST /api/users/settings → 200 (89ms)' },
    { time: '08:13:58', level: 'WARN', msg: 'GC pause detected: 340ms (heap: 3.4GB)' },
  ],
};

export const PENDING_DEPLOY = {
  service: 'user-service',
  currentVersion: 'v1.8.7',
  newVersion: 'v1.8.8',
  changes: [
    'Fix: connection pool memory leak (closes #847)',
    'Fix: add request timeout to cache calls (30s → 5s)',
    'Chore: update dependencies',
  ],
  author: 'alex@nexuslabs.io',
  ciStatus: 'passed',
  testsRun: 142,
  testsPassed: 142,
  stagingResult: 'Memory usage improved 32%. Error rate dropped to 0.1%.',
  rollbackPlan: 'Automatic rollback if error rate exceeds 1% within 5 minutes',
};

export const NAMESPACES = [
  { name: 'production', services: 12, pods: 48, status: 'active' },
  { name: 'staging', services: 12, pods: 24, status: 'active' },
  { name: 'dev-feature-auth-v2', services: 4, pods: 8, status: 'active' },
  { name: 'load-test-march', services: 6, pods: 30, status: 'idle', note: 'Last used 12 days ago' },
];
