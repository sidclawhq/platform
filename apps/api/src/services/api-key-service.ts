import { PrismaClient } from '../generated/prisma/index.js';
import { createHash, randomBytes } from 'node:crypto';
import { NotFoundError } from '../errors.js';

export type ApiKeyScope =
  | 'evaluate'
  | 'traces:read'
  | 'traces:write'
  | 'agents:read'
  | 'approvals:read'
  | 'admin';

export const VALID_SCOPES: ApiKeyScope[] = [
  'evaluate',
  'traces:read',
  'traces:write',
  'agents:read',
  'approvals:read',
  'admin',
];

export class ApiKeyService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(tenantId: string, data: { name: string; scopes: ApiKeyScope[]; expires_at?: string }) {
    const rawKey = 'ai_' + randomBytes(32).toString('hex');
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 12);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        tenant_id: tenantId,
        name: data.name,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        scopes: data.scopes,
        expires_at: data.expires_at ? new Date(data.expires_at) : null,
      },
    });

    // Return with raw key — only time it's shown
    return { ...apiKey, key: rawKey };
  }

  async list(tenantId: string) {
    return this.prisma.apiKey.findMany({
      where: { tenant_id: tenantId },
      select: {
        id: true,
        name: true,
        key_prefix: true,
        scopes: true,
        expires_at: true,
        last_used_at: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async delete(tenantId: string, keyId: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, tenant_id: tenantId },
    });
    if (!key) throw new NotFoundError('ApiKey', keyId);
    await this.prisma.apiKey.delete({ where: { id: keyId } });
  }

  async rotate(tenantId: string, keyId: string) {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id: keyId, tenant_id: tenantId },
    });
    if (!existing) throw new NotFoundError('ApiKey', keyId);

    const rawKey = 'ai_' + randomBytes(32).toString('hex');
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 12);

    // Use updateMany — works correctly with the tenant-scoped Prisma extension
    await this.prisma.apiKey.updateMany({
      where: { id: keyId },
      data: {
        key_prefix: keyPrefix,
        key_hash: keyHash,
        last_used_at: null, // reset
      },
    });

    const updated = await this.prisma.apiKey.findFirst({
      where: { id: keyId },
    });

    return { ...updated!, key: rawKey };
  }
}
