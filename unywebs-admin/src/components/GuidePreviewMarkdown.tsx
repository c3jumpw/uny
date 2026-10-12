"use client";

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
import { CALLOUT_LABELS, VIDEO_RE, remarkGuide, videoSrc, type CalloutKind } from "@/lib/guideMarkdown";
import { guideIcon } from "@/lib/guideIcons";
import { resolveAssetUrl } from "@/lib/shared";

// The editor's preview of a guide body. It draws the same building
// blocks as the live site's Markdown component (unywebs-main-site/
// src/components/Markdown.tsx) so an editor sees callouts, icon cards,
// steps and buttons exactly as readers will. Styles live under
// .guide-preview in globals.css.

const CALLOUT_ICONS: Record<CalloutKind, LucideIcon> = {
  tip: Lightbulb,
  info: Info,
  note: CircleCheck,
  warning: TriangleAlert,
  success: PartyPopper,
};

function prop(node: unknown, name: string): string | undefined {
  const value = (node as { properties?: Record<string, unknown> } | undefined)?.properties?.[name];
  return typeof value === "string" ? value : undefined;
}

export function GuidePreviewMarkdown({ body, siteBase }: { body: string; siteBase: string }) {
  return (
    <div className="gp-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkGuide]}
        components={{
          a({ node: _node, href, title, children, ...props }) {
            const button =
              title === "button" ? "gp-btn" : title === "button-outline" ? "gp-btn gp-btn-outline" : null;
            return (
              <a
                href={href}
                className={button ?? undefined}
                title={button ? undefined : title}
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              >
                {children}
                {button && <span aria-hidden="true"> &rarr;</span>}
              </a>
            );
          },
          // Guide images are stored as paths on the public site, so the
          // preview loads them from there.
          img({ node: _node, src, alt, ...props }) {
            const url = resolveAssetUrl(typeof src === "string" ? src : null, siteBase);
            if (!url) return null;
            if (VIDEO_RE.test(url)) {
              return (
                <video
                  className="guide-video"
                  src={videoSrc(url)}
                  controls
                  preload="metadata"
                  playsInline
                  aria-label={alt || undefined}
                />
              );
            }
            // eslint-disable-next-line @next/next/no-img-element
            return <img src={url} alt={alt ?? ""} {...props} />;
          },
          aside({ node, children, className }) {
            const kind = (prop(node, "dataKind") ?? "note") as CalloutKind;
            const Icon = CALLOUT_ICONS[kind] ?? Info;
            return (
              <aside className={className}>
                <p className="callout-title">
                  <Icon aria-hidden="true" size={18} strokeWidth={2.2} />
                  <span>{prop(node, "dataTitle") ?? CALLOUT_LABELS[kind]}</span>
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
        {body}
      </ReactMarkdown>
    </div>
  );
}
