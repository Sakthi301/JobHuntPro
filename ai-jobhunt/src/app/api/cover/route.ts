// ═══════════════════════════════════════════════════════════
// Cover Note / Cold Email API Route — /api/cover
// ═══════════════════════════════════════════════════════════
// POST handler that generates AI-written content:
// - type: "custom"     → Cover note from a job description
// - type: "cold_email" → Cold outreach email to a recruiter
// Uses Groq AI for generation, increments usage count.
// Free users: 5 total uses (shared across all features).
// Paid users: Unlimited.
// ═══════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callGroq } from '@/lib/groq';

export async function POST(req: Request) {
  try {
    // --- Auth Check ---
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // --- Plan & Usage Limit Check ---
    const { data: profileData } = await supabase
      .from('profiles')
      .select('plan, plan_expiry, usage_count')
      .eq('id', user.id)
      .single();

    if (!profileData) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
    }

    const isPaid = profileData.plan && profileData.plan !== 'free';
    const isExpired = isPaid && profileData.plan_expiry && new Date(profileData.plan_expiry) < new Date();

    // Auto-downgrade expired paid plans back to free
    if (isExpired) {
      await supabase.from('profiles').update({ plan: 'free', plan_expiry: null }).eq('id', user.id);
      profileData.plan = 'free';
    }

    // Free users: max 5 uses (shared across all features)
    if ((!profileData.plan || profileData.plan === 'free') && (profileData.usage_count || 0) >= 5) {
      return NextResponse.json({ success: false, error: 'limit_reached' }, { status: 403 });
    }

    // --- Parse Request Body ---
    const { type, company, title, jd, profile } = await req.json();

    // --- Build AI Prompt Based on Type ---
    let prompt = "";

    if (type === "cold_email") {
      // Cold email to a recruiter
      prompt = `Write a cold outreach email from a job seeker to HR/recruiter.
SENDER: ${profile.name || 'Job Seeker'}
Experience: ${profile.experience || 'Entry level'}
Current Role: ${profile.current_role || 'Not specified'}
Skills: ${profile.skills || 'Not specified'}
Achievement: ${profile.achievement || 'Not specified'}

TARGET COMPANY: ${company}
ROLE: ${title}

Write a 140-160 word cold email:
- Professional Subject line
- Direct, confident, not generic
- Show specific value
- Ask for a brief call
- Professional sign-off`;
    } else {
      // Cover note from a job description
      prompt = `Write a professional cover note for this job application.

CANDIDATE: ${profile.name || 'Job Seeker'}
Experience: ${profile.experience || 'Not specified'}
Current Role: ${profile.current_role || 'Not specified'}
Industry: ${profile.industry || 'Not specified'}
Skills: ${profile.skills || 'Not specified'}
Key Achievement: ${profile.achievement || 'Not specified'}

JOB: ${title || 'Role'} at ${company || 'Company'}
JOB DESCRIPTION:
${jd || 'Not provided'}

Write a 160-190 word cover note:
- Subject line at top
- Strong opening (NOT "I am writing to...")
- 2-3 specific matching skills from JD
- One achievement with a number
- Professional, confident tone
- Clear call to action
- Sign off as ${profile.name || '[Your Name]'}`;
    }

    // --- Generate via Groq AI ---
    const note = await callGroq(prompt);

    // --- Increment Usage Count ---
    await supabase
      .from('profiles')
      .update({ usage_count: (profileData.usage_count || 0) + 1 })
      .eq('id', user.id);

    // --- Return Generated Note ---
    return NextResponse.json({ success: true, note });

  } catch (error: any) {
    console.error('Cover note error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
