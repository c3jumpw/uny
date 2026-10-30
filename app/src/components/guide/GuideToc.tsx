"use client";

import { useEffect, useState } from "react";
import s from "@/app/guide/guide.module.css";

// Table of contents that highlights the section in view.
export function GuideToc({ sections }: { sections: Array<{ id: string; title: string }> }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const els = sections
      .map((x) => document.getElementById(x.id))
      .filter((e): e is HTMLElement => Boolean(e));
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-90px 0px -65% 0px" }
    );
    els.forEach((e) => obs.observe(e));
    return () => obs.disconnect();
  }, [sections]);

  return (
    <nav className={s.toc} aria-label="Guide contents">
      <p className={s.tocTitle}>In this guide</p>
      <ol>
        {sections.map((x) => (
          <li key={x.id}>
            <a href={`#${x.id}`} data-active={active === x.id}>
              {x.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
