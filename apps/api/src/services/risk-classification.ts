import type { DataClassification, RiskClassification } from '@agent-identity/shared';

const DESTRUCTIVE_PREFIXES = ['delete', 'remove', 'send', 'export', 'drop', 'revoke'];

export function operationIsDestructive(operation: string): boolean {
  const normalized = operation.toLowerCase();
  return DESTRUCTIVE_PREFIXES.some(p => normalized.startsWith(p) || normalized.includes(`_${p}`));
}

export function deriveRiskClassification(
  dataClassification: DataClassification,
  operation: string,
): RiskClassification {
  const classLevel: Record<DataClassification, number> = {
    public: 1,
    internal: 2,
    confidential: 3,
    restricted: 4,
  };

  const opRisk = operationIsDestructive(operation) ? 2 : 1;
  const score = classLevel[dataClassification] * opRisk;

  if (score >= 7) return 'critical';
  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}
