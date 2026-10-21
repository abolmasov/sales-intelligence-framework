/**
 * RFP Response Document Generator
 *
 * Converts RFP Q&A research results into a downloadable Word (.docx) document
 * formatted as a professional proposal response.
 *
 * Sections:
 *   Cover / metadata
 *   Executive Summary (rfpSummary)
 *   Q&A by category — each question as a numbered heading, answer as body text,
 *   sources as a compact footnote block
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  TableOfContents,
  PageBreak,
  Tab,
} from 'docx';

export interface RFPDocxQuestion {
  id: string;
  questionText: string;
  category: string;
  section?: string;
}

export interface RFPDocxAnswer {
  questionId: string;
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  sources: { title: string; url?: string; excerpt?: string }[];
}

export interface RFPDocxInput {
  companyName?: string;
  rfpSummary: string;
  questions: RFPDocxQuestion[];
  answers: RFPDocxAnswer[];
  generatedBy?: string;
  generatedAt?: Date;
}

const CATEGORY_ORDER = ['technical', 'business', 'compliance', 'timeline', 'pricing', 'general'];

const CATEGORY_LABELS: Record<string, string> = {
  technical: 'Technical Requirements',
  business: 'Business Requirements',
  compliance: 'Compliance & Governance',
  timeline: 'Timeline & Milestones',
  pricing: 'Pricing & Commercial',
  general: 'General Requirements',
};

function confidenceBadge(c: 'high' | 'medium' | 'low'): string {
  return c === 'high' ? '● High' : c === 'medium' ? '◑ Medium' : '○ Low';
}

function categoryHeading(category: string): Paragraph {
  return new Paragraph({
    text: CATEGORY_LABELS[category] ?? category,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: '2563EB', space: 4 },
    },
  });
}

function questionHeading(index: number, text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${index}. `, bold: true, size: 24 }),
      new TextRun({ text, bold: true, size: 24 }),
    ],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 100 },
  });
}

function answerParagraphs(answer: string): Paragraph[] {
  return answer
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        new Paragraph({
          children: [new TextRun({ text: block, size: 22 })],
          spacing: { after: 160 },
          alignment: AlignmentType.JUSTIFIED,
        })
    );
}

function sourcesBlock(
  sources: { title: string; url?: string; excerpt?: string }[],
  confidence: 'high' | 'medium' | 'low'
): Paragraph[] {
  if (!sources.length) return [];

  const paras: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({ text: `Sources  ${confidenceBadge(confidence)}`, italics: true, size: 18, color: '64748B' }),
      ],
      spacing: { before: 80, after: 40 },
    }),
  ];

  for (const src of sources) {
    paras.push(
      new Paragraph({
        children: [
          new TextRun({ text: `• ${src.title}`, size: 18, color: '475569' }),
          ...(src.url ? [new TextRun({ text: `  ${src.url}`, size: 16, color: '2563EB' })] : []),
        ],
        spacing: { after: 40 },
        indent: { left: 360 },
      })
    );
  }

  return paras;
}

function divider(): Paragraph {
  return new Paragraph({
    text: '',
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0', space: 2 } },
    spacing: { before: 40, after: 40 },
  });
}

export async function generateRFPResponseDocx(input: RFPDocxInput): Promise<Buffer> {
  const {
    companyName,
    rfpSummary,
    questions,
    answers,
    generatedBy = 'Northstar Integrators Sales Intelligence',
    generatedAt = new Date(),
  } = input;

  const answerMap = new Map(answers.map((a) => [a.questionId, a]));

  // Group questions by category in defined order
  const grouped = new Map<string, RFPDocxQuestion[]>();
  for (const cat of CATEGORY_ORDER) grouped.set(cat, []);
  for (const q of questions) {
    const cat = q.category in CATEGORY_LABELS ? q.category : 'general';
    grouped.get(cat)!.push(q);
  }

  const children: Paragraph[] = [];

  // ── Cover ──────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'RFP Response', bold: true, size: 52 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 1200, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: companyName ? `Prepared for: ${companyName}` : 'Proposal Response',
          size: 28,
          color: '475569',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Prepared by: ${generatedBy}  ·  ${generatedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
          size: 22,
          color: '94A3B8',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
    new Paragraph({ children: [new PageBreak()] })
  );

  // ── Executive Summary ──────────────────────────────────────────────────
  children.push(
    new Paragraph({
      text: 'Executive Summary',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
    }),
    ...rfpSummary
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map(
        (block) =>
          new Paragraph({
            children: [new TextRun({ text: block, size: 22 })],
            spacing: { after: 160 },
            alignment: AlignmentType.JUSTIFIED,
          })
      ),
    new Paragraph({
      children: [
        new TextRun({
          text: `This document contains ${questions.length} responses across ${
            [...grouped.entries()].filter(([, qs]) => qs.length > 0).length
          } categories.`,
          size: 20,
          italics: true,
          color: '64748B',
        }),
      ],
      spacing: { after: 400 },
    }),
    new Paragraph({ children: [new PageBreak()] })
  );

  // ── Q&A by category ────────────────────────────────────────────────────
  let globalIndex = 1;

  for (const cat of CATEGORY_ORDER) {
    const qs = grouped.get(cat) ?? [];
    if (!qs.length) continue;

    children.push(categoryHeading(cat));

    for (const q of qs) {
      const ans = answerMap.get(q.id);

      children.push(questionHeading(globalIndex++, q.questionText));

      if (q.section) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `Section: ${q.section}`, italics: true, size: 18, color: '94A3B8' })],
            spacing: { after: 80 },
          })
        );
      }

      if (ans) {
        children.push(...answerParagraphs(ans.answer));
        children.push(...sourcesBlock(ans.sources, ans.confidence));
      } else {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: 'No response generated.', italics: true, color: '94A3B8', size: 20 })],
            spacing: { after: 160 },
          })
        );
      }

      children.push(divider());
    }
  }

  // ── Document ───────────────────────────────────────────────────────────
  const doc = new Document({
    creator: generatedBy,
    title: companyName ? `RFP Response — ${companyName}` : 'RFP Response',
    description: rfpSummary.substring(0, 300),
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
          },
        },
        children,
      },
    ],
    styles: {
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          run: { bold: true, size: 32, color: '171717' },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          run: { bold: true, size: 24, color: '1E293B' },
        },
      ],
    },
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
