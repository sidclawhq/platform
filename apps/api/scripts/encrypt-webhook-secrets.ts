/**
 * One-time backfill: encrypt legacy plaintext webhook signing secrets.
 *
 * Usage (from apps/api, with DATABASE_URL and SECRET_ENCRYPTION_KEY set):
 *   npx tsx scripts/encrypt-webhook-secrets.ts
 *
 * Idempotent — already-encrypted rows are skipped. Run once after setting
 * SECRET_ENCRYPTION_KEY in the deployment environment.
 */
import { PrismaClient } from '../src/generated/prisma/index.js';
import { encryptSecret, isEncrypted } from '../src/lib/secret-crypto.js';

if (!/^[0-9a-fA-F]{64}$/.test(process.env['SECRET_ENCRYPTION_KEY'] ?? '')) {
  console.error('SECRET_ENCRYPTION_KEY must be set to 64 hex characters (openssl rand -hex 32)');
  process.exit(1);
}

const prisma = new PrismaClient();

const endpoints = await prisma.webhookEndpoint.findMany({ select: { id: true, secret: true } });
let encrypted = 0;
let skipped = 0;

for (const endpoint of endpoints) {
  if (isEncrypted(endpoint.secret)) {
    skipped++;
    continue;
  }
  await prisma.webhookEndpoint.update({
    where: { id: endpoint.id },
    data: { secret: encryptSecret(endpoint.secret) },
  });
  encrypted++;
}

console.log(`Done: ${encrypted} encrypted, ${skipped} already encrypted, ${endpoints.length} total.`);
await prisma.$disconnect();
