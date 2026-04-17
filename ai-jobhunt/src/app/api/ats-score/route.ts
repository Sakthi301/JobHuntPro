// ═══════════════════════════════════════════════════════════
// ATS Score API — /api/ats-score
// ═══════════════════════════════════════════════════════════
// PRO ONLY: Analyzes how well a resume matches a specific
// job description for ATS (Applicant Tracking System)
// compatibility. Returns score, keywords, and suggestions.
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

    // --- Parse request ---
    const formData = await req.formData();
    const file = formData.get('resume') as File | null;
    const jobDescription = formData.get('jobDescription') as string | null;

    if (!file || !jobDescription) {
      return NextResponse.json({ success: false, error: 'Resume file and job description are required' }, { status: 400 });
    }

    // --- Extract text from file ---
    const buffer = Buffer.from(await file.arrayBuffer());
    let resumeText = '';
    const name = file.name.toLowerCase();

    if (name.endsWith('.pdf')) {
      resumeText = await extractTextFromPdf(buffer);
    } else if (name.endsWith('.docx') || name.endsWith('.doc')) {
      const result = await mammoth.extractRawText({ buffer });
      resumeText = result.value;
    } else {
      resumeText = buffer.toString('utf-8');
    }

    if (!resumeText.trim()) {
      return NextResponse.json({ success: false, error: 'Could not extract text from file' }, { status: 400 });
    }

    // --- Analyze ATS Compatibility via Groq AI ---
    const prompt = `You are an expert ATS (Applicant Tracking System) analyzer. Compare this resume against the job description and provide a comprehensive compatibility analysis.

RESUME:
${resumeText.substring(0, 4000)}

JOB DESCRIPTION:
${jobDescription.substring(0, 3000)}

Analyze and return ONLY valid JSON (no markdown, no explanation):
{
  "overall_score": 75,
  "keyword_match_percent": 68,
  "matched_keywords": ["keyword1", "keyword2", "keyword3"],
  "missing_keywords": ["missing1", "missing2", "missing3"],
  "sections": [
    {
      "name": "Skills Match",
      "score": 80,
      "feedback": "Brief feedback about this section"
    },
    {
      "name": "Experience Relevance",
      "score": 70,
      "feedback": "Brief feedback"
    },
    {
      "name": "Education",
      "score": 90,
      "feedback": "Brief feedback"
    },
    {
      "name": "Keywords & Formatting",
      "score": 60,
      "feedback": "Brief feedback"
    }
  ],
  "improvements": [
    "Specific improvement suggestion 1",
    "Specific improvement suggestion 2",
    "Specific improvement suggestion 3",
    "Specific improvement suggestion 4",
    "Specific improvement suggestion 5"
  ],
  "summary": "2-3 sentence overall assessment of how well this resume matches the job"
}`;

    const raw = await callGroq(prompt);
    const clean = raw.replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(clean);

    return NextResponse.json({ success: true, analysis });

  } catch (error: any) {
    console.error('ATS score error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
