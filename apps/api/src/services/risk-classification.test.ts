import { describe, it, expect } from 'vitest';
import { deriveRiskClassification, operationIsDestructive } from './risk-classification.js';

describe('operationIsDestructive', () => {
  it('returns true for operations starting with destructive prefixes', () => {
    expect(operationIsDestructive('delete')).toBe(true);
    expect(operationIsDestructive('remove')).toBe(true);
    expect(operationIsDestructive('send')).toBe(true);
    expect(operationIsDestructive('export')).toBe(true);
    expect(operationIsDestructive('drop')).toBe(true);
    expect(operationIsDestructive('revoke')).toBe(true);
  });

  it('returns true for operations containing destructive prefixes after underscore', () => {
    expect(operationIsDestructive('bulk_delete')).toBe(true);
    expect(operationIsDestructive('send_notification')).toBe(true);
    expect(operationIsDestructive('batch_export')).toBe(true);
    expect(operationIsDestructive('force_remove')).toBe(true);
    expect(operationIsDestructive('mass_revoke')).toBe(true);
  });

  it('returns false for read/list/get/search operations', () => {
    expect(operationIsDestructive('read')).toBe(false);
    expect(operationIsDestructive('list')).toBe(false);
    expect(operationIsDestructive('get')).toBe(false);
    expect(operationIsDestructive('search')).toBe(false);
    expect(operationIsDestructive('summarize')).toBe(false);
    expect(operationIsDestructive('read_only')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(operationIsDestructive('DELETE')).toBe(true);
    expect(operationIsDestructive('Send')).toBe(true);
    expect(operationIsDestructive('EXPORT')).toBe(true);
    expect(operationIsDestructive('Bulk_Delete')).toBe(true);
  });
});

describe('deriveRiskClassification', () => {
  // Destructive operations
  it('restricted + delete → critical', () => {
    expect(deriveRiskClassification('restricted', 'delete')).toBe('critical');
  });

  it('restricted + send → critical', () => {
    expect(deriveRiskClassification('restricted', 'send')).toBe('critical');
  });

  it('restricted + export → critical', () => {
    expect(deriveRiskClassification('restricted', 'export')).toBe('critical');
  });

  it('confidential + send → high', () => {
    expect(deriveRiskClassification('confidential', 'send')).toBe('high');
  });

  it('confidential + delete → high', () => {
    expect(deriveRiskClassification('confidential', 'delete')).toBe('high');
  });

  it('internal + send → medium', () => {
    expect(deriveRiskClassification('internal', 'send')).toBe('medium');
  });

  it('internal + delete → medium', () => {
    expect(deriveRiskClassification('internal', 'delete')).toBe('medium');
  });

  it('public + delete → low', () => {
    expect(deriveRiskClassification('public', 'delete')).toBe('low');
  });

  // Non-destructive operations
  it('restricted + read → medium', () => {
    // restricted (4) * non-destructive (1) = 4 → medium
    expect(deriveRiskClassification('restricted', 'read')).toBe('medium');
  });

  it('confidential + read → medium', () => {
    expect(deriveRiskClassification('confidential', 'read')).toBe('medium');
  });

  it('internal + read → low', () => {
    expect(deriveRiskClassification('internal', 'read')).toBe('low');
  });

  it('public + read → low', () => {
    expect(deriveRiskClassification('public', 'read')).toBe('low');
  });

  it('public + list → low', () => {
    expect(deriveRiskClassification('public', 'list')).toBe('low');
  });

  // Edge cases
  it('operation with destructive substring: "send_notification" → destructive', () => {
    expect(deriveRiskClassification('confidential', 'send_notification')).toBe('high');
  });

  it('operation with destructive substring: "bulk_delete" → destructive', () => {
    expect(deriveRiskClassification('confidential', 'bulk_delete')).toBe('high');
  });

  it('operation "read_only" → non-destructive', () => {
    expect(deriveRiskClassification('confidential', 'read_only')).toBe('medium');
  });

  it('operation "summarize" → non-destructive', () => {
    expect(deriveRiskClassification('confidential', 'summarize')).toBe('medium');
  });
});
