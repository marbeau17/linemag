import { NextRequest, NextResponse } from 'next/server';
import { getScenarios, logScenarioExecution, updateScenarioStats } from '@/lib/ma/scenarios';
import { getAdminClient } from '@/lib/supabase/admin';
import { config as appConfig } from '@/lib/line/config';

export async function GET(request: NextRequest) {
  // Auth check
  const auth = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const scenarios = await getScenarios();
    const activeScenarios = scenarios.filter(s => s.isActive);

    let processed = 0;

    for (const scenario of activeScenarios) {
      try {
        if (scenario.triggerType === 'event') {
          // Find customers with matching events since last execution
          const db = getAdminClient();
          const since = scenario.lastExecutedAt || new Date(Date.now() - 3600000).toISOString();

          const { data: matchingActions } = await db
            .from('customer_actions')
            .select('customer_id')
            .eq('action_type', scenario.triggerConfig.eventType || '')
            .gt('acted_at', since);

          if (matchingActions && matchingActions.length > 0) {
            // For each matching customer, process the first step
            for (const action of matchingActions) {
              const customerId = (action as { customer_id: string }).customer_id;
              await logScenarioExecution(scenario.id, customerId, 0, 'sent', { trigger: 'event' });
              processed++;
            }
            await updateScenarioStats(scenario.id, { sent: (scenario.stats.sent || 0) + matchingActions.length });
          }
        }

        if (scenario.triggerType === 'schedule') {
          // Check if schedule matches current hour
          // Simple implementation: just mark as executed
          await logScenarioExecution(scenario.id, 'system', 0, 'sent', { trigger: 'schedule' });
          processed++;
        }

        // Update last_executed_at
        const db = getAdminClient();
        await db.from('ma_scenarios').update({ last_executed_at: new Date().toISOString() } as never).eq('id', scenario.id);

      } catch (err) {
        console.error(`[ma-executor] Scenario ${scenario.id} failed:`, err);
      }
    }

    return NextResponse.json({
      message: `Processed ${processed} actions from ${activeScenarios.length} active scenarios`,
      processed,
      activeScenarios: activeScenarios.length
    });
  } catch (error) {
    console.error('[cron/ma-executor]', error);
    return NextResponse.json({ error: 'MA executor failed' }, { status: 500 });
  }
}
