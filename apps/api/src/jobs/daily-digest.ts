import { prisma } from '../db/client.js';
import { EmailService } from '../services/email-service.js';

export async function sendDailyDigest(): Promise<void> {
  const adminEmail = process.env['ADMIN_ALERT_EMAIL'];
  if (!adminEmail) return;

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 86400000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

  // Gather metrics
  const [
    totalTenants,
    newTenantsToday,
    totalUsers,
    payingTenants,
    tracesToday,
    tracesWeek,
    pendingApprovals,
    approvedToday,
    deniedToday,
    totalAgents,
    totalPolicies,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { created_at: { gte: oneDayAgo } } }),
    prisma.user.count(),
    prisma.tenant.count({ where: { plan: { not: 'free' } } }),
    prisma.auditTrace.count({ where: { started_at: { gte: oneDayAgo } } }),
    prisma.auditTrace.count({ where: { started_at: { gte: sevenDaysAgo } } }),
    prisma.approvalRequest.count({ where: { status: 'pending' } }),
    prisma.approvalRequest.count({ where: { status: 'approved', decided_at: { gte: oneDayAgo } } }),
    prisma.approvalRequest.count({ where: { status: 'denied', decided_at: { gte: oneDayAgo } } }),
    prisma.agent.count(),
    prisma.policyRule.count({ where: { is_active: true } }),
  ]);

  // Top active tenants (by traces today)
  const activeTenants = await prisma.auditTrace.groupBy({
    by: ['tenant_id'],
    where: { started_at: { gte: oneDayAgo } },
    _count: true,
    orderBy: { _count: { tenant_id: 'desc' } },
    take: 5,
  });

  const tenantNames = await prisma.tenant.findMany({
    where: { id: { in: activeTenants.map(t => t.tenant_id) } },
    select: { id: true, name: true, plan: true },
  });

  const topActive = activeTenants.map(t => {
    const tenant = tenantNames.find(n => n.id === t.tenant_id);
    return `${tenant?.name ?? t.tenant_id} (${tenant?.plan}) — ${t._count} traces`;
  }).join('\n  ');

  // New signups with details
  const newSignups = await prisma.tenant.findMany({
    where: { created_at: { gte: oneDayAgo } },
    include: {
      users: { select: { email: true, name: true }, take: 1 },
      _count: { select: { agents: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  const signupLines = newSignups.map(t => {
    const user = t.users[0];
    return `${t.name} — ${user?.email ?? 'no user'} (${t._count.agents} agents)`;
  }).join('\n  ') || 'None';

  // Format email
  const date = now.toLocaleDateString('en-CH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const emailService = new EmailService();
  await emailService.send({
    to: [adminEmail],
    subject: `📊 SidClaw Daily Digest — ${now.toISOString().split('T')[0]}`,
    text: `
SidClaw Daily Digest — ${date}

PLATFORM
  Tenants: ${totalTenants} (${newTenantsToday} new today)
  Users: ${totalUsers}
  Paying: ${payingTenants}
  Agents: ${totalAgents}
  Policies: ${totalPolicies}

ACTIVITY (24h)
  Evaluations: ${tracesToday}
  Evaluations (7d): ${tracesWeek}
  Approved: ${approvedToday}
  Denied: ${deniedToday}
  Pending now: ${pendingApprovals}

NEW SIGNUPS
  ${signupLines}

TOP ACTIVE TENANTS
  ${topActive || 'No activity'}

---
SidClaw — https://api.sidclaw.com/health
    `.trim(),
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; color: #333;">
        <h2 style="margin-bottom: 4px;">SidClaw Daily Digest</h2>
        <p style="color: #888; font-size: 13px; margin-top: 0;">${date}</p>

        <h3 style="font-size: 14px; color: #666; border-bottom: 1px solid #eee; padding-bottom: 4px;">Platform</h3>
        <table style="font-size: 14px; width: 100%;">
          <tr><td style="color: #888; width: 140px;">Tenants</td><td><strong>${totalTenants}</strong> ${newTenantsToday > 0 ? `<span style="color: #22C55E;">(+${newTenantsToday} new)</span>` : ''}</td></tr>
          <tr><td style="color: #888;">Users</td><td>${totalUsers}</td></tr>
          <tr><td style="color: #888;">Paying</td><td><strong style="color: ${payingTenants > 0 ? '#22C55E' : '#888'};">${payingTenants}</strong></td></tr>
          <tr><td style="color: #888;">Agents</td><td>${totalAgents}</td></tr>
          <tr><td style="color: #888;">Policies</td><td>${totalPolicies}</td></tr>
        </table>

        <h3 style="font-size: 14px; color: #666; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-top: 20px;">Activity (24h)</h3>
        <table style="font-size: 14px; width: 100%;">
          <tr><td style="color: #888; width: 140px;">Evaluations</td><td><strong>${tracesToday}</strong> (${tracesWeek} this week)</td></tr>
          <tr><td style="color: #888;">Approved</td><td style="color: #22C55E;">${approvedToday}</td></tr>
          <tr><td style="color: #888;">Denied</td><td style="color: #EF4444;">${deniedToday}</td></tr>
          <tr><td style="color: #888;">Pending now</td><td style="color: ${pendingApprovals > 0 ? '#F59E0B' : '#888'};">${pendingApprovals}</td></tr>
        </table>

        ${newSignups.length > 0 ? `
        <h3 style="font-size: 14px; color: #666; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-top: 20px;">New Signups</h3>
        <ul style="font-size: 13px; padding-left: 20px;">
          ${newSignups.map(t => `<li>${t.name} — ${t.users[0]?.email ?? 'no user'} (${t._count.agents} agents)</li>`).join('')}
        </ul>` : ''}

        ${topActive ? `
        <h3 style="font-size: 14px; color: #666; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-top: 20px;">Most Active</h3>
        <ol style="font-size: 13px; padding-left: 20px;">
          ${activeTenants.map(t => {
            const tenant = tenantNames.find(n => n.id === t.tenant_id);
            return `<li>${tenant?.name ?? 'Unknown'} <span style="color: #888;">(${tenant?.plan})</span> — ${t._count} evaluations</li>`;
          }).join('')}
        </ol>` : ''}

        <p style="margin-top: 24px; font-size: 12px; color: #aaa;">
          <a href="https://api.sidclaw.com/health" style="color: #3B82F6;">Health Check</a> ·
          <a href="https://app.sidclaw.com" style="color: #3B82F6;">Dashboard</a> ·
          <a href="https://railway.app" style="color: #3B82F6;">Railway</a> ·
          <a href="https://dashboard.stripe.com" style="color: #3B82F6;">Stripe</a>
        </p>
      </div>
    `,
  }).catch(err => console.error('[DailyDigest] Failed to send:', err));

  console.log(`[DailyDigest] Sent to ${adminEmail}`);
}
