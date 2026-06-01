import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Follow-up cadence API
// POST /api/followup — log contact + schedule next follow-up
// GET /api/followup?application_id=xxx — get follow-up schedule
// PUT /api/followup — mark done or snooze

const CADENCE_SCHEDULE: Record<string, number> = {
  applied: 7,
  screening: 5,
  interviewing: 3,
  offer: 2,
};

async function getCount(supabase: any, appId: string, userId: string): Promise<number> {
  const { data } = await supabase
    .from('tracked_applications')
    .select('followup_count')
    .eq('id', appId)
    .eq('user_id', userId)
    .single();
  return ((data as any)?.followup_count || 0) + 1;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const appId = url.searchParams.get('application_id');

    if (appId) {
      const { data } = await supabase
        .from('tracked_applications')
        .select('id, pipeline_stage, applied_at, last_contact_at, next_followup_at, followup_count, followup_note')
        .eq('id', appId)
        .eq('user_id', user.id)
        .single();

      if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const stage = (data as any).pipeline_stage || 'applied';
      const cadence = CADENCE_SCHEDULE[stage] || 7;
      const lastContact = new Date((data as any).last_contact_at || (data as any).applied_at || Date.now());
      const nextFollowup = new Date(lastContact.getTime() + cadence * 24 * 60 * 60 * 1000);
      const isOverdue = new Date((data as any).next_followup_at || 0) < new Date();

      return NextResponse.json({
        application_id: (data as any).id,
        pipeline_stage: stage,
        cadence_days: cadence,
        last_contact_at: (data as any).last_contact_at,
        next_followup_at: (data as any).next_followup_at || nextFollowup.toISOString(),
        followup_count: (data as any).followup_count || 0,
        followup_note: (data as any).followup_note || '',
        is_overdue: isOverdue,
        days_until_followup: Math.max(0, Math.round((nextFollowup.getTime() - Date.now()) / (24 * 60 * 60 * 1000))),
      });
    }

    const { data: apps } = await supabase
      .from('tracked_applications')
      .select('id, job_id, pipeline_stage, applied_at, last_contact_at, next_followup_at, followup_count, followup_note, jobs(title, company)')
      .eq('user_id', user.id)
      .in('pipeline_stage', ['applied', 'screening', 'interviewing', 'offer'])
      .order('next_followup_at', { ascending: true, nullsFirst: true })
      .limit(50);

    const followups = (apps || []).map((app: any) => {
      const stage = app.pipeline_stage || 'applied';
      const cadence = CADENCE_SCHEDULE[stage] || 7;
      const lastContact = new Date(app.last_contact_at || app.applied_at || Date.now());
      const nextFollowup = new Date(lastContact.getTime() + cadence * 24 * 60 * 60 * 1000);
      return {
        application_id: app.id,
        job_id: app.job_id,
        title: app.jobs?.title || 'Untitled',
        company: app.jobs?.company || 'Unknown',
        pipeline_stage: stage,
        next_followup_at: app.next_followup_at || nextFollowup.toISOString(),
        followup_count: app.followup_count || 0,
        overdue: new Date(app.next_followup_at || nextFollowup) < new Date(),
      };
    });

    return NextResponse.json({ followups });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed', message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { application_id, note, snooze_days } = body;
    if (!application_id) return NextResponse.json({ error: 'application_id required' }, { status: 400 });

    const newCount = await getCount(supabase, application_id, user.id);
    const days = snooze_days || CADENCE_SCHEDULE['applied'] || 7;
    const nextFollowup = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('tracked_applications')
      .update({
        last_contact_at: new Date().toISOString(),
        next_followup_at: nextFollowup,
        followup_count: newCount,
        followup_note: note || null,
      })
      .eq('id', application_id)
      .eq('user_id', user.id)
      .select('id, next_followup_at, followup_count')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({
      success: true,
      application_id: (data as any).id,
      next_followup_at: (data as any).next_followup_at,
      followup_count: (data as any).followup_count,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { application_id, mark_done, snooze_days } = body;
    if (!application_id) return NextResponse.json({ error: 'application_id required' }, { status: 400 });

    if (mark_done) {
      const newCount = await getCount(supabase, application_id, user.id);
      const { data } = await supabase
        .from('tracked_applications')
        .update({
          last_contact_at: new Date().toISOString(),
          next_followup_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          followup_count: newCount,
        })
        .eq('id', application_id)
        .eq('user_id', user.id)
        .select('id, next_followup_at, followup_count')
        .single();

      return NextResponse.json({ success: true, data });
    }

    const days = snooze_days || 3;
    const nextFollowup = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
      .from('tracked_applications')
      .update({ next_followup_at: nextFollowup })
      .eq('id', application_id)
      .eq('user_id', user.id)
      .select('id, next_followup_at')
      .single();

    return NextResponse.json({ success: true, snoozed_to: nextFollowup, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
