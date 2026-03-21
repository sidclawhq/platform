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
  },
  format: ['cjs', 'esm'],
  tsconfig: 'tsconfig.build.json',
  dts: true,
  splitting: false,
  clean: true,
  external: [
    '@sidclaw/shared',
    '@langchain/core',
    'ai',
    'openai',
    '@modelcontextprotocol/sdk',
  ],
});
