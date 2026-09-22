import type { ReactNode } from "react";

/**
 * Renders one legal document's plain text as a laid-out page.
 *
 * The public legal pages used to dump the whole document into a single
 * `white-space: pre-wrap` div, so every section heading, every sub-heading and
 * every bullet rendered at exactly the same size and weight as body copy —
 * fourteen sections of undifferentiated grey text (owner report 2026-09-21).
 * The text itself is unchanged here; only its presentation is.
 *
 * The line grammar is the mobile app's (TheraHOME-APP/src/components/
 * LegalDocBody.tsx), so the same document reads the same way on both:
 *   line 0        the document title
 *   line 1        a subtitle
 *   line 2        a small muted line (the "last updated" date)
 *   line 3        a callout — ONLY when it is not itself a heading
 *   "N. ..."      a top-level section heading
 *   "N.M ..."     a sub-heading
 *   tab or "•"    a bullet
 *   anything else a paragraph; blank lines are spacing and are dropped
 *
 * Two deliberate differences from the app's parser, both bugs there:
 *   - the app treats line 3 as a callout unconditionally, but only the
 *     community document has one; in terms/privacy/security line 3 is
 *     "1. ..." and gets boxed by mistake.
 *   - the app's heading pattern requires a dot before the space, so "2.1 Dữ
 *     liệu bạn cung cấp trực tiếp" falls through to a plain paragraph.
 */

/** "1. " or "2.1 " — the trailing dot OR the sub-number is required, so a
 * paragraph that merely opens with a year ("2026 là ...") is not a heading. */
const SECTION_RE = /^(\d+)\.(?:(\d+)\s|\s)/;

type Block =
  | { kind: "title"; text: string }
  | { kind: "subtitle"; text: string }
  | { kind: "date"; text: string }
  | { kind: "callout"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] };

function parse(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.split("\n");

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;

    const heading = SECTION_RE.exec(line);

    if (i === 0) return void blocks.push({ kind: "title", text: line });
    if (i === 1) return void blocks.push({ kind: "subtitle", text: line });
    if (i === 2) return void blocks.push({ kind: "date", text: line });
    if (i === 3 && !heading) return void blocks.push({ kind: "callout", text: line });

    if (heading) {
      return void blocks.push({ kind: heading[2] ? "h3" : "h2", text: line });
    }

    if (raw.startsWith("\t") || line.startsWith("•")) {
      const item = line.replace(/^•\s*/, "");
      const last = blocks[blocks.length - 1];
      // Consecutive bullets belong to ONE list, otherwise each would be its
      // own <ul> and the browser would space them like separate blocks.
      if (last?.kind === "ul") last.items.push(item);
      else blocks.push({ kind: "ul", items: [item] });
      return;
    }

    blocks.push({ kind: "p", text: line });
  });

  return blocks;
}

const ink = "var(--text-primary, #16213a)";
const body = "var(--text-secondary, #59616d)";
const muted = "var(--text-muted, #6e7683)";

export function LegalDocBody({ text }: { text: string }): ReactNode {
  const blocks = parse(text);

  return (
    <>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "title":
            return (
              <h1 key={i} style={{ margin: 0, fontSize: "clamp(24px, 4vw, 30px)", fontWeight: 700, color: ink, textAlign: "center", letterSpacing: "-0.01em", lineHeight: 1.25 }}>
                {block.text}
              </h1>
            );
          case "subtitle":
            return (
              <p key={i} style={{ margin: "8px 0 0", fontSize: 15, fontWeight: 600, color: body, textAlign: "center" }}>
                {block.text}
              </p>
            );
          case "date":
            return (
              // The masthead closes here: the rule under the date is what
              // separates "what this document is" from the document itself.
              <p key={i} style={{ margin: "4px 0 28px", paddingBottom: 24, borderBottom: "1px solid var(--border-light, #e7ecf3)", fontSize: 13.5, color: muted, textAlign: "center" }}>
                {block.text}
              </p>
            );
          case "callout":
            return (
              <p key={i} style={{ margin: "0 0 24px", padding: "14px 16px", borderRadius: 12, background: "var(--bg-card-alt, #f6f8fc)", fontSize: 14.5, lineHeight: 1.7, color: body }}>
                {block.text}
              </p>
            );
          case "h2":
            return (
              <h2 key={i} style={{ margin: "32px 0 10px", fontSize: 18, fontWeight: 700, color: ink, letterSpacing: "-0.01em" }}>
                {block.text}
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} style={{ margin: "22px 0 8px", fontSize: 15.5, fontWeight: 700, color: ink }}>
                {block.text}
              </h3>
            );
          case "ul":
            return (
              <ul key={i} style={{ margin: "0 0 14px", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 7 }}>
                {block.items.map((item, j) => (
                  <li key={j} style={{ fontSize: 15.5, lineHeight: 1.7, color: body }}>
                    {item}
                  </li>
                ))}
              </ul>
            );
          default:
            return (
              <p key={i} style={{ margin: "0 0 14px", fontSize: 15.5, lineHeight: 1.75, color: body }}>
                {block.text}
              </p>
            );
        }
      })}
    </>
  );
}
