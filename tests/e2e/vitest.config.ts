import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    root: path.resolve(__dirname),
    globals: true,
    environment: 'node',
    include: ['*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      DATABASE_URL: 'postgresql://agent_identity:agent_identity@localhost:5433/agent_identity_test',
      TEST_API_URL: 'http://localhost:4000',
      NODE_ENV: 'test',
    },
    sequence: { concurrent: false },
  },
  resolve: {
    alias: {
      '@sidclaw/sdk': path.resolve(__dirname, '../../packages/sdk/src'),
      '@sidclaw/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
