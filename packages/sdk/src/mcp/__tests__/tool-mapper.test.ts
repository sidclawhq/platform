import { describe, it, expect } from 'vitest';
import { findMapping, deriveResourceScope } from '../tool-mapper.js';
import type { ToolMapping } from '../config.js';

describe('findMapping', () => {
  const mappings: ToolMapping[] = [
    { toolName: 'query', operation: 'database_query', data_classification: 'confidential' },
    { toolName: 'db_*', data_classification: 'internal' },
    { toolName: '*_query', resource_scope: 'queries' },
    { toolName: 'list_tables', skip_governance: true },
  ];

  it('exact match on tool name', () => {
    const result = findMapping('query', mappings);
    expect(result).toBeDefined();
    expect(result!.operation).toBe('database_query');
  });

  it('glob match with trailing wildcard (db_*)', () => {
    const result = findMapping('db_insert', mappings);
    expect(result).toBeDefined();
    expect(result!.data_classification).toBe('internal');
  });

  it('glob match with leading wildcard (*_query)', () => {
    const result = findMapping('slow_query', mappings);
    expect(result).toBeDefined();
    expect(result!.resource_scope).toBe('queries');
  });

  it('returns undefined when no mapping matches', () => {
    const result = findMapping('unknown_tool', mappings);
    expect(result).toBeUndefined();
  });

  it('exact match takes precedence over glob', () => {
    const result = findMapping('list_tables', mappings);
    expect(result).toBeDefined();
    expect(result!.skip_governance).toBe(true);
  });
});

describe('deriveResourceScope', () => {
  it('returns path arg if present', () => {
    expect(deriveResourceScope('tool', { path: '/etc/config' })).toBe('/etc/config');
  });

  it('returns table arg if present', () => {
    expect(deriveResourceScope('tool', { table: 'users' })).toBe('users');
  });

  it('returns database arg if present', () => {
    expect(deriveResourceScope('tool', { database: 'mydb' })).toBe('mydb');
  });

  it('prefers earlier scopeKeys (path over table)', () => {
    expect(deriveResourceScope('tool', { table: 'users', path: '/data' })).toBe('/data');
  });

  it('returns tool name as fallback', () => {
    expect(deriveResourceScope('my_tool', { count: 5 })).toBe('my_tool');
  });

  it('ignores non-string args', () => {
    expect(deriveResourceScope('tool', { path: 123, file: null })).toBe('tool');
  });
});
