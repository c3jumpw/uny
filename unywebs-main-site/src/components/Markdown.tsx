import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  CircleCheck,
  Info,
  Lightbulb,
  PartyPopper,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import {
  CALLOUT_LABELS,
  remarkGuide,
  type CalloutKind,
} from "@/lib/guideMarkdown";
import { guideIcon } from "@/lib/guideIcons";

// Guide bodies are markdown written in the admin. Rendering happens on
// the server so the finished HTML is in the page for crawlers. That is
// the whole reason these articles are not fetched in the browser.
//
// remarkGuide (lib/guideMarkdown.ts) adds the extra building blocks the
// guides use to stay skimmable: callout boxes, icon lists, captioned
// figures and button links. The components below draw them.
//
// Link rules, both about not lying to the reader: anything pointing
// off-site opens in a new tab with rel="noopener", and internal links
// behave normally. Tables get their own scroll container so a wide one
// never widens the page.
//
// Every override destructures `node` away before spreading the rest onto
// the element. react-markdown hands each component its own syntax-tree
// node under that name; spreading it through reaches the DOM as
// node="[object Object]", which is invalid markup.

const CALLOUT_ICONS: Record<CalloutKind, LucideIcon> = {
  tip: Lightbulb,
  info: Info,
  note: CircleCheck,
  warning: TriangleAlert,
  success: PartyPopper,
};

type HastProps = { properties?: Record<string, unknown> } | undefined;

function prop(node: unknown, name: string): string | undefined {
  const value = (node as HastProps)?.properties?.[name];
  return typeof value === "string" ? value : undefined;
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkGuide]}
        components={{
          a({ node: _node, href, title, children, ...props }) {
            const url = href ?? "";
            const external = /^https?:\/\//i.test(url);
            const button =
              title === "button" ? "btn" : title === "button-outline" ? "btn outline" : null;
            return (
              <a
                href={url}
                className={button ?? undefined}
                title={button ? undefined : title}
                {...(external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                {...props}
              >
                {children}
                {button && <span className="arrow" aria-hidden="true"> &rarr;</span>}
              </a>
            );
          },
          img({ node: _node, src, alt, ...props }) {
            if (!src || typeof src !== "string") return null;
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={alt ?? ""} loading="lazy" decoding="async" {...props} />
            );
          },
          table({ node: _node, children, ...props }) {
            return (
              <div className="table-scroll">
                <table {...props}>{children}</table>
              </div>
            );
          },
          aside({ node, children, className }) {
            const kind = (prop(node, "dataKind") ?? "note") as CalloutKind;
            const Icon = CALLOUT_ICONS[kind] ?? Info;
            const title = prop(node, "dataTitle") ?? CALLOUT_LABELS[kind];
            return (
              <aside className={className} role="note">
                <p className="callout-title">
                  <Icon aria-hidden="true" size={18} strokeWidth={2.2} />
                  <span>{title}</span>
                </p>
                <div className="callout-body">{children}</div>
              </aside>
            );
          },
          li({ node, children, className }) {
            const icon = prop(node, "dataIcon");
            if (!icon) return <li className={className}>{children}</li>;
            const Icon = guideIcon(icon);
            return (
              <li className="icon-item">
                <span className="icon-bubble" aria-hidden="true">
                  <Icon size={20} strokeWidth={2} />
                </span>
                <div className="icon-item-body">{children}</div>
              </li>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
