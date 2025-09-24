import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { billingService } from '@/lib/billing.service';
import { CreditWallet, UsageEvent, TopUpEvent } from '../../../../packages/shared/pricing';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to get user from request
async function getUserFromRequest(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }

    // Get user profile with orgId and role
    const { data: profile } = await supabase
      .from('profiles')
      .select('orgId, role')
      .eq('id', user.id)
      .single();

    return { ...user, orgId: profile?.orgId, role: profile?.role };
  } catch (error) {
    console.error('[Credits API] Error getting user:', error);
    return null;
  }
}

// GET /api/credits - Get credit wallet and usage history
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !user.orgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'wallet';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    switch (type) {
      case 'wallet': {
        const balanceResult = await billingService.getBalance(user.orgId);
        const wallet = { balance: balanceResult.balance || 0 };
        return NextResponse.json({ wallet });
      }

      case 'usage': {
        const events = await billingService.getUsageEvents(user.orgId, limit);
        return NextResponse.json({ events });
      }

      case 'topups': {
        // TopUp events not implemented yet
        const events: any[] = [];
        return NextResponse.json({ events });
      }

      case 'summary': {
        const [balanceResult, usageEvents] = await Promise.all([
          billingService.getBalance(user.orgId),
          billingService.getUsageEvents(user.orgId, 10)
        ]);

        const wallet = { balance: balanceResult.balance || 0 };
        const topUpEvents: any[] = []; // Not implemented yet

        return NextResponse.json({
          wallet,
          recentUsage: usageEvents,
          recentTopUps: topUpEvents
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid type parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Credits API] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/credits - Top up credits (Super Admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is super admin
    if (user.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { orgId, addedCredits, reason } = body;

    // Validate input
    if (!orgId || !addedCredits || addedCredits <= 0) {
      return NextResponse.json(
        { error: 'Invalid input: orgId and positive addedCredits are required' },
        { status: 400 }
      );
    }

    // Perform top-up
    const result = await billingService.topUpCredits(
      orgId,
      addedCredits
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      newBalance: result.newBalance
    });
  } catch (error) {
    console.error('[Credits API] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/credits - Debit credits (internal use)
export async function PUT(request: NextRequest) {
  try {
    // This endpoint is for internal use only (service-to-service)
    const authHeader = request.headers.get('authorization');
    const internalKey = request.headers.get('x-internal-key');
    
    // Check for internal service key or service role
    if (internalKey !== process.env.INTERNAL_SERVICE_KEY && 
        !authHeader?.includes(process.env.SUPABASE_SERVICE_ROLE_KEY!)) {
      return NextResponse.json(
        { error: 'Unauthorized: Internal service access required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      orgId, 
      agentId, 
      inputTokens, 
      outputTokens, 
      channel, 
      messageId, 
      meta 
    } = body;

    // Validate input
    if (!orgId || !agentId || inputTokens < 0 || outputTokens < 0 || !channel) {
      return NextResponse.json(
        { error: 'Invalid input: orgId, agentId, tokens, and channel are required' },
        { status: 400 }
      );
    }

    // Calculate credit cost
    const creditCost = (inputTokens + outputTokens) * 0.001;

    // Perform debit
    const result = await billingService.debitCredits({
      orgId,
      credits: creditCost,
      agentId,
      channel,
      messageId,
      inputTokens,
      outputTokens,
      metadata: meta
    });

    return NextResponse.json({
      success: result.success,
      message: result.message,
      usageEvent: result.usageEvent
    });
  } catch (error) {
    console.error('[Credits API] PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}