// ═══════════════════════════════════════════════════════════
// Resume Parse API — /api/resume-parse
// ═══════════════════════════════════════════════════════════
// PRO ONLY: Accepts a PDF resume upload, extracts text,
// sends it to Groq AI to extract structured profile data,
// and returns it for auto-filling the Setup form.
// ═══════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callGroq } from '@/lib/groq';
import { extractTextFromPdf } from '@/lib/pdf';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require('mammoth');

export async function POST(req: Request) {
  try {
    // --- Auth + Pro Check ---
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single();
    if (!profile?.plan || profile.plan === 'free') {
      return NextResponse.json({ success: false, error: 'pro_required' }, { status: 403 });
    }

    // --- Extract file from form data ---
    const formData = await req.formData();
    const file = formData.get('resume') as File | null;
    if (!file) return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });

    // --- Extract text based on file type ---
    const buffer = Buffer.from(await file.arrayBuffer());
    let resumeText = '';
    const name = file.name.toLowerCase();

    if (name.endsWith('.pdf')) {
      resumeText = await extractTextFromPdf(buffer);
    } else if (name.endsWith('.docx') || name.endsWith('.doc')) {
      const result = await mammoth.extractRawText({ buffer });
      resumeText = result.value;
    } else {
      // For .txt (plain text fallback)
      resumeText = buffer.toString('utf-8');
    }

    if (!resumeText.trim()) {
      return NextResponse.json({ success: false, error: 'Could not extract text from file' }, { status: 400 });
    }

    // --- Send to Groq AI for structured extraction ---
    const prompt = `You are an expert resume parser. Extract the following fields from this resume text and return ONLY valid JSON (no markdown, no explanation):

RESUME TEXT:
${resumeText.substring(0, 5000)}

Return this exact JSON schema:
{
  "name": "Full name",
  "experience": "Years of experience e.g. '3+ years'",
  "current_role": "Most recent job title",
  "industry": "One of: Software / IT, Telecom / Networking, Data Science / AI, Finance / Banking, Healthcare, Marketing / Sales, Design / Creative, Other",
  "skills": "Comma-separated core skills",
  "achievement": "Single most impressive achievement (1 sentence)",
  "target_roles": ["2-3 suggested target job titles based on experience"],
  "target_locations": ["2-3 locations mentioned or suggested"],
  "min_salary": "Estimated market salary based on role and experience"
}`;

    const raw = await callGroq(prompt);
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return NextResponse.json({ success: true, data: parsed });

  } catch (error: any) {
    console.error('Resume parse error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
