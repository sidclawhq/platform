import { prisma } from '../db/client.js';

export async function cleanupSessions(): Promise<void> {
  const deleted = await prisma.session.deleteMany({
    where: { expires_at: { lt: new Date() } },
  });
  if (deleted.count > 0) {
    console.log(`Cleaned ${deleted.count} expired session(s)`);
  }
}
