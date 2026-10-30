import shots from "@/lib/guideShots.json";
import s from "@/app/guide/guide.module.css";

type Mark = { x: number; y: number; w: number; h: number };
type ShotData = { w: number; h: number; marks: Mark[] };
const SHOTS = shots as Record<string, ShotData>;

// An annotated screenshot: the real screen (light and dark versions,
// swapped by the theme toggle), numbered boxes over the controls, and
// a matching numbered legend. Hovering a legend line highlights its box.
export function Shot({
  id,
  alt,
  items,
  caption,
  split = false,
  wideLegend = false,
}: {
  id: string;
  alt: string;
  items: React.ReactNode[];
  caption?: React.ReactNode;
  split?: boolean;
  wideLegend?: boolean;
}) {
  const data = SHOTS[id];
  if (!data) return null;
  const marks = data.marks.slice(0, items.length);

  const frame = (
    <div>
      <div className={s.frame}>
        <a
          className={`${s.zoom} ${s.imgDark}`}
          href={`/guide/dark/${id}.webp`}
          target="_blank"
          rel="noopener"
          aria-label={`Open the screenshot full size: ${alt}`}
        >
          <img src={`/guide/dark/${id}.webp`} width={data.w} height={data.h} alt={alt} loading="lazy" decoding="async" />
        </a>
        <a
          className={`${s.zoom} ${s.imgLight}`}
          href={`/guide/light/${id}.webp`}
          target="_blank"
          rel="noopener"
          aria-hidden="true"
          tabIndex={-1}
        >
          <img src={`/guide/light/${id}.webp`} width={data.w} height={data.h} alt="" loading="lazy" decoding="async" />
        </a>
        {marks.map((m, i) => (
          <span
            key={i}
            className={s.mark}
            data-n={i + 1}
            aria-hidden="true"
            style={{
              left: `${Math.max(0, m.x - 0.4)}%`,
              top: `${Math.max(0, m.y - 0.6)}%`,
              width: `${m.w + 0.8}%`,
              height: `${m.h + 1.2}%`,
            }}
          >
            <span className={s.badge}>{i + 1}</span>
          </span>
        ))}
      </div>
      <p className={s.zoomHint}>Tap the screenshot to open it full size.</p>
      {caption ? <p className={s.caption}>{caption}</p> : null}
    </div>
  );

  const legend = (
    <ol className={`${s.legend} ${wideLegend && !split ? s.legendWide : ""}`}>
      {items.map((item, i) => (
        <li key={i} data-n={i + 1}>
          <span className={s.legendNum} aria-hidden="true">
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );

  return (
    <figure className={`${s.figure} ${split ? s.figureSplit : ""}`} style={{ marginLeft: 0, marginRight: 0 }}>
      {frame}
      {legend}
    </figure>
  );
}
