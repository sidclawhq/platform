import { prisma } from '../db/client.js';
import { logger } from '../logger.js';

export async function cleanupSessions(): Promise<void> {
  const deleted = await prisma.session.deleteMany({
    where: { expires_at: { lt: new Date() } },
  });
  if (deleted.count > 0) {
    logger.info({ count: deleted.count }, 'Cleaned expired sessions');
  }
}
