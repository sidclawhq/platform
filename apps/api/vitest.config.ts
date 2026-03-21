import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/services/**', 'src/middleware/**', 'src/routes/**'],
      exclude: ['src/test-utils/**', 'src/**/*.test.ts'],
    },
    // Use a separate test database
    env: {
      DATABASE_URL: 'postgresql://agent_identity:agent_identity@localhost:5433/agent_identity_test',
      NODE_ENV: 'test',
    },
    // Run integration tests sequentially (they share a database)
    pool: 'forks',
    maxWorkers: 1,
  },
  resolve: {
    alias: {
      '@agent-identity/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
