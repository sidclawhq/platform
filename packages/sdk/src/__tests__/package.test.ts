import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('SDK Package', () => {
  const pkgPath = resolve(__dirname, '../../package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

  it('has correct name', () => {
    expect(pkg.name).toBe('@agent-identity/sdk');
  });

  it('has Apache-2.0 license', () => {
    expect(pkg.license).toBe('Apache-2.0');
  });

  it('LICENSE file exists', () => {
    expect(existsSync(resolve(__dirname, '../../LICENSE'))).toBe(true);
  });

  it('README.md exists', () => {
    expect(existsSync(resolve(__dirname, '../../README.md'))).toBe(true);
  });

  it('all subpath exports are defined', () => {
    const exports = Object.keys(pkg.exports);
    expect(exports).toContain('.');
    expect(exports).toContain('./mcp');
    expect(exports).toContain('./langchain');
    expect(exports).toContain('./openai-agents');
    expect(exports).toContain('./vercel-ai');
    expect(exports).toContain('./webhooks');
  });

  it('all peer dependencies are optional', () => {
    for (const dep of Object.keys(pkg.peerDependencies ?? {})) {
      expect(pkg.peerDependenciesMeta?.[dep]?.optional).toBe(true);
    }
  });

  it('files field includes only dist, README, LICENSE, CHANGELOG', () => {
    expect(pkg.files).toEqual(['dist', 'README.md', 'LICENSE', 'CHANGELOG.md']);
  });
});
