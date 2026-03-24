import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'mcp/index': 'src/mcp/index.ts',
    'middleware/langchain': 'src/middleware/langchain.ts',
    'middleware/openai-agents': 'src/middleware/openai-agents.ts',
    'middleware/crewai': 'src/middleware/crewai.ts',
    'middleware/vercel-ai': 'src/middleware/vercel-ai.ts',
    'webhooks/index': 'src/webhooks/index.ts',
    'integrations/github': 'src/integrations/github-checks.ts',
    'bin/sidclaw-mcp-proxy': 'src/bin/sidclaw-mcp-proxy.ts',
  },
  format: ['cjs', 'esm'],
  tsconfig: 'tsconfig.build.json',
  dts: {
    resolve: ['@sidclaw/shared'],
    compilerOptions: {
      rootDir: '../../',
    },
  },
  splitting: true, // Share code between entry points (ESM only; avoids duplicate classes breaking instanceof)
  clean: true,
  external: [
    '@langchain/core',
    'ai',
    'openai',
    '@modelcontextprotocol/sdk',
  ],
  noExternal: ['@sidclaw/shared'],
});
