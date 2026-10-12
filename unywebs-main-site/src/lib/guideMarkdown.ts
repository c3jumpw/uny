// Extra formatting for guide articles, on top of standard markdown.
//
// Guides are written for busy owners skimming on a phone, so a wall of
// paragraphs loses them. These conventions let an editor break a page up
// without writing HTML, and every one of them still reads sensibly as
// plain markdown if it is ever rendered somewhere else.
//
//   > [!TIP] Optional title        A coloured callout box with an icon.
//   > Body text...                 Kinds: tip, info, note, warning, success.
//
//   - :phone: **Calls.** Text      A list where every item starts with an
//   - :inbox: **Inbox.** Text      icon name becomes a grid of icon cards.
//
//   ![Alt text](/media/x.svg "Caption")   An image on its own line becomes
//                                          a figure, the title its caption.
//
//   [Start free](https://... "button")     A link titled "button" (or
//                                          "button-outline") is a button.
//
// Numbered lists at the top level are styled as step cards in CSS.
//
// The same file lives in unywebs-admin/src/lib/guideMarkdown.ts so the
// editor's preview matches the live page. Change both together.

import type {
  Blockquote,
  Emphasis,
  Image,
  List,
  ListItem,
  Paragraph,
  Root,
} from "mdast";
import { visit } from "unist-util-visit";

export const CALLOUT_KINDS = ["tip", "info", "note", "warning", "success"] as const;
export type CalloutKind = (typeof CALLOUT_KINDS)[number];

export const CALLOUT_LABELS: Record<CalloutKind, string> = {
  tip: "Tip",
  info: "At a glance",
  note: "Good to know",
  warning: "Heads up",
  success: "You're set",
};

const CALLOUT_RE = /^\[!(tip|info|note|warning|success)\][ \t]*([^\n]*)\n?/i;
const ICON_RE = /^:([a-z0-9-]+):[ \t]*/;

function leadingIcon(item: ListItem): string | null {
  const first = item.children[0];
  if (!first || first.type !== "paragraph") return null;
  const text = first.children[0];
  if (!text || text.type !== "text") return null;
  const m = ICON_RE.exec(text.value);
  return m ? m[1] : null;
}

function stripLeadingIcon(item: ListItem) {
  const first = item.children[0] as Paragraph;
  const text = first.children[0];
  if (text.type !== "text") return;
  text.value = text.value.replace(ICON_RE, "");
  if (!text.value) first.children.shift();
}

export function remarkGuide() {
  return (tree: Root) => {
    // Callouts. GitHub's alert syntax, so editors who know it already
    // know this, plus an optional title on the marker line.
    visit(tree, "blockquote", (node: Blockquote) => {
      const first = node.children[0];
      if (!first || first.type !== "paragraph") return;
      const text = first.children[0];
      if (!text || text.type !== "text") return;
      const m = CALLOUT_RE.exec(text.value);
      if (!m) return;

      const kind = m[1].toLowerCase() as CalloutKind;
      const title = m[2].trim();
      text.value = text.value.slice(m[0].length);
      if (!text.value) first.children.shift();
      if (first.children.length === 0) node.children.shift();

      node.data = {
        hName: "aside",
        hProperties: {
          className: ["callout", `callout-${kind}`],
          dataKind: kind,
          ...(title ? { dataTitle: title } : {}),
        },
      };
    });

    // Icon lists. An item opts in by starting with :name:. When every
    // item does, the list is laid out as a grid of cards.
    visit(tree, "list", (node: List) => {
      const icons = node.children.map(leadingIcon);
      if (!icons.some(Boolean)) return;
      node.children.forEach((item, i) => {
        const icon = icons[i];
        if (!icon) return;
        stripLeadingIcon(item);
        item.data = { ...(item.data ?? {}), hProperties: { dataIcon: icon } };
      });
      if (icons.every(Boolean)) {
        node.data = {
          ...(node.data ?? {}),
          hProperties: { className: ["icon-list"] },
        };
      }
    });

    // Figures. A paragraph holding only an image is a figure, and the
    // image's title, if any, is shown underneath as its caption.
    visit(tree, "paragraph", (node: Paragraph) => {
      if (node.children.length !== 1) return;
      const only = node.children[0];
      if (only.type !== "image") return;
      const img = only as Image;
      node.data = { ...(node.data ?? {}), hName: "figure" };
      if (img.title) {
        const caption: Emphasis = {
          type: "emphasis",
          data: { hName: "figcaption" },
          children: [{ type: "text", value: img.title }],
        };
        img.title = null;
        node.children.push(caption);
      }
    });
  };
}

/** Rough reading time at 200 words a minute, never less than one. */
export function readingMinutes(markdown: string): number {
  const words = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/[#>*_`[\]:|-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
