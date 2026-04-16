// ═══════════════════════════════════════════════════════════
// Payment Verify API — /api/payment/verify
// ═══════════════════════════════════════════════════════════
// Verifies the Razorpay payment signature for security.
// On success: updates the user's plan and plan_expiry in Supabase.
// ═══════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

// Plan durations in days
const PLAN_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 30,
  yearly: 365,
};

export async function POST(req: Request) {
  try {
    // --- Auth Check ---
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // --- Parse payment details from request ---
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = await req.json();

    // --- Verify Signature (Razorpay HMAC SHA256) ---
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ success: false, error: 'Payment verification failed' }, { status: 400 });
    }

    // --- Calculate plan expiry ---
    const days = PLAN_DAYS[plan] || 30;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);

    // --- Update user profile in Supabase ---
    const { error } = await supabase.from('profiles').update({
      plan: plan,
      plan_expiry: expiry.toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      plan: plan,
      plan_expiry: expiry.toISOString(),
    });

  } catch (error: any) {
    console.error('Payment verify error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
