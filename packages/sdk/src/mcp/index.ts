export type { GovernanceMCPServerConfig, ToolMapping } from './config.js';

let _GovernanceMCPServer: typeof import('./governance-server.js').GovernanceMCPServer;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('./governance-server.js');
  _GovernanceMCPServer = mod.GovernanceMCPServer;
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('@modelcontextprotocol/sdk')) {
    const helpfulError = new Error(
      '@modelcontextprotocol/sdk is required for MCP governance features.\n' +
      'Install it with: npm install @modelcontextprotocol/sdk'
    );
    // Create a class that throws on construction so the error is deferred but clear
    _GovernanceMCPServer = class {
      constructor() {
        throw helpfulError;
      }
    } as never;
  } else {
    throw err;
  }
}

export const GovernanceMCPServer = _GovernanceMCPServer;
