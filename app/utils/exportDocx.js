import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  Header,
  Footer,
  PageNumber,
  TableOfContents,
  ExternalHyperlink,
  BorderStyle,
  LevelFormat,
  TabStopType,
  TabStopPosition,
} from "docx";
import { marked } from "marked";

// ── DESIGN TOKENS ──
const TERRACOTTA = "D4764E";
const GRAY = "6B7280";
const GRAY_BORDER = "D1D5DB";
const DARK = "111827";
const LINK_COLOR = "0563C1";

const BODY_FONT = "Calibri";
const MONO_FONT = "Consolas";

// docx font sizes are in half-points
const SIZE_BODY = 22; // 11pt
const SIZE_SMALL = 20; // 10pt
const SIZE_HEADER = 18; // 9pt
const SIZE_META = 28; // 14pt
const SIZE_SECTION_TITLE = 40; // 20pt
const SIZE_TOC_HEADING = 36; // 18pt
const SIZE_COVER_TITLE = 64; // 32pt
const SIZE_H2 = 32; // 16pt
const SIZE_H3 = 26; // 13pt

// 1.15 line spacing in docx is 276 (240 = single, 276 ≈ 1.15)
const LINE_115 = 276;

const SECTION_ORDER = [
  { key: "executive_summary", label: "Executive Summary" },
  { key: "technical_response", label: "Technical Response" },
  { key: "compliance_matrix", label: "Compliance Matrix" },
  { key: "methodology", label: "Methodology" },
  { key: "team_structure", label: "Team Structure" },
  { key: "risk_mitigation", label: "Risk Mitigation" },
];

function safeFilename(title) {
  if (!title) return "Untitled";
  let s = String(title).replace(/[^A-Za-z0-9_-]+/g, "_");
  s = s.replace(/_+/g, "_").replace(/^_|_$/g, "");
  if (!s) s = "Untitled";
  return s.slice(0, 50);
}

function formatDate(d = new Date()) {
  const month = d.toLocaleString("en-US", { month: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  return `${day} ${month} ${d.getFullYear()}`;
}

function truncate(s, n) {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

// ── INLINE TOKEN → TEXTRUN[] ──
// Recursively walks marked inline tokens, propagating bold/italic/strike state.
function inlineTokensToRuns(tokens, runOpts = {}) {
  const opts = { font: BODY_FONT, size: SIZE_BODY, ...runOpts };
  const out = [];
  for (const t of tokens || []) {
    if (!t) continue;
    switch (t.type) {
      case "strong":
        out.push(...inlineTokensToRuns(t.tokens, { ...opts, bold: true }));
        break;
      case "em":
        out.push(...inlineTokensToRuns(t.tokens, { ...opts, italics: true }));
        break;
      case "del":
        out.push(...inlineTokensToRuns(t.tokens, { ...opts, strike: true }));
        break;
      case "codespan":
        out.push(new TextRun({ ...opts, font: MONO_FONT, text: t.text }));
        break;
      case "br":
        out.push(new TextRun({ ...opts, break: 1 }));
        break;
      case "link":
        out.push(
          new ExternalHyperlink({
            link: t.href,
            children: [
              new TextRun({
                ...opts,
                color: LINK_COLOR,
                underline: {},
                text: t.text || t.href,
              }),
            ],
          })
        );
        break;
      case "text":
        if (t.tokens) out.push(...inlineTokensToRuns(t.tokens, opts));
        else if (t.text) out.push(new TextRun({ ...opts, text: t.text }));
        break;
      case "escape":
        out.push(new TextRun({ ...opts, text: t.text }));
        break;
      default:
        if (t.tokens) out.push(...inlineTokensToRuns(t.tokens, opts));
        else if (t.text) out.push(new TextRun({ ...opts, text: t.text }));
    }
  }
  return out;
}

// ── BLOCK TOKEN → PARAGRAPH[] ──
function tokensToBlocks(tokens, ctx) {
  const blocks = [];
  for (const tok of tokens || []) {
    if (!tok) continue;

    if (tok.type === "heading") {
      const depth = tok.depth || 2;
      let headingLevel;
      let size;
      if (depth <= 2) {
        headingLevel = HeadingLevel.HEADING_2;
        size = SIZE_H2;
      } else if (depth === 3) {
        headingLevel = HeadingLevel.HEADING_3;
        size = SIZE_H3;
      } else {
        headingLevel = HeadingLevel.HEADING_4;
        size = SIZE_H3;
      }
      blocks.push(
        new Paragraph({
          heading: headingLevel,
          spacing: { before: 240, after: 120 },
          children: inlineTokensToRuns(tok.tokens || [], {
            font: BODY_FONT,
            size,
            bold: true,
            color: DARK,
          }),
        })
      );
    } else if (tok.type === "paragraph") {
      blocks.push(
        new Paragraph({
          spacing: { line: LINE_115, after: 160 },
          alignment: AlignmentType.JUSTIFIED,
          children: inlineTokensToRuns(tok.tokens || []),
        })
      );
    } else if (tok.type === "list") {
      const ordered = !!tok.ordered;
      const ref = ordered ? ctx.makeOrderedRef() : null;
      for (const item of tok.items || []) {
        const itemRuns = [];
        for (const sub of item.tokens || []) {
          if (sub.type === "text") {
            if (sub.tokens) itemRuns.push(...inlineTokensToRuns(sub.tokens));
            else if (sub.text)
              itemRuns.push(
                new TextRun({ font: BODY_FONT, size: SIZE_BODY, text: sub.text })
              );
          } else if (sub.type === "paragraph") {
            if (itemRuns.length) itemRuns.push(new TextRun({ break: 1 }));
            itemRuns.push(...inlineTokensToRuns(sub.tokens || []));
          }
          // nested lists/blocks not rendered in v1 — flat list is the common case
        }
        blocks.push(
          new Paragraph({
            spacing: { line: LINE_115, after: 80 },
            children: itemRuns,
            ...(ordered
              ? { numbering: { reference: ref, level: 0 } }
              : { bullet: { level: 0 } }),
          })
        );
      }
    } else if (tok.type === "code") {
      const lines = (tok.text || "").split("\n");
      for (const line of lines) {
        blocks.push(
          new Paragraph({
            spacing: { line: 240, after: 0 },
            shading: { type: "clear", color: "auto", fill: "F3F4F6" },
            children: [
              new TextRun({ font: MONO_FONT, size: SIZE_SMALL, text: line || " " }),
            ],
          })
        );
      }
      blocks.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    } else if (tok.type === "blockquote") {
      for (const inner of tok.tokens || []) {
        if (inner.type === "paragraph") {
          blocks.push(
            new Paragraph({
              spacing: { line: LINE_115, after: 160 },
              indent: { left: 720 },
              children: inlineTokensToRuns(inner.tokens || [], {
                italics: true,
                color: GRAY,
                font: BODY_FONT,
                size: SIZE_BODY,
              }),
            })
          );
        }
      }
    } else if (tok.type === "hr") {
      blocks.push(
        new Paragraph({
          children: [],
          border: {
            bottom: { color: GRAY_BORDER, space: 1, style: BorderStyle.SINGLE, size: 6 },
          },
          spacing: { before: 120, after: 240 },
        })
      );
    } else if (tok.type === "space") {
      // skip
    } else if (tok.tokens) {
      blocks.push(...tokensToBlocks(tok.tokens, ctx));
    }
  }
  return blocks;
}

function markdownToBlocks(md, ctx) {
  if (!md) return [];
  let tokens;
  try {
    tokens = marked.lexer(md);
  } catch {
    return [
      new Paragraph({
        spacing: { line: LINE_115, after: 160 },
        alignment: AlignmentType.JUSTIFIED,
        children: [new TextRun({ font: BODY_FONT, size: SIZE_BODY, text: md })],
      }),
    ];
  }
  return tokensToBlocks(tokens, ctx);
}

// ── COVER PAGE ──
function buildCover({ tenderTitle, tenderReference, clientName, companyName }) {
  const blocks = [];

  // Title group, pushed ~2" down from top margin
  blocks.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 3000, after: 360 },
      children: [
        new TextRun({
          text: tenderTitle || "Untitled Tender",
          bold: true,
          size: SIZE_COVER_TITLE,
          font: BODY_FONT,
          color: DARK,
        }),
      ],
    })
  );

  if (tenderReference) {
    blocks.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: tenderReference,
            size: SIZE_META,
            font: BODY_FONT,
            color: GRAY,
          }),
        ],
      })
    );
  }

  if (clientName) {
    blocks.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: clientName,
            size: SIZE_META,
            font: BODY_FONT,
            color: GRAY,
          }),
        ],
      })
    );
  }

  // Bottom group, pushed ~3.3" further down
  blocks.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 4800, after: 80 },
      children: [
        new TextRun({
          text: companyName ? `Prepared by: ${companyName}` : "Prepared by:",
          size: SIZE_SMALL,
          font: BODY_FONT,
          color: GRAY,
        }),
      ],
    })
  );

  blocks.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: `Date: ${formatDate()}`,
          size: SIZE_SMALL,
          font: BODY_FONT,
          color: GRAY,
        }),
      ],
    })
  );

  blocks.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 0 },
      children: [
        new TextRun({
          text: "Generated by Bidlyze",
          size: SIZE_SMALL,
          font: BODY_FONT,
          color: GRAY,
        }),
      ],
    })
  );

  return blocks;
}

// ── HEADER / FOOTER ──
function buildHeader({ tenderTitle, companyName }) {
  return new Header({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        border: {
          bottom: { color: GRAY_BORDER, space: 4, style: BorderStyle.SINGLE, size: 4 },
        },
        children: [
          new TextRun({
            text: truncate(tenderTitle || "", 60),
            font: BODY_FONT,
            size: SIZE_HEADER,
            color: GRAY,
          }),
          new TextRun({
            text: "\t" + (companyName || ""),
            font: BODY_FONT,
            size: SIZE_HEADER,
            color: GRAY,
          }),
        ],
      }),
    ],
  });
}

function buildFooter({ tenderReference }) {
  const runOpts = { font: BODY_FONT, size: SIZE_HEADER, color: GRAY };
  return new Footer({
    children: [
      new Paragraph({
        tabStops: [
          { type: TabStopType.CENTER, position: TabStopPosition.MAX / 2 },
          { type: TabStopType.RIGHT, position: TabStopPosition.MAX },
        ],
        children: [
          new TextRun({ ...runOpts, text: tenderReference || "" }),
          new TextRun({ ...runOpts, text: "\tPage " }),
          new TextRun({ ...runOpts, children: [PageNumber.CURRENT] }),
          new TextRun({ ...runOpts, text: " of " }),
          new TextRun({ ...runOpts, children: [PageNumber.TOTAL_PAGES] }),
          new TextRun({ ...runOpts, text: "\tGenerated by Bidlyze" }),
        ],
      }),
    ],
  });
}

// ── MAIN ──
export async function exportProposalToDocx(data) {
  const {
    tenderTitle = "Untitled Tender",
    tenderReference = "",
    clientName = "",
    companyName = "",
    sections: rawSections = [],
  } = data || {};

  // Filter to canonical order, drop empty sections
  const provided = new Map((rawSections || []).map((s) => [s.key, s]));
  const orderedSections = SECTION_ORDER.map((meta) => {
    const s = provided.get(meta.key);
    if (!s || !s.content || !String(s.content).trim()) return null;
    return { key: meta.key, label: meta.label, content: s.content };
  }).filter(Boolean);

  if (orderedSections.length === 0) {
    throw new Error("No proposal sections to export.");
  }

  // Per-export numbering refs so each ordered list restarts at 1
  const numberingConfigs = [];
  let listCounter = 0;
  const ctx = {
    makeOrderedRef() {
      const ref = `ordered-${listCounter++}`;
      numberingConfigs.push({
        reference: ref,
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
          {
            level: 1,
            format: LevelFormat.LOWER_LETTER,
            text: "%2.",
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 1440, hanging: 360 } } },
          },
        ],
      });
      return ref;
    },
  };

  const cover = buildCover({ tenderTitle, tenderReference, clientName, companyName });

  const tocBlocks = [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      spacing: { after: 360 },
      children: [
        new TextRun({
          text: "Table of Contents",
          bold: true,
          size: SIZE_TOC_HEADING,
          font: BODY_FONT,
          color: DARK,
        }),
      ],
    }),
    new TableOfContents("Table of Contents", {
      hyperlink: true,
      headingStyleRange: "1-2",
    }),
  ];

  const sectionBlocks = [];
  orderedSections.forEach((s) => {
    sectionBlocks.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        spacing: { after: 360 },
        children: [
          new TextRun({
            text: s.label,
            bold: true,
            size: SIZE_SECTION_TITLE,
            font: BODY_FONT,
            color: TERRACOTTA,
          }),
        ],
      })
    );
    sectionBlocks.push(...markdownToBlocks(s.content, ctx));
  });

  const docOpts = {
    creator: "Bidlyze",
    title: tenderTitle || "Bidlyze Proposal",
    description: "Generated by Bidlyze",
    styles: {
      default: {
        document: {
          run: { font: BODY_FONT, size: SIZE_BODY, color: DARK },
        },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
          titlePage: true,
        },
        headers: {
          default: buildHeader({ tenderTitle, companyName }),
          first: new Header({ children: [new Paragraph({})] }),
        },
        footers: {
          default: buildFooter({ tenderReference }),
          first: new Footer({ children: [new Paragraph({})] }),
        },
        children: [...cover, ...tocBlocks, ...sectionBlocks],
      },
    ],
  };

  if (numberingConfigs.length > 0) {
    docOpts.numbering = { config: numberingConfigs };
  }

  const doc = new Document(docOpts);
  const blob = await Packer.toBlob(doc);

  const filename = `Bidlyze_Proposal_${safeFilename(tenderTitle)}_${new Date()
    .toISOString()
    .slice(0, 10)}.docx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return filename;
}
