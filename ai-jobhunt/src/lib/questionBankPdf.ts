export type QuestionBankQuestion = {
  id?: number;
  category?: string;
  difficulty?: string;
  source?: string;
  question?: string;
  answer?: string;
  keywords?: string[];
  quick_recall?: string;
  realtime_example?: string;
};

export type QuestionBank = {
  title?: string;
  company?: string;
  role?: string;
  revision_keywords?: string[];
  questions?: QuestionBankQuestion[];
};

type LineBlock = {
  text: string;
  size?: number;
  bold?: boolean;
  indent?: number;
  gapAfter?: number;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 46;

function sanitizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

function wrapText(text: string, maxChars: number): string[] {
  const clean = sanitizeText(text);
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const words = clean.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length > maxChars) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

function buildLineBlocks(bank: QuestionBank): LineBlock[] {
  const blocks: LineBlock[] = [];
  const title = sanitizeText(bank.title) || "Interview Question Bank";
  const company = sanitizeText(bank.company);
  const role = sanitizeText(bank.role);
  const questions = bank.questions || [];

  blocks.push({ text: title, size: 20, bold: true, gapAfter: 4 });
  if (company || role) {
    blocks.push({
      text: [company ? `Company: ${company}` : "", role ? `Role: ${role}` : ""].filter(Boolean).join(" | "),
      size: 11,
      gapAfter: 8,
    });
  }
  blocks.push({ text: `Total Questions: ${questions.length}`, size: 10.5, gapAfter: 10 });

  const revisionKeywords = (bank.revision_keywords || []).map((item) => sanitizeText(item)).filter(Boolean);
  if (revisionKeywords.length) {
    blocks.push({ text: "LAST-MINUTE REVISION KEYWORDS", size: 12, bold: true, gapAfter: 4 });
    blocks.push({ text: revisionKeywords.join(", "), size: 10.5, gapAfter: 12 });
  }

  const byCategory = new Map<string, QuestionBankQuestion[]>();
  for (const question of questions) {
    const category = sanitizeText(question.category) || "General";
    const existing = byCategory.get(category) || [];
    existing.push(question);
    byCategory.set(category, existing);
  }

  let runningNumber = 1;
  for (const [category, items] of byCategory) {
    blocks.push({ text: category.toUpperCase(), size: 12, bold: true, gapAfter: 4 });

    for (const item of items) {
      const id = item.id || runningNumber;
      const questionLine = sanitizeText(item.question);
      const answerLine = sanitizeText(item.answer);
      const difficulty = sanitizeText(item.difficulty);
      const source = sanitizeText(item.source);
      const meta = [difficulty ? `Difficulty: ${difficulty}` : "", source ? `Source: ${source}` : ""]
        .filter(Boolean)
        .join(" | ");

      if (meta) blocks.push({ text: meta, size: 9.8, gapAfter: 2 });
      if (questionLine) blocks.push({ text: `Q${id}. ${questionLine}`, size: 11, bold: true, gapAfter: 2 });
      if (answerLine) blocks.push({ text: `Answer: ${answerLine}`, size: 10.5, indent: 8, gapAfter: 3 });

      const keywords = (item.keywords || []).map((k) => sanitizeText(k)).filter(Boolean);
      if (keywords.length) {
        blocks.push({ text: `Keywords: ${keywords.join(", ")}`, size: 10.2, indent: 8, gapAfter: 2 });
      }

      const recall = sanitizeText(item.quick_recall);
      if (recall) {
        blocks.push({ text: `Quick Recall: ${recall}`, size: 10.2, indent: 8, gapAfter: 2 });
      }

      const example = sanitizeText(item.realtime_example);
      if (example) {
        blocks.push({ text: `Real-Time Example: ${example}`, size: 10.2, indent: 8, gapAfter: 5 });
      }

      blocks.push({ text: " ", size: 8, gapAfter: 3 });
      runningNumber += 1;
    }
    blocks.push({ text: " ", size: 8, gapAfter: 6 });
  }

  return blocks;
}

function buildPageStreams(blocks: LineBlock[]): string[] {
  const streams: string[] = [];
  const usableWidth = PAGE_WIDTH - MARGIN * 2;
  let currentY = PAGE_HEIGHT - MARGIN;
  let commands: string[] = [];

  const pushPage = () => {
    if (!commands.length) {
      commands.push(`BT /F2 12 Tf 1 0 0 1 ${MARGIN} ${PAGE_HEIGHT - MARGIN} Tm (Interview Question Bank) Tj ET`);
    }
    streams.push(commands.join("\n"));
    commands = [];
    currentY = PAGE_HEIGHT - MARGIN;
  };

  for (const block of blocks) {
    const fontSize = block.size || 11;
    const isBold = Boolean(block.bold);
    const indent = block.indent || 0;
    const lineHeight = fontSize * 1.35;
    const maxChars = Math.max(28, Math.floor((usableWidth - indent) / (fontSize * 0.5)));
    const lines = wrapText(block.text, maxChars);

    for (const line of lines) {
      if (currentY - lineHeight < MARGIN) {
        pushPage();
      }
      const escaped = escapePdfText(line);
      const x = MARGIN + indent;
      commands.push(
        `BT /${isBold ? "F2" : "F1"} ${fontSize.toFixed(2)} Tf 1 0 0 1 ${x.toFixed(2)} ${currentY.toFixed(2)} Tm (${escaped}) Tj ET`
      );
      currentY -= lineHeight;
    }

    currentY -= block.gapAfter || 0;
  }

  if (commands.length || !streams.length) {
    pushPage();
  }

  return streams;
}

export function buildQuestionBankPdf(bank: QuestionBank): Buffer {
  const blocks = buildLineBlocks(bank);
  const pageStreams = buildPageStreams(blocks);

  const objects: string[] = [];
  const addObject = (value: string) => {
    objects.push(value);
    return objects.length;
  };

  const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const pageIds: number[] = [];
  for (const stream of pageStreams) {
    const streamLength = Buffer.byteLength(stream, "utf8");
    const contentId = addObject(`<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(2)}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  }

  const pagesId = addObject(
    `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`
  );

  for (const pageId of pageIds) {
    objects[pageId - 1] = objects[pageId - 1].replace("/Parent 0 0 R", `/Parent ${pagesId} 0 R`);
  }

  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let index = 0; index < objects.length; index++) {
    offsets[index + 1] = Buffer.byteLength(pdf, "utf8");
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index++) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}
