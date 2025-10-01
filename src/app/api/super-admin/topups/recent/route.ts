import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TopUpEvent } from '../../../../../../packages/shared/pricing';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check if user is authenticated and is super admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has super admin role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      );
    }

    // Get recent top-up events (last 50)
    const { data: events, error: eventsError } = await supabase
      .from('topup_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (eventsError) {
      console.error('Error fetching recent top-ups:', eventsError);
      return NextResponse.json(
        { error: 'Failed to fetch recent top-ups' },
        { status: 500 }
      );
    }

    // Transform to match TopUpEvent interface
    const topUpEvents: TopUpEvent[] = (events || []).map(event => ({
      id: event.id,
      orgId: event.org_id,
      addedCredits: event.added_credits,
      reason: event.reason,
      performedByUserId: event.performed_by_user_id,
      createdAt: new Date(event.created_at)
    }));

    return NextResponse.json({
      events: topUpEvents,
      total: topUpEvents.length
    });

  } catch (error) {
    console.error('Error in recent top-ups API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}