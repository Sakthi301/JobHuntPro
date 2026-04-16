// ═══════════════════════════════════════════════════════════
// Payment Create API — /api/payment/create
// ═══════════════════════════════════════════════════════════
// Creates a Razorpay order for the selected subscription plan.
// Returns the order_id for the frontend Razorpay checkout popup.
// ═══════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Razorpay from 'razorpay';

// Plan pricing in paise (₹1 = 100 paise)
const PLANS: Record<string, { amount: number; label: string; days: number }> = {
  weekly:  { amount: 4900,   label: 'Weekly Plan',      days: 7 },
  monthly: { amount: 14900,  label: 'Monthly Plan',     days: 30 },
  yearly:  { amount: 99900,  label: 'Pro Yearly Plan',  days: 365 },
};

export async function POST(req: Request) {
  try {
    // --- Auth Check ---
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // --- Parse plan from request ---
    const { plan } = await req.json();
    const selected = PLANS[plan];
    if (!selected) {
      return NextResponse.json({ success: false, error: 'Invalid plan' }, { status: 400 });
    }

    // --- Create Razorpay Order ---
    const razorpay = new Razorpay({
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const order = await razorpay.orders.create({
      amount: selected.amount,
      currency: 'INR',
      receipt: `myaijobhunt_${user.id.substring(0, 8)}_${Date.now()}`,
      notes: {
        user_id: user.id,
        plan: plan,
        email: user.email || '',
      },
    });

    return NextResponse.json({
      success: true,
      order_id: order.id,
      amount: selected.amount,
      plan_label: selected.label,
    });

  } catch (error: any) {
    console.error('Payment create error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
