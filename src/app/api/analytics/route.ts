import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Analytics API — funnel, source stats, velocity
// GET /api/analytics?type=funnel|sources|velocity|overview

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'overview';

    if (type === 'funnel') {
      // Pipeline funnel: count per stage
      const stages = ['saved', 'applied', 'screening', 'interviewing', 'offer', 'accepted', 'rejected', 'ghosted', 'withdrawn'];
      const funnel = [];
      for (const stage of stages) {
        const { count } = await supabase
          .from('tracked_applications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('pipeline_stage', stage);
        funnel.push({ stage, count: count || 0 });
      }

      // Conversion rates
      const totalSaved = funnel.find(f => f.stage === 'saved')?.count || 0;
      const totalApplied = funnel.find(f => f.stage === 'applied')?.count || 0;
      const totalInterview = funnel.find(f => f.stage === 'interviewing')?.count || 0;
      const totalOffer = funnel.find(f => f.stage === 'offer')?.count || 0;
      const totalAccepted = funnel.find(f => f.stage === 'accepted')?.count || 0;

      return NextResponse.json({
        funnel,
        conversionRates: {
          savedToApplied: totalSaved > 0 ? Math.round((totalApplied / totalSaved) * 100) : 0,
          appliedToInterview: totalApplied > 0 ? Math.round((totalInterview / totalApplied) * 100) : 0,
          interviewToOffer: totalInterview > 0 ? Math.round((totalOffer / totalInterview) * 100) : 0,
          offerToAccept: totalOffer > 0 ? Math.round((totalAccepted / totalOffer) * 100) : 0,
        },
      });
    }

    if (type === 'sources') {
      // Job count per source from tracked applications
      const { data: apps } = await supabase
        .from('tracked_applications')
        .select('job_id, jobs(source)')
        .eq('user_id', user.id);

      const sourceMap: Record<string, number> = {};
      if (apps) {
        for (const app of apps) {
          const j = app as any;
          const src = (j.jobs?.source || 'unknown') as string;
          sourceMap[src] = (sourceMap[src] || 0) + 1;
        }
      }

      const sources = Object.entries(sourceMap)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count);

      return NextResponse.json({ sources });
    }

    if (type === 'velocity') {
      // Average days between stage transitions
      const { data: logs } = await supabase
        .from('application_stage_log')
        .select('application_id, from_stage, to_stage, created_at')
        .order('created_at', { ascending: true });

      if (!logs || logs.length === 0) {
        return NextResponse.json({ message: 'No stage transitions yet', avgDaysPerStage: {} });
      }

      // Group by application
      const appLogs: Record<string, Array<{ from: string; to: string; at: string }>> = {};
      for (const log of logs) {
        const l = log as any;
        if (!appLogs[l.application_id]) appLogs[l.application_id] = [];
        appLogs[l.application_id].push({ from: l.from_stage, to: l.to_stage, at: l.created_at });
      }

      // Calculate avg days per stage
      const stageDays: Record<string, number[]> = {};
      for (const stages of Object.values(appLogs)) {
        for (let i = 0; i < stages.length; i++) {
          const days = i === 0
            ? 0
            : (new Date(stages[i].at).getTime() - new Date(stages[i - 1].at).getTime()) / (1000 * 60 * 60 * 24);
          const stage = stages[i].to;
          if (!stageDays[stage]) stageDays[stage] = [];
          stageDays[stage].push(days);
        }
      }

      const avgDaysPerStage: Record<string, number> = {};
      for (const [stage, days] of Object.entries(stageDays)) {
        avgDaysPerStage[stage] = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
      }

      return NextResponse.json({ avgDaysPerStage });
    }

    // Overview: combine everything
    const { count: totalSaved } = await supabase
      .from('tracked_applications').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
    const { count: totalActive } = await supabase
      .from('tracked_applications').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      .in('pipeline_stage', ['applied', 'screening', 'interviewing']);
    const { count: totalOffers } = await supabase
      .from('tracked_applications').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      .eq('pipeline_stage', 'offer');
    const { count: totalAccepted } = await supabase
      .from('tracked_applications').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      .eq('pipeline_stage', 'accepted');

    // Upcoming interviews
    const now = new Date().toISOString();
    const { data: upcomingInterviews } = await supabase
      .from('interview_rounds')
      .select('id, application_id, round_type, scheduled_at, job_id')
      .eq('user_id', user.id)
      .gte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(5);

    // Overdue follow-ups (applied > 7 days ago, no stage change)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: overdueApps } = await supabase
      .from('tracked_applications')
      .select('id, job_id, applied_at, last_activity_at, pipeline_stage, jobs(title, company)')
      .eq('user_id', user.id)
      .in('pipeline_stage', ['applied', 'screening'])
      .lte('last_activity_at', sevenDaysAgo)
      .limit(10);

    return NextResponse.json({
      totalSaved: totalSaved || 0,
      totalActive: totalActive || 0,
      totalOffers: totalOffers || 0,
      totalAccepted: totalAccepted || 0,
      upcomingInterviews: upcomingInterviews || [],
      overdueFollowups: overdueApps || [],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Analytics error:', message);
    return NextResponse.json({ error: 'Analytics failed', message }, { status: 500 });
  }
}
