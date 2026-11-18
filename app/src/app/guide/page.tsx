import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Shot } from "@/components/guide/Shot";
import { GuideToc } from "@/components/guide/GuideToc";
import { PLANS, formatPrice, yearlySavingPercent } from "@/lib/plans";
import s from "./guide.module.css";

// The UnyBase user guide: every page, menu and button a workspace
// owner uses, shown on real screens with numbered callouts. Public,
// so it can be linked from emails and the website as well as from
// the dashboard menu.

export const metadata: Metadata = {
  title: "UnyBase guide",
  description: "How to use UnyBase: the vault, domains, sharing, change requests, settings and billing.",
};

const SECTIONS = [
  { id: "quick-start", title: "Quick start" },
  { id: "account", title: "Getting your account" },
  { id: "around", title: "Finding your way around" },
  { id: "vault", title: "Vault" },
  { id: "add-credential", title: "Adding a credential" },
  { id: "sharing", title: "Sharing with your developer" },
  { id: "domains", title: "Domains" },
  { id: "changes", title: "Change requests" },
  { id: "settings", title: "Settings & access" },
  { id: "billing", title: "Your plan & billing" },
  { id: "emails", title: "Emails you'll get" },
  { id: "faq", title: "Troubleshooting" },
];

const SUPPORT = "support@unywebs.com";

// Mid-tone status colours that read on both themes.
const C = {
  green: "#3f9f52",
  amber: "#d08a12",
  red: "#d94848",
  grey: "#8a8378",
  blue: "#3d8fd1",
};
function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className={s.pill}
      style={{ color, background: `${color}22`, border: `1px solid ${color}55` }}
    >
      {children}
    </span>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.tip}>
      <span className={s.calloutIcon} aria-hidden="true">💡</span>
      <div>{children}</div>
    </div>
  );
}
function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.note}>
      <span className={s.calloutIcon} aria-hidden="true">🔒</span>
      <div>{children}</div>
    </div>
  );
}

function Section({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={s.section}>
      <h2>
        <span className={s.sectionNum}>{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

// ---- tiny line icons for the diagrams ----
const icon = (d: string) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const I = {
  user: icon("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M22 11h-6"),
  mail: icon("M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6"),
  key: icon("M15 7a4 4 0 1 1-3.9 5H8v3H5v-3H2V9h9.1A4 4 0 0 1 15 7z"),
  card: icon("M2 5h20v14H2zM2 10h20"),
  check: icon("M20 6 9 17l-5-5"),
  send: icon("M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"),
  log: icon("M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"),
  x: icon("M18 6 6 18M6 6l12 12"),
  book: icon("M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"),
};
const Arrow = () => (
  <div className={s.flowArrow} aria-hidden="true">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  </div>
);

export default async function GuidePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const save = yearlySavingPercent();

  return (
    <div className={s.page}>
      <header className={s.top}>
        <div className={`wrap ${s.topInner}`}>
          <div className={s.brand}>
            <Link href={user ? "/dashboard" : "/"} aria-label="UnyBase home">
              <Image src="/logo.png" alt="UnyBase" width={120} height={24} priority />
            </Link>
            <span className={`${s.brandTitle} ${s.hideSm}`}>Guide</span>
          </div>
          <div className={s.topActions}>
            <ThemeToggle compact />
            {user ? (
              <>
                <Link href="/dashboard/tour" className={`btn btn-ghost ${s.hideSm}`} style={{ padding: "7px 14px", fontSize: "0.85rem" }}>
                  Step-by-step tour
                </Link>
                <Link href="/dashboard" className="btn btn-ghost" style={{ padding: "7px 14px", fontSize: "0.85rem" }}>
                  ← Back to dashboard
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost" style={{ padding: "7px 14px", fontSize: "0.85rem" }}>
                  Log in
                </Link>
                <Link href="/start" className={`btn btn-amber ${s.hideSm}`} style={{ padding: "7px 14px", fontSize: "0.85rem" }}>
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <div className={`wrap ${s.layout}`}>
        <GuideToc sections={SECTIONS} />

        <main className={s.content}>
          <div className={s.hero}>
            <p className={s.kicker}>UnyBase guide</p>
            <h1>Everything your apps depend on, in one place — here&apos;s how to use it.</h1>
            <p className={s.lede}>
              UnyBase keeps the keys, tokens and domains behind your website and apps in one safe place, checks
              that they still work, and warns you before anything expires. This guide walks through every page
              with real screens. Numbers on each screenshot match the notes beside it — hover a note to light
              up its spot.
            </p>
          </div>

          {/* ------------------------------------------------------------ */}
          <section id="quick-start" className={s.section} style={{ borderTop: 0, marginTop: 0, paddingTop: 0 }}>
            <h2>
              <span className={s.sectionNum}>★</span>Your first ten minutes
            </h2>
            <p>Four things that make UnyBase useful straight away. Each one takes a couple of minutes.</p>
            <div className={s.grid4}>
              <a className={s.tile} href="#add-credential">
                <div className={s.tileNum}>STEP 1</div>
                <div className={s.tileTitle}>Add a credential</div>
                <div className={s.tileText}>Paste in an API key or token your app uses. We check it works every night.</div>
              </a>
              <a className={s.tile} href="#domains">
                <div className={s.tileNum}>STEP 2</div>
                <div className={s.tileTitle}>Track your domains</div>
                <div className={s.tileText}>Add each domain and its renewal date so it never lapses by surprise.</div>
              </a>
              <a className={s.tile} href="#sharing">
                <div className={s.tileNum}>STEP 3</div>
                <div className={s.tileTitle}>Share with your developer</div>
                <div className={s.tileText}>Give them just the credentials they need, for as long as they need them.</div>
              </a>
              <a className={s.tile} href="#changes">
                <div className={s.tileNum}>STEP 4</div>
                <div className={s.tileTitle}>Log a change request</div>
                <div className={s.tileText}>Note the edits you want on your site, then send them as one tidy list.</div>
              </a>
            </div>
          </section>

          {/* ------------------------------------------------------------ */}
          <Section id="account" n={1} title="Getting your account">
            <p>
              Signing up takes four short steps. You&apos;ll get an email at each point where you need to do
              something, so you can always pick up where you left off.
            </p>
            <div className={s.flow} role="list" aria-label="Sign-up steps">
              <div className={s.flowStep} role="listitem">
                <div className={s.flowIcon}>{I.user}</div>
                <div className={s.flowTitle}>1. Create account</div>
                <div className={s.flowText}>Email, plus your password typed twice.</div>
              </div>
              <Arrow />
              <div className={s.flowStep} role="listitem">
                <div className={s.flowIcon}>{I.mail}</div>
                <div className={s.flowTitle}>2. Confirm email</div>
                <div className={s.flowText}>Press the button in the email we send.</div>
                <div className={s.flowMail}>✉ “Confirm your email”</div>
              </div>
              <Arrow />
              <div className={s.flowStep} role="listitem">
                <div className={s.flowIcon}>{I.key}</div>
                <div className={s.flowTitle}>3. Log in</div>
                <div className={s.flowText}>The link opens the login page. Use the password you chose.</div>
              </div>
              <Arrow />
              <div className={s.flowStep} role="listitem">
                <div className={s.flowIcon}>{I.card}</div>
                <div className={s.flowTitle}>4. Choose plan &amp; pay</div>
                <div className={s.flowText}>Monthly or yearly, then checkout.</div>
                <div className={s.flowMail}>✉ Reminders on days 1, 3 and 7 if unfinished</div>
              </div>
              <Arrow />
              <div className={s.flowStep} role="listitem" data-current="true">
                <div className={s.flowIcon}>{I.check}</div>
                <div className={s.flowTitle}>You&apos;re in</div>
                <div className={s.flowText}>Your dashboard opens.</div>
                <div className={s.flowMail}>✉ “Payment confirmed”</div>
              </div>
            </div>

            <h3>Create your account</h3>
            <Shot id="signup" split />

            <h3>Confirm your email</h3>
            <Shot id="inbox" split />

            <h3>Log in</h3>
            <Shot id="login" split />

            <h3>Choose your plan and pay</h3>
            <Shot id="plans" wideLegend vars={{ save }} />
            <div className={s.tableWrap}>
              <table className={s.statusTable}>
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Monthly</th>
                    <th>Yearly</th>
                    <th>Best for</th>
                  </tr>
                </thead>
                <tbody>
                  {PLANS.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                      </td>
                      <td>{formatPrice(p.monthly)}</td>
                      <td>{formatPrice(p.yearly)}</td>
                      <td>{p.tagline}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* ------------------------------------------------------------ */}
          <Section id="around" n={2} title="Finding your way around">
            <p>
              Every page has the same bar along the top. The <strong>Overview</strong> is your home page: a
              summary of your workspace, with anything that needs a look called out in orange.
            </p>
            <Shot id="overview" wideLegend />
            <div className={s.tableWrap}>
              <table className={`${s.statusTable} ${s.menuTable}`}>
                <thead>
                  <tr>
                    <th>Menu</th>
                    <th>What it&apos;s for</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Overview</td>
                    <td>Your home page — the summary above.</td>
                  </tr>
                  <tr>
                    <td>Domains</td>
                    <td>Your web addresses: where they&apos;re registered and when they renew. <a href="#domains" style={{ color: "var(--sky)" }}>More ↓</a></td>
                  </tr>
                  <tr>
                    <td>Team</td>
                    <td>
                      Inviting teammates is coming soon. Until then, use <a href="#sharing" style={{ color: "var(--sky)" }}>Vault sharing</a>{" "}
                      or <a href="#settings" style={{ color: "var(--sky)" }}>Settings</a> to give people access.
                    </td>
                  </tr>
                  <tr>
                    <td>Vault</td>
                    <td>Your API keys, tokens and logins, with health checks and expiry warnings. <a href="#vault" style={{ color: "var(--sky)" }}>More ↓</a></td>
                  </tr>
                  <tr>
                    <td>Changes</td>
                    <td>A running list of edits you want made to your site or tools. <a href="#changes" style={{ color: "var(--sky)" }}>More ↓</a></td>
                  </tr>
                  <tr>
                    <td>Settings</td>
                    <td>Who can access your whole workspace. <a href="#settings" style={{ color: "var(--sky)" }}>More ↓</a></td>
                  </tr>
                  <tr>
                    <td>Help</td>
                    <td>
                      The getting-started tour: every screen step by step, with a track for each kind of user. It
                      links back to this full guide.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* ------------------------------------------------------------ */}
          <Section id="vault" n={3} title="Vault">
            <p>
              The vault holds the <strong>credentials</strong> your website and apps run on — API keys, access
              tokens, service logins. UnyBase checks each one still works and warns you before it expires, so
              a forgotten key never quietly takes your site down.
            </p>
            <Shot id="vault" wideLegend />

            <h3>What the colours mean</h3>
            <div className={s.tableWrap}>
              <table className={s.statusTable}>
                <thead>
                  <tr>
                    <th>Health</th>
                    <th>What it means</th>
                    <th>What to do</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><Pill color={C.green}>Healthy</Pill></td>
                    <td>It worked the last time we tried it.</td>
                    <td>Nothing.</td>
                  </tr>
                  <tr>
                    <td><Pill color={C.amber}>Degraded</Pill></td>
                    <td>It answered, but not normally (for example limited permissions or a slow reply).</td>
                    <td>Keep an eye on it; check the note on the card.</td>
                  </tr>
                  <tr>
                    <td><Pill color={C.red}>Failed</Pill></td>
                    <td>It was rejected — usually the key was changed, revoked or has expired.</td>
                    <td>Create a new key with the provider, then <strong>Edit</strong> and paste it in.</td>
                  </tr>
                  <tr>
                    <td><Pill color={C.grey}>Not checked</Pill></td>
                    <td>We haven&apos;t tested it yet, or it&apos;s a provider we can&apos;t test automatically.</td>
                    <td>Press <strong>Check</strong>. For a custom provider, add its URL so it can be tested.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3>Reading a credential card</h3>
            <Shot id="vault-card" wideLegend />
            <Note>
              <strong>Your credentials are encrypted</strong> before they&apos;re saved, are hidden unless you
              press Reveal, and every reveal is recorded in the card&apos;s History.
            </Note>

            <h3>Expiry warnings</h3>
            <p>
              If you set an expiry date, you get an email at each of these points — plus one whenever a working
              credential suddenly fails its check.
            </p>
            <div className={s.timeline} aria-label="Credential expiry emails at 14, 7 and 1 days before expiry">
              <span className={s.timelineStart}>Plenty of time</span>
              <span className={s.timelineEnd}>Expires</span>
              <div className={s.timelineBar} />
              <div className={s.timelineDots}>
                <span className={s.timelineDot} style={{ left: "45%" }}>
                  <strong>14 days</strong>email
                </span>
                <span className={s.timelineDot} style={{ left: "72%" }}>
                  <strong>7 days</strong>email
                </span>
                <span className={s.timelineDot} style={{ left: "94%" }}>
                  <strong>1 day</strong>email
                </span>
              </div>
            </div>
          </Section>

          {/* ------------------------------------------------------------ */}
          <Section id="add-credential" n={4} title="Adding a credential">
            <p>
              Press <strong>Add integration</strong> on the Vault page. Only the name is required — fill in what
              you know and come back to the rest later.
            </p>
            <Shot id="vault-add" split />
            <Tip>
              <strong>Where do I find my keys?</strong> In each service&apos;s settings, usually under
              “Developer”, “API” or “Tokens”. If someone else set up your site, ask them to add the credentials
              for you — or share the vault with them (next section) so they can.
            </Tip>
          </Section>

          {/* ------------------------------------------------------------ */}
          <Section id="sharing" n={5} title="Sharing with your developer">
            <p>
              Give a developer, contractor or teammate access to <strong>just the credentials they need</strong>.
              They log in with their own UnyBase account (free to create with the same email) and see only what
              you shared.
            </p>
            <Shot id="vault-share" wideLegend />
            <h3>Sharing or Settings — which should I use?</h3>
            <div className={s.tableWrap}>
              <table className={s.statusTable}>
                <thead>
                  <tr>
                    <th></th>
                    <th>Vault → Share credentials</th>
                    <th>Settings → Grant access</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Best for</strong></td>
                    <td>A freelancer or developer working on one site</td>
                    <td>An agency or technical admin who looks after everything</td>
                  </tr>
                  <tr>
                    <td><strong>They can see</strong></td>
                    <td>Only the credentials you pick</td>
                    <td>Your whole workspace, including your subscription status</td>
                  </tr>
                  <tr>
                    <td><strong>They can also</strong></td>
                    <td>Log change requests for that system and mark them done</td>
                    <td>Add and update credentials and change requests for you</td>
                  </tr>
                  <tr>
                    <td><strong>Ends</strong></td>
                    <td>On the date you choose, or when you revoke</td>
                    <td>On the date you choose, or when you revoke</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* ------------------------------------------------------------ */}
          <Section id="domains" n={6} title="Domains">
            <p>
              A lapsed domain takes your whole site offline, so domains get their own page: where each one is
              registered, who manages its DNS, and when the domain and its security certificate (SSL) renew.
            </p>
            <Shot id="domains" wideLegend />
            <Shot id="domains-add" split />
            <p>
              Domains get earlier warnings than credentials, because moving or rescuing a domain can take weeks:
            </p>
            <div className={s.timeline} aria-label="Domain and SSL emails at 30, 14, 7 and 1 days before expiry">
              <span className={s.timelineStart}>Plenty of time</span>
              <span className={s.timelineEnd}>Expires</span>
              <div className={s.timelineBar} />
              <div className={s.timelineDots}>
                <span className={s.timelineDot} style={{ left: "22%" }}>
                  <strong>30 days</strong>email
                </span>
                <span className={s.timelineDot} style={{ left: "50%" }}>
                  <strong>14 days</strong>email
                </span>
                <span className={s.timelineDot} style={{ left: "74%" }}>
                  <strong>7 days</strong>email
                </span>
                <span className={s.timelineDot} style={{ left: "94%" }}>
                  <strong>1 day</strong>email
                </span>
              </div>
            </div>
          </Section>

          {/* ------------------------------------------------------------ */}
          <Section id="changes" n={7} title="Change requests">
            <p>
              A <strong>change request</strong> is one edit you want made to your website or a tool — a fix, a
              tweak or something new. Jot them down as you notice them, then send a batch to your developer as
              one tidy, numbered list.
            </p>
            <div className={s.flow} role="list" aria-label="Change request statuses">
              <div className={s.flowStep} role="listitem">
                <div className={s.flowIcon} style={{ color: C.amber }}>{I.log}</div>
                <div className={s.flowTitle}>Pending</div>
                <div className={s.flowText}>Logged, not handed off yet.</div>
              </div>
              <Arrow />
              <div className={s.flowStep} role="listitem">
                <div className={s.flowIcon} style={{ color: C.blue }}>{I.send}</div>
                <div className={s.flowTitle}>Sent</div>
                <div className={s.flowText}>With your developer, technician or AI tool.</div>
              </div>
              <Arrow />
              <div className={s.flowStep} role="listitem">
                <div className={s.flowIcon} style={{ color: C.green }}>{I.check}</div>
                <div className={s.flowTitle}>Done</div>
                <div className={s.flowText}>Live on your site. Moves to the Changelog.</div>
              </div>
              <div className={s.flowArrow} aria-hidden="true" style={{ color: "var(--line-2)" }}>·</div>
              <div className={s.flowStep} role="listitem" style={{ opacity: 0.85 }}>
                <div className={s.flowIcon} style={{ color: C.grey }}>{I.x}</div>
                <div className={s.flowTitle}>Dropped</div>
                <div className={s.flowText}>Decided against — kept for the record.</div>
              </div>
            </div>
            <Shot id="changes" wideLegend />
            <h3>What gets copied</h3>
            <p>Paste it anywhere — it reads cleanly in an email, a chat message or an AI coding tool:</p>
            <div className={s.clip}>
              <div className={s.clipHead}>
                <span>Clipboard</span>
                <span>Copy &amp; mark sent</span>
              </div>
              <pre>{`Change requests — Acme storefront
30 Oct 2026 · 2 items

1. [Fix] (High priority) Checkout button overlaps the logo on mobile
2. [New] Add CSV export to the orders table

Please reply with the item numbers as each one is done, and flag anything that needs a decision.`}</pre>
            </div>

            <h3>Your changelog</h3>
            <Shot id="changes-done" wideLegend />
            <Tip>
              People you&apos;ve shared a system with can see that system&apos;s change requests and mark them
              done themselves — so the list stays up to date without chasing.
            </Tip>
          </Section>

          {/* ------------------------------------------------------------ */}
          <Section id="settings" n={8} title="Settings & access">
            <p>
              Settings is where you let a <strong>technical admin</strong> — usually your agency — look after
              your whole workspace. Use it for people you trust with everything; for anyone else, share
              specific credentials instead.
            </p>
            <Shot id="settings" wideLegend />
          </Section>

          {/* ------------------------------------------------------------ */}
          <Section id="billing" n={9} title="Your plan & billing">
            <div className={s.grid2}>
              <div className={s.tile}>
                <div className={s.tileTitle}>Your status</div>
                <div className={s.tileText}>
                  Shown on the Overview. <Pill color={C.green}>Active</Pill> means you&apos;re paid up.
                </div>
              </div>
              <div className={s.tile}>
                <div className={s.tileTitle}>Changing or cancelling</div>
                <div className={s.tileText}>
                  Email <a href={`mailto:${SUPPORT}`} style={{ color: "var(--sky)" }}>{SUPPORT}</a> and we&apos;ll
                  switch plans or billing cycle for you.
                </div>
              </div>
              <div className={s.tile}>
                <div className={s.tileTitle}>On a trial?</div>
                <div className={s.tileText}>
                  A banner on the Overview shows the end date and days left. We email you 3 days and 1 day before
                  it ends. Afterwards you&apos;ll be asked to pick a plan at login — nothing is deleted.
                </div>
              </div>
              <div className={s.tile}>
                <div className={s.tileTitle}>If a payment fails</div>
                <div className={s.tileText}>
                  We email you straight away and <strong>nothing changes</strong> yet. Updating your card usually
                  fixes it.
                </div>
              </div>
            </div>
            <div className={s.flow} role="list" aria-label="What happens after a failed payment">
              <div className={s.flowStep} role="listitem">
                <div className={s.flowIcon} style={{ color: C.amber }}>{I.mail}</div>
                <div className={s.flowTitle}>Payment fails</div>
                <div className={s.flowText}>Email to you. Everything keeps running.</div>
              </div>
              <Arrow />
              <div className={s.flowStep} role="listitem">
                <div className={s.flowIcon} style={{ color: C.amber }}>{I.card}</div>
                <div className={s.flowTitle}>Grace period</div>
                <div className={s.flowText}>Time to update your payment details.</div>
              </div>
              <Arrow />
              <div className={s.flowStep} role="listitem">
                <div className={s.flowIcon} style={{ color: C.red }}>{I.x}</div>
                <div className={s.flowTitle}>Paused</div>
                <div className={s.flowText}>
                  Only if it stays unpaid. A person decides, you&apos;re emailed, and no data is deleted.
                </div>
              </div>
              <Arrow />
              <div className={s.flowStep} role="listitem" data-current="true">
                <div className={s.flowIcon} style={{ color: C.green }}>{I.check}</div>
                <div className={s.flowTitle}>Back on</div>
                <div className={s.flowText}>Once paid, everything is restored as it was.</div>
              </div>
            </div>
          </Section>

          {/* ------------------------------------------------------------ */}
          <Section id="emails" n={10} title="Emails you'll get">
            <p>
              You can reply to any of these emails &mdash; replies reach a person at UnyBase.
            </p>
            <div className={s.tableWrap}>
              <table className={s.statusTable}>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td><strong>Confirm your email</strong></td><td>Right after you sign up (sent once more after a day if you haven&apos;t confirmed).</td></tr>
                  <tr><td><strong>Finish setting up</strong></td><td>1, 3 and 7 days after sign-up, only if checkout isn&apos;t finished.</td></tr>
                  <tr><td><strong>Payment confirmed</strong></td><td>When your first payment goes through, with first steps.</td></tr>
                  <tr><td><strong>Credential expiring</strong></td><td>14, 7 and 1 days before a credential&apos;s expiry date.</td></tr>
                  <tr><td><strong>Integration check failed</strong></td><td>When a credential that was working stops working.</td></tr>
                  <tr><td><strong>Domain / SSL renewal due</strong></td><td>30, 14, 7 and 1 days before.</td></tr>
                  <tr><td><strong>Credentials shared with you</strong></td><td>When someone shares their vault with you.</td></tr>
                  <tr><td><strong>Trial started / ending / ended</strong></td><td>If you&apos;re given a trial: at the start, 3 and 1 days before it ends, and when it ends.</td></tr>
                  <tr><td><strong>Payment didn&apos;t go through</strong></td><td>If a payment fails. Nothing changes yet.</td></tr>
                  <tr><td><strong>Automations paused / back on</strong></td><td>Only if your account is paused for non-payment, and when it&apos;s restored.</td></tr>
                  <tr><td><strong>Reset your password</strong></td><td>When you press <em>Forgot password?</em></td></tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* ------------------------------------------------------------ */}
          <Section id="faq" n={11} title="Troubleshooting">
            <div className={s.faq}>
              <details>
                <summary>I didn&apos;t get the confirmation email</summary>
                <div>
                  Give it a minute, then check spam and promotions folders. On the <em>Check your inbox</em> page
                  (or the login page) press <strong>Resend confirmation email</strong>. We also resend it once by
                  ourselves after a day.
                </div>
              </details>
              <details>
                <summary>The confirmation link says it has expired</summary>
                <div>
                  Links work once and expire after a day. If you already confirmed, just log in. Otherwise use
                  the <strong>Resend</strong> button shown on the login page to get a fresh link.
                </div>
              </details>
              <details>
                <summary>“That email and password don&apos;t match”</summary>
                <div>
                  Check for typos and caps lock. Still stuck? Press <strong>Forgot password?</strong> on the login
                  page to set a new one.
                </div>
              </details>
              <details>
                <summary>I paid, but I&apos;m still on the plans page</summary>
                <div>
                  Confirmation usually takes under a minute. Press <strong>I&apos;ve already paid — check now</strong>.
                  If you paid with a different email address than your UnyBase login, write to{" "}
                  <a href={`mailto:${SUPPORT}`} style={{ color: "var(--sky)" }}>{SUPPORT}</a> and we&apos;ll link it.
                </div>
              </details>
              <details>
                <summary>A credential says “Failed” — is my site down?</summary>
                <div>
                  Not necessarily, but whatever uses that key may stop working. Read the note on the card (it
                  says what the provider replied), create a new key with that provider, then press{" "}
                  <strong>Edit</strong>, paste it in and save. The next check turns it green.
                </div>
              </details>
              <details>
                <summary>Why does a credential say “Not checked”?</summary>
                <div>
                  It hasn&apos;t been tested yet — press <strong>Check</strong>. Custom providers can only be tested
                  if you add their URL and how they sign in; otherwise they stay “Not checked”, and expiry warnings
                  still work.
                </div>
              </details>
              <details>
                <summary>Can my developer see all my credentials?</summary>
                <div>
                  Only if you let them. Vault sharing shows them just what you pick; Settings gives a technical
                  admin the whole workspace. Both can be revoked instantly, and every reveal is recorded in the
                  credential&apos;s History.
                </div>
              </details>
              <details>
                <summary>What happens to my data if I stop paying?</summary>
                <div>
                  Nothing is deleted. You&apos;ll be asked to choose a plan when you next log in, and everything is
                  exactly where you left it once you do.
                </div>
              </details>
            </div>

            <div className={s.help}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Still need a hand?</div>
                <div style={{ color: "var(--paper-dim)", fontSize: "0.9rem" }}>
                  Write to us — or reply to any UnyBase email. A person reads every message.
                </div>
              </div>
              <a href={`mailto:${SUPPORT}`} className="btn btn-amber">
                Email {SUPPORT}
              </a>
            </div>
          </Section>
        </main>
      </div>
    </div>
  );
}
