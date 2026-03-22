import { prisma } from '../db/client.js';
import { EmailService } from '../services/email-service.js';

export async function sendWeeklyReport(): Promise<void> {
  const adminEmail = process.env['ADMIN_ALERT_EMAIL'];
  if (!adminEmail) return;

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 86400000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);

  // This week vs last week comparison
  const [
    tenantsThisWeek,
    tenantsLastWeek,
    tracesThisWeek,
    tracesLastWeek,
    approvalsThisWeek,
    approvalsLastWeek,
    totalTenants,
    payingTenants,
    totalAgents,
    totalPolicies,
    totalUsers,
  ] = await Promise.all([
    prisma.tenant.count({ where: { created_at: { gte: oneWeekAgo } } }),
    prisma.tenant.count({ where: { created_at: { gte: twoWeeksAgo, lt: oneWeekAgo } } }),
    prisma.auditTrace.count({ where: { started_at: { gte: oneWeekAgo } } }),
    prisma.auditTrace.count({ where: { started_at: { gte: twoWeeksAgo, lt: oneWeekAgo } } }),
    prisma.approvalRequest.count({ where: { requested_at: { gte: oneWeekAgo } } }),
    prisma.approvalRequest.count({ where: { requested_at: { gte: twoWeeksAgo, lt: oneWeekAgo } } }),
    prisma.tenant.count(),
    prisma.tenant.count({ where: { plan: { not: 'free' } } }),
    prisma.agent.count(),
    prisma.policyRule.count({ where: { is_active: true } }),
    prisma.user.count(),
  ]);

  // Tenant breakdown by plan
  const planBreakdown = await prisma.tenant.groupBy({
    by: ['plan'],
    _count: true,
  });

  const planLines = planBreakdown.map(p => `${p.plan}: ${p._count}`).join(', ');

  // Change indicators
  const signupChange = tenantsLastWeek > 0
    ? `${Math.round(((tenantsThisWeek - tenantsLastWeek) / tenantsLastWeek) * 100)}%`
    : tenantsThisWeek > 0 ? '+∞' : '0%';
  const traceChange = tracesLastWeek > 0
    ? `${Math.round(((tracesThisWeek - tracesLastWeek) / tracesLastWeek) * 100)}%`
    : tracesThisWeek > 0 ? '+∞' : '0%';

  // All tenants with activity summary
  const allTenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      plan: true,
      created_at: true,
      _count: { select: { agents: true, users: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  const tenantActivity = await Promise.all(allTenants.map(async (t) => {
    const traces = await prisma.auditTrace.count({
      where: { tenant_id: t.id, started_at: { gte: oneWeekAgo } },
    });
    return { ...t, traces_this_week: traces };
  }));

  const tenantTable = tenantActivity
    .sort((a, b) => b.traces_this_week - a.traces_this_week)
    .map(t => `${t.name} | ${t.plan} | ${t._count.agents} agents | ${t._count.users} users | ${t.traces_this_week} traces`)
    .join('\n  ');

  const emailService = new EmailService();
  await emailService.send({
    to: [adminEmail],
    subject: `📈 SidClaw Weekly Report — Week of ${oneWeekAgo.toISOString().split('T')[0]}`,
    text: `
SidClaw Weekly Report
Week of ${oneWeekAgo.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}

SUMMARY
  Total tenants: ${totalTenants} (${tenantsThisWeek} new, ${signupChange} vs last week)
  Paying tenants: ${payingTenants}
  Plans: ${planLines}
  Total users: ${totalUsers}
  Total agents: ${totalAgents}
  Total policies: ${totalPolicies}

ACTIVITY
  Evaluations: ${tracesThisWeek} (${traceChange} vs last week)
  Approvals: ${approvalsThisWeek} (last week: ${approvalsLastWeek})

TENANT ACTIVITY
  ${tenantTable || 'No tenants yet'}

---
SidClaw
    `.trim(),
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; color: #333;">
        <h2>SidClaw Weekly Report</h2>
        <p style="color: #888; font-size: 13px;">
          ${oneWeekAgo.toISOString().split('T')[0]} → ${now.toISOString().split('T')[0]}
        </p>

        <table style="font-size: 14px; width: 100%; border-collapse: collapse;">
          <tr><td style="color: #888; padding: 4px 12px 4px 0;">New signups</td><td><strong>${tenantsThisWeek}</strong> <span style="color: ${signupChange.startsWith('+') || signupChange.startsWith('-') ? (signupChange.startsWith('+') ? '#22C55E' : '#EF4444') : '#888'};">(${signupChange})</span></td></tr>
          <tr><td style="color: #888; padding: 4px 12px 4px 0;">Evaluations</td><td><strong>${tracesThisWeek}</strong> <span style="color: ${traceChange.startsWith('+') || traceChange.startsWith('-') ? (traceChange.startsWith('+') ? '#22C55E' : '#EF4444') : '#888'};">(${traceChange})</span></td></tr>
          <tr><td style="color: #888; padding: 4px 12px 4px 0;">Paying tenants</td><td><strong style="color: ${payingTenants > 0 ? '#22C55E' : '#888'};">${payingTenants}</strong></td></tr>
          <tr><td style="color: #888; padding: 4px 12px 4px 0;">Plans</td><td>${planLines}</td></tr>
        </table>

        <h3 style="font-size: 14px; color: #666; margin-top: 20px; border-bottom: 1px solid #eee; padding-bottom: 4px;">All Tenants</h3>
        <table style="font-size: 12px; width: 100%; border-collapse: collapse;">
          <tr style="color: #888; text-transform: uppercase; font-size: 11px;">
            <th style="text-align: left; padding: 4px;">Tenant</th>
            <th style="text-align: left; padding: 4px;">Plan</th>
            <th style="text-align: right; padding: 4px;">Agents</th>
            <th style="text-align: right; padding: 4px;">Users</th>
            <th style="text-align: right; padding: 4px;">Traces/wk</th>
          </tr>
          ${tenantActivity.sort((a, b) => b.traces_this_week - a.traces_this_week).map(t => `
          <tr style="border-top: 1px solid #f0f0f0;">
            <td style="padding: 4px;">${t.name}</td>
            <td style="padding: 4px;"><span style="background: #f0f0f0; padding: 1px 6px; border-radius: 4px; font-size: 11px;">${t.plan}</span></td>
            <td style="padding: 4px; text-align: right;">${t._count.agents}</td>
            <td style="padding: 4px; text-align: right;">${t._count.users}</td>
            <td style="padding: 4px; text-align: right; font-weight: ${t.traces_this_week > 0 ? 'bold' : 'normal'};">${t.traces_this_week}</td>
          </tr>`).join('')}
        </table>

        <p style="margin-top: 24px; font-size: 12px; color: #aaa;">
          <a href="https://dashboard.stripe.com" style="color: #3B82F6;">Stripe</a> ·
          <a href="https://railway.app" style="color: #3B82F6;">Railway</a> ·
          <a href="https://app.sidclaw.com" style="color: #3B82F6;">Dashboard</a>
        </p>
      </div>
    `,
  }).catch(err => console.error('[WeeklyReport] Failed to send:', err));

  console.log(`[WeeklyReport] Sent to ${adminEmail}`);
}
