import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Guide bodies are markdown written in the admin. Rendering happens on
// the server so the finished HTML is in the page for crawlers — that is
// the whole reason these articles are not fetched in the browser.
//
// Two link rules, both about not lying to the reader: anything pointing
// off-site opens in a new tab with rel="noopener", and internal links
// behave normally. Tables get their own scroll container so a wide one
// never widens the page.

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children, ...props }) {
            const url = href ?? "";
            const external = /^https?:\/\//i.test(url);
            return (
              <a
                href={url}
                {...(external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                {...props}
              >
                {children}
              </a>
            );
          },
          img({ src, alt, ...props }) {
            if (!src || typeof src !== "string") return null;
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={alt ?? ""} loading="lazy" {...props} />
            );
          },
          table({ children, ...props }) {
            return (
              <div className="table-scroll">
                <table {...props}>{children}</table>
              </div>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
