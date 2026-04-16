// ═══════════════════════════════════════════════════════════
// Scan API Route — /api/scan
// ═══════════════════════════════════════════════════════════
// POST handler that:
// 1. Fetches live jobs from RapidAPI JSearch
// 2. Sends them to Groq AI for scoring against user profile
// 3. Returns scored + sorted jobs to the frontend
// 4. Increments user's usage count in the database
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

    if (profileData) {
      const isPaid = profileData.plan && profileData.plan !== 'free';
      const isExpired = isPaid && profileData.plan_expiry && new Date(profileData.plan_expiry) < new Date();

      // Auto-downgrade expired paid plans back to free
      if (isExpired) {
        await supabase.from('profiles').update({ plan: 'free', plan_expiry: null }).eq('id', user.id);
        profileData.plan = 'free';
      }

      // Free users: max 5 scans
      if ((!profileData.plan || profileData.plan === 'free') && (profileData.usage_count || 0) >= 5) {
        return NextResponse.json({ success: false, error: 'limit_reached' }, { status: 403 });
      }
    }

    // --- Parse Request Body ---
    const { profile } = await req.json();
    const targetRole = profile.target_roles?.[0] || 'Developer';
    const targetLoc = profile.target_locations?.[0] || 'Remote';

    // --- Step 1: Fetch Live Jobs from JSearch ---
    let fetchedJobs: any[] = [];
    try {
      const query = `${targetRole} in ${targetLoc}`;
      const jsearchUrl = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&num_pages=1`;

      const jsRes = await fetch(jsearchUrl, {
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || '',
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
        }
      });

      if (jsRes.ok) {
        const jsData = await jsRes.json();
        fetchedJobs = (jsData.data || []).map((j: any) => ({
          id: Math.floor(Math.random() * 10000),
          title: j.job_title,
          company: j.employer_name || 'Unknown',
          loc: j.job_city ? `${j.job_city}, ${j.job_country || ''}`.trim() : targetLoc,
          url: j.job_apply_link || j.apply_options?.[0]?.apply_link || '',
          salary: j.job_min_salary ? `$${j.job_min_salary}` : 'Not specified',
          portal: j.job_publisher || 'JSearch',
          description: (j.job_description || '').substring(0, 400),
        }));
      }
    } catch (e) {
      console.error('JSearch fetch failed:', e);
    }

    // --- Step 2: AI Scoring via Groq ---
    const prompt = `You are an AI scoring engine. I have fetched ${fetchedJobs.length} REAL jobs.

CANDIDATE PROFILE:
- Name: ${profile.name || 'Job Seeker'}
- Experience: ${profile.experience || 'Not specified'}
- Current Role: ${profile.current_role || 'Not specified'}
- Skills: ${profile.skills || 'Not specified'}

REAL JOBS FETCHED:
${JSON.stringify(fetchedJobs.slice(0, 10), null, 2)}

TASK: Score each job against candidate profile out of 100.
Return ONLY valid JSON array. Schema:
[{"id":1,"company":"[Keep Exact]","title":"[Keep Exact]","loc":"[Keep Exact]","portal":"[Keep Exact]","salary":"[Keep Exact]","exp":"[Estimate]","shift":"[Estimate]","url":"[Keep Exact Original URL]","skills":["extracted","skills"],"score":85,"verdict":"STRONG MATCH","reasons":"15 word reason","apply":true}]`;

    const raw = await callGroq(prompt);

    // Clean and parse the JSON response
    const clean = raw.replace(/```json|```/g, '').trim();
    const jobs = JSON.parse(clean);

    // --- Step 3: Increment Usage Count ---
    const { data: userData } = await supabase
      .from('profiles')
      .select('usage_count')
      .eq('id', user.id)
      .single();

    await supabase
      .from('profiles')
      .update({ usage_count: (userData?.usage_count || 0) + 1 })
      .eq('id', user.id);

    // --- Return Scored Jobs ---
    return NextResponse.json({ success: true, jobs });

  } catch (error: any) {
    console.error('Scan error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
