export type { GovernanceMCPServerConfig, ToolMapping } from './config.js';
export type { HttpServerOptions } from './http-server.js';

const PEER_DEP_ERROR =
  'The MCP governance proxy requires @modelcontextprotocol/sdk. ' +
  'Install it with: npm install @modelcontextprotocol/sdk';

function isMissingModuleError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes('@modelcontextprotocol/sdk') ||
    message.includes('Cannot find module') ||
    message.includes('MODULE_NOT_FOUND') ||
    message.includes('ERR_MODULE_NOT_FOUND') ||
    message.includes('require is not defined') ||
    message.includes('require is not a function')
  );
}

let _GovernanceMCPServer: typeof import('./governance-server.js').GovernanceMCPServer;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('./governance-server.js');
  _GovernanceMCPServer = mod.GovernanceMCPServer;
} catch (err: unknown) {
  if (isMissingModuleError(err)) {
    // Create a class that throws a helpful error on construction,
    // so the error is deferred until the user actually tries to use it.
    const helpfulError = new Error(PEER_DEP_ERROR);
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
