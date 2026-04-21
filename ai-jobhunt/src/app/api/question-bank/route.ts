import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callGroq } from "@/lib/groq";
import { extractTextFromPdf } from "@/lib/pdf";
import { buildQuestionBankPdf, type QuestionBank } from "@/lib/questionBankPdf";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require("mammoth");

function parseAiJson(raw: string): QuestionBank {
  const cleaned = raw.replace(/```json|```/gi, "").trim();
  try {
    return JSON.parse(cleaned) as QuestionBank;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as QuestionBank;
    }
    throw new Error("AI response parsing failed");
  }
}

function sanitizeFileToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
}

function normalizeQuestionCount(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(50, Math.max(12, Math.round(parsed)));
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
    const company = String(formData.get("company") || "").trim();
    const role = String(formData.get("role") || "").trim();
    const jobDescription = String(formData.get("jobDescription") || "").trim();
    const pastedResume = String(formData.get("resumeText") || "").trim();
    const resumeFile = formData.get("resumeFile") as File | null;
    const questionCount = normalizeQuestionCount(formData.get("questionCount"));

    if (!jobDescription) {
      return NextResponse.json({ success: false, error: "Job description is required" }, { status: 400 });
    }

    let resumeFromFile = "";
    if (resumeFile && resumeFile.size > 0) {
      resumeFromFile = await extractResumeTextFromFile(resumeFile);
    }
    const resumeContent = [pastedResume, resumeFromFile].filter(Boolean).join("\n\n").trim();
    if (!resumeContent) {
      return NextResponse.json({ success: false, error: "Resume text or file is required" }, { status: 400 });
    }

    const prompt = `You are an elite interview prep architect.
Generate a high-density last-minute study "Question Bank" tailored for this candidate.

Inputs:
- Company: ${company || "Not specified"}
- Role: ${role || "Not specified"}
- Job Description:
${jobDescription.substring(0, 9000)}

- Candidate Resume:
${resumeContent.substring(0, 12000)}

Hard requirements:
1) Generate exactly ${questionCount} questions.
2) Mix interview + exam-style prep:
   - Technical fundamentals
   - Resume deep-dive
   - Behavioral
   - Situational/scenario
   - Company-pattern questions (based on historically reported patterns if known)
   - Aptitude/problem-solving style where relevant
3) Every item must include:
   - question
   - concise strong answer
   - keywords to memorize quickly
   - one quick-recall line
   - one real-time practical example
4) Keep answers practical and easy to revise fast.
5) Do not fabricate confidential company data. If uncertain, provide likely patterns and mark as such.
6) Return only valid JSON, no markdown.

Return this exact schema:
{
  "title": "string",
  "company": "string",
  "role": "string",
  "revision_keywords": ["string"],
  "questions": [
    {
      "id": 1,
      "category": "Technical Fundamentals | Resume Deep Dive | Behavioral | Situational | Company Pattern | Aptitude",
      "difficulty": "Easy | Medium | Hard",
      "source": "JD Match | Resume Match | Company Pattern | Mixed",
      "question": "string",
      "answer": "string",
      "keywords": ["string", "string"],
      "quick_recall": "string",
      "realtime_example": "string"
    }
  ]
}`;

    const raw = await callGroq(prompt, 6500);
    const bank = parseAiJson(raw);

    if (!Array.isArray(bank.questions) || bank.questions.length === 0) {
      throw new Error("AI returned empty question bank");
    }

    const normalizedQuestions = bank.questions.slice(0, questionCount).map((item, index) => ({
      ...item,
      id: item.id || index + 1,
    }));

    const normalizedBank: QuestionBank = {
      title: bank.title || "Last-Minute Interview and Exam Question Bank",
      company: bank.company || company || "Target Company",
      role: bank.role || role || "Target Role",
      revision_keywords: Array.isArray(bank.revision_keywords) ? bank.revision_keywords : [],
      questions: normalizedQuestions,
    };

    const pdfBuffer = buildQuestionBankPdf(normalizedBank);
    const pdfBase64 = pdfBuffer.toString("base64");

    await supabase
      .from("profiles")
      .update({ usage_count: (profileData.usage_count || 0) + 1 })
      .eq("id", user.id);

    const companyToken = sanitizeFileToken(normalizedBank.company || "company");
    const roleToken = sanitizeFileToken(normalizedBank.role || "role");
    const filename = `${companyToken}-${roleToken}-question-bank.pdf`;

    return NextResponse.json({
      success: true,
      bank: normalizedBank,
      filename,
      pdfBase64,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
