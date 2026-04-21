type ResumeExperience = {
  role?: string;
  company?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  bullets?: string[];
};

type ResumeProject = {
  name?: string;
  tech?: string;
  bullets?: string[];
};

type ResumeEducation = {
  degree?: string;
  institution?: string;
  location?: string;
  year?: string;
};

export type TailoredResume = {
  full_name?: string;
  headline?: string;
  summary?: string;
  contact?: {
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    portfolio?: string;
  };
  skills?: string[];
  experience?: ResumeExperience[];
  projects?: ResumeProject[];
  education?: ResumeEducation[];
  certifications?: string[];
};

type LineBlock = {
  text: string;
  size?: number;
  bold?: boolean;
  indent?: number;
  gapAfter?: number;
};

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;

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
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function buildLineBlocks(data: TailoredResume): LineBlock[] {
  const blocks: LineBlock[] = [];
  const name = sanitizeText(data.full_name) || "Tailored Resume";
  const headline = sanitizeText(data.headline);
  const summary = sanitizeText(data.summary);

  const contactParts = [
    sanitizeText(data.contact?.email),
    sanitizeText(data.contact?.phone),
    sanitizeText(data.contact?.location),
    sanitizeText(data.contact?.linkedin),
    sanitizeText(data.contact?.portfolio),
  ].filter(Boolean);

  blocks.push({ text: name, size: 20, bold: true, gapAfter: 4 });
  if (headline) blocks.push({ text: headline, size: 12, gapAfter: 6 });
  if (contactParts.length) {
    blocks.push({ text: contactParts.join(" | "), size: 10, gapAfter: 12 });
  }

  if (summary) {
    blocks.push({ text: "PROFESSIONAL SUMMARY", size: 12, bold: true, gapAfter: 4 });
    blocks.push({ text: summary, size: 11, gapAfter: 10 });
  }

  if (data.skills?.length) {
    blocks.push({ text: "CORE SKILLS", size: 12, bold: true, gapAfter: 4 });
    blocks.push({
      text: data.skills.map((skill) => sanitizeText(skill)).filter(Boolean).join(", "),
      size: 11,
      gapAfter: 10,
    });
  }

  if (data.experience?.length) {
    blocks.push({ text: "EXPERIENCE", size: 12, bold: true, gapAfter: 4 });
    for (const item of data.experience) {
      const role = sanitizeText(item.role);
      const company = sanitizeText(item.company);
      const location = sanitizeText(item.location);
      const start = sanitizeText(item.start_date);
      const end = sanitizeText(item.end_date);
      const period = [start, end].filter(Boolean).join(" - ");
      const headingLeft = [role, company].filter(Boolean).join(" | ");
      const headingRight = [period, location].filter(Boolean).join(" | ");
      const heading = [headingLeft, headingRight].filter(Boolean).join("  ");
      if (heading) blocks.push({ text: heading, size: 11, bold: true, gapAfter: 2 });

      const bullets = item.bullets?.map((bullet) => sanitizeText(bullet)).filter(Boolean) || [];
      for (const bullet of bullets) {
        blocks.push({ text: `- ${bullet}`, size: 10.5, indent: 10, gapAfter: 2 });
      }
      blocks.push({ text: " ", size: 8, gapAfter: 2 });
    }
  }

  if (data.projects?.length) {
    blocks.push({ text: "PROJECTS", size: 12, bold: true, gapAfter: 4 });
    for (const project of data.projects) {
      const title = sanitizeText(project.name);
      const tech = sanitizeText(project.tech);
      const projectHeading = [title, tech ? `Tech: ${tech}` : ""].filter(Boolean).join(" | ");
      if (projectHeading) blocks.push({ text: projectHeading, size: 11, bold: true, gapAfter: 2 });
      const bullets = project.bullets?.map((bullet) => sanitizeText(bullet)).filter(Boolean) || [];
      for (const bullet of bullets) {
        blocks.push({ text: `- ${bullet}`, size: 10.5, indent: 10, gapAfter: 2 });
      }
      blocks.push({ text: " ", size: 8, gapAfter: 2 });
    }
  }

  if (data.education?.length) {
    blocks.push({ text: "EDUCATION", size: 12, bold: true, gapAfter: 4 });
    for (const edu of data.education) {
      const degree = sanitizeText(edu.degree);
      const institution = sanitizeText(edu.institution);
      const location = sanitizeText(edu.location);
      const year = sanitizeText(edu.year);
      const line = [degree, institution, location, year].filter(Boolean).join(" | ");
      if (line) blocks.push({ text: line, size: 10.5, gapAfter: 4 });
    }
  }

  if (data.certifications?.length) {
    blocks.push({ text: "CERTIFICATIONS", size: 12, bold: true, gapAfter: 4 });
    for (const cert of data.certifications.map((item) => sanitizeText(item)).filter(Boolean)) {
      blocks.push({ text: `- ${cert}`, size: 10.5, indent: 10, gapAfter: 2 });
    }
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
      commands.push(`BT /F2 14 Tf 1 0 0 1 ${MARGIN} ${PAGE_HEIGHT - MARGIN} Tm (Tailored Resume) Tj ET`);
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
    const maxChars = Math.max(30, Math.floor((usableWidth - indent) / (fontSize * 0.5)));
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

export function buildResumePdf(data: TailoredResume): Buffer {
  const blocks = buildLineBlocks(data);
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
