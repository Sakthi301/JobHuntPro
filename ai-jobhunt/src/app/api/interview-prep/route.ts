// ═══════════════════════════════════════════════════════════
// Interview Prep API — /api/interview-prep
// ═══════════════════════════════════════════════════════════
// PRO ONLY: Generates 10 tailored interview questions with
// ideal answers based on the user's profile, target company,
// and target role using Groq AI.
// ═══════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callGroq } from '@/lib/groq';

export async function POST(req: Request) {
  try {
    // --- Auth + Pro Check ---
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (!profile?.plan || profile.plan === 'free') {
      return NextResponse.json({ success: false, error: 'pro_required' }, { status: 403 });
    }

    // --- Parse request ---
    const { company, role } = await req.json();
    if (!company || !role) {
      return NextResponse.json({ success: false, error: 'Company and role are required' }, { status: 400 });
    }

    // --- Generate Interview Questions via Groq AI ---
    const prompt = `You are an expert interview coach. Generate exactly 10 interview questions that "${company}" would likely ask for a "${role}" position.

CANDIDATE PROFILE:
- Name: ${profile.name || 'Candidate'}
- Experience: ${profile.experience || 'Not specified'}
- Current Role: ${profile.current_role || 'Not specified'}
- Skills: ${profile.skills || 'Not specified'}
- Key Achievement: ${profile.achievement || 'Not specified'}
- Industry: ${profile.industry || 'Not specified'}

Generate a mix of:
- 3 Technical questions (specific to the role)
- 3 Behavioral questions (STAR format)
- 2 Situational questions (scenario-based)
- 2 Company-specific questions (about ${company})

Return ONLY valid JSON array. Schema:
[{
  "id": 1,
  "category": "Technical" | "Behavioral" | "Situational" | "Company",
  "question": "The interview question",
  "ideal_answer": "A detailed ideal answer tailored to the candidate's profile (3-4 sentences)",
  "tip": "One specific tip for answering this question well"
}]`;

    const raw = await callGroq(prompt);
    const clean = raw.replace(/```json|```/g, '').trim();
    const questions = JSON.parse(clean);

    return NextResponse.json({ success: true, questions });

  } catch (error: any) {
    console.error('Interview prep error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
