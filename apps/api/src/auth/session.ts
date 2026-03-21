import { PrismaClient } from '../generated/prisma/index.js';
import { randomUUID } from 'node:crypto';

const SESSION_TTL_SECONDS = parseInt(process.env['SESSION_TTL_SECONDS'] ?? '28800'); // 8 hours

export class SessionManager {
  constructor(private readonly prisma: PrismaClient) {}

  async create(userId: string, tenantId: string): Promise<string> {
    const session = await this.prisma.session.create({
      data: {
        id: randomUUID(),
        user_id: userId,
        tenant_id: tenantId,
        expires_at: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
      },
    });
    return session.id;
  }

  async validate(sessionId: string): Promise<{ userId: string; tenantId: string } | null> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) return null;
    if (session.expires_at < new Date()) {
      await this.prisma.session.delete({ where: { id: sessionId } });
      return null;
    }
    return { userId: session.user_id, tenantId: session.tenant_id };
  }

  async destroy(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
  }

  async destroyAllForUser(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { user_id: userId } });
  }
}
