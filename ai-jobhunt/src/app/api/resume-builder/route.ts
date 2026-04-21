import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callGroq } from "@/lib/groq";
import { extractTextFromPdf } from "@/lib/pdf";
import { buildResumePdf, type TailoredResume } from "@/lib/resumePdf";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require("mammoth");

function parseAiJson(raw: string): TailoredResume {
  const cleaned = raw.replace(/```json|```/gi, "").trim();
  try {
    return JSON.parse(cleaned) as TailoredResume;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as TailoredResume;
    }
    throw new Error("AI response parsing failed");
  }
}

function sanitizeFileToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function extractResumeTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".pdf")) {
    return await extractTextFromPdf(buffer);
  }
  if (name.endsWith(".docx") || name.endsWith(".doc")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  return buffer.toString("utf-8");
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("plan, plan_expiry, usage_count")
      .eq("id", user.id)
      .single();

    if (!profileData) {
      return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });
    }

    const isPaid = profileData.plan && profileData.plan !== "free";
    const isExpired = isPaid && profileData.plan_expiry && new Date(profileData.plan_expiry) < new Date();
    if (isExpired) {
      await supabase.from("profiles").update({ plan: "free", plan_expiry: null }).eq("id", user.id);
      profileData.plan = "free";
    }

    if ((!profileData.plan || profileData.plan === "free") && (profileData.usage_count || 0) >= 5) {
      return NextResponse.json({ success: false, error: "limit_reached" }, { status: 403 });
    }

    const formData = await req.formData();
    const jobDescription = String(formData.get("jobDescription") || "").trim();
    const pastedResume = String(formData.get("resumeText") || "").trim();
    const resumeFile = formData.get("resumeFile") as File | null;

    if (!jobDescription) {
      return NextResponse.json({ success: false, error: "Job description is required" }, { status: 400 });
    }

    let resumeFromFile = "";
    if (resumeFile && resumeFile.size > 0) {
      resumeFromFile = await extractResumeTextFromFile(resumeFile);
    }
    const combinedResume = [pastedResume, resumeFromFile].filter(Boolean).join("\n\n").trim();

    if (!combinedResume) {
      return NextResponse.json({ success: false, error: "Resume text or file is required" }, { status: 400 });
    }

    const prompt = `You are an expert technical resume writer.
Create a single ATS-friendly tailored resume from:
1) Existing resume data
2) Target job description

Rules:
- Do not invent fake employment or credentials.
- Improve phrasing and impact using only provided evidence.
- Keep bullet points concise and action-oriented.
- Optimize for ATS keywords from the job description.
- Return only valid JSON. No markdown.

Job Description:
${jobDescription.substring(0, 8000)}

Existing Resume:
${combinedResume.substring(0, 12000)}

Return this exact schema:
{
  "full_name": "string",
  "headline": "string",
  "summary": "string",
  "contact": {
    "email": "string",
    "phone": "string",
    "location": "string",
    "linkedin": "string",
    "portfolio": "string"
  },
  "skills": ["string"],
  "experience": [
    {
      "role": "string",
      "company": "string",
      "location": "string",
      "start_date": "string",
      "end_date": "string",
      "bullets": ["string"]
    }
  ],
  "projects": [
    {
      "name": "string",
      "tech": "string",
      "bullets": ["string"]
    }
  ],
  "education": [
    {
      "degree": "string",
      "institution": "string",
      "location": "string",
      "year": "string"
    }
  ],
  "certifications": ["string"]
}`;

    const raw = await callGroq(prompt, 5000);
    const tailoredResume = parseAiJson(raw);
    const pdfBuffer = buildResumePdf(tailoredResume);

    await supabase
      .from("profiles")
      .update({ usage_count: (profileData.usage_count || 0) + 1 })
      .eq("id", user.id);

    const baseName = sanitizeFileToken(tailoredResume.full_name || "tailored-resume") || "tailored-resume";
    const filename = `${baseName}-job-matched-resume.pdf`;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
