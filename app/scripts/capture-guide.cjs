// Captures UnyBase screens for the user guide, in light and dark,
// and records where each numbered callout sits (as % of the image).
//
// Refresh after a UI change:
//   1. npm run build && GUIDE_CAPTURE=1 PORT=3123 npm start   (with the
//      usual NEXT_PUBLIC_SUPABASE_* env so the auth pages render)
//   2. node scripts/capture-guide.cjs /tmp/guide-shots
//   3. node scripts/capture-guide.cjs --convert /tmp/guide-shots
//      (writes public/guide/{dark,light}/*.webp and src/lib/guideShots.json)
//   4. rebuild; the guide picks up the new callout positions.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.GUIDE_BASE || 'http://localhost:3123';
const OUT = process.argv[2];
const DSF = 1.5;

async function box(loc) {
  const b = await loc.first().boundingBox();
  if (!b) throw new Error('no box for ' + loc);
  return b;
}
function union(...bs) {
  const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y));
  const r = Math.max(...bs.map((b) => b.x + b.width)), btm = Math.max(...bs.map((b) => b.y + b.height));
  return { x, y, width: r - x, height: btm - y };
}
const field = (scope, label) => scope.locator('label', { hasText: label }).first().locator('xpath=..');

const SHOTS = [
  {
    id: 'overview', vw: 1100, url: '/guide/demo?shot=overview', vh: 640,
    clip: async (p) => { const b = await box(p.locator('[data-guide=apikey-card]')); return { x: 0, y: 0, width: p.viewportSize().width, height: b.y + b.height + 24 }; },
    marks: async (p) => [
      await box(p.locator('header nav')),
      await box(p.locator('header button').first()),
      await box(p.getByText('jane@acmestudio.com').locator('xpath=..')),
      await box(p.getByRole('button', { name: 'Sign out' })),
      await box(p.locator('[data-guide=subscription]')),
      await box(p.locator('[data-guide=vault-card]')),
      await box(p.locator('[data-guide=domains-card]')),
      await box(p.locator('[data-guide=changes-card]')),
      await box(p.locator('[data-guide=guide-card]')),
    ],
  },
  {
    id: 'signup', url: '/signup?plan=premium&cycle=yearly', vh: 1000,
    act: async (p) => {
      await p.fill('#email', 'jane@acmestudio.com');
      await p.fill('#password', 'correct-horse-92');
      await p.fill('#confirm', 'correct-horse-92');
      await p.locator('#confirm').blur();
    },
    clip: async (p) => pad(await box(p.locator('.card')), 12),
    marks: async (p) => [
      await box(p.locator('.card ol').first()),
      union(await box(p.locator('#email')), await box(p.getByText('Use the same email at checkout'))),
      await box(p.getByRole('button', { name: /Show passwords/ })),
      union(await box(p.locator('#confirm')), await box(p.getByText('Passwords match'))),
      await box(p.getByRole('button', { name: 'Create account' })),
    ],
  },
  {
    id: 'inbox', url: '/signup?sent=1&email=jane%40acmestudio.com', vh: 900,
    clip: async (p) => pad(await box(p.locator('.card')), 12),
    marks: async (p) => [
      await box(p.locator('.card ol').nth(1)),
      await box(p.getByRole('button', { name: 'Resend confirmation email' })),
      await box(p.getByRole('link', { name: 'Already confirmed? Log in' })),
    ],
  },
  {
    id: 'login', url: '/login?confirmed=1', vh: 900,
    clip: async (p) => pad(await box(p.locator('.card')), 12),
    marks: async (p) => [
      await box(p.locator('[role=status]')),
      await box(p.getByRole('link', { name: 'Forgot password?' })),
      await box(p.getByRole('button', { name: 'Log in' })),
    ],
  },
  {
    id: 'plans', vw: 1024, url: '/guide/demo?shot=plans', vh: 1200,
    clip: async (p) => {
      const how = await box(p.locator('.card', { hasText: 'How checkout works' }));
      return { x: 0, y: 0, width: p.viewportSize().width, height: how.y + how.height + 24 };
    },
    marks: async (p) => {
      const prem = p.locator('.card', { has: p.locator('h2', { hasText: 'Premium' }) });
      return [
        await box(p.locator('[role=radiogroup] > div')),
        await box(prem),
        await box(prem.getByRole('link')),
        await box(prem.getByText('On the checkout page')),
        await box(p.getByRole('button', { name: /already paid/ })),
        await box(p.getByRole('button', { name: 'Sign out' })),
      ];
    },
  },
  {
    id: 'vault', vw: 960, url: '/guide/demo?shot=vault', vh: 1100,
    clip: async (p) => {
      const h1 = await box(p.locator('main h1'));
      const card = await box(p.locator('.card', { hasText: 'Payments API key' }));
      return { x: 0, y: h1.y - 20, width: p.viewportSize().width, height: card.y + card.height + 20 - (h1.y - 20) };
    },
    marks: async (p) => {
      const card = p.locator('.card', { hasText: 'Payments API key' });
      return [
        await box(p.locator('.card', { hasText: 'Sharing' }).first()),
        await box(p.getByText(/need attention/).first()),
        await box(p.locator('main select[aria-label="Filter by system"]')),
        await box(p.getByRole('button', { name: 'Check all' })),
        await box(p.getByRole('button', { name: 'Add integration' })),
        await box(card.getByText('Failed', { exact: true })),
        await box(card.getByTitle('Filter by this system')),
        union(await box(card.getByRole('button', { name: 'Check' })), await box(card.getByRole('button', { name: 'Delete' }))),
        await box(card.getByText(/401 Unauthorized/)),
      ];
    },
  },
  {
    id: 'vault-card', vw: 960, url: '/guide/demo?shot=vault', vh: 1400,
    act: async (p) => {
      await p.route('**/api/integrations/reveal', (r) =>
        r.fulfill({ json: { credential: 'ghp_8Jr2kQ7xWm4Lc9Vb1Tz6Ny3Hp5Sd0Fa9fQ2', id: 'i1' } })
      );
      const card = p.locator('.card', { hasText: 'Storefront deploy token' });
      await card.getByRole('button', { name: 'Reveal', exact: true }).click();
      await card.getByRole('button', { name: /^History/ }).click();
      await p.waitForTimeout(300);
    },
    clip: async (p) => pad(await box(p.locator('.card', { hasText: 'Storefront deploy token' })), 12),
    marks: async (p) => {
      const card = p.locator('.card', { hasText: 'Storefront deploy token' });
      return [
        await box(card.getByText('GitHub', { exact: true })),
        await box(card.getByText('Healthy', { exact: true })),
        await box(card.getByText('Client account', { exact: true })),
        union(await box(card.locator('code')), await box(card.getByText(/hides in/))),
        await box(card.getByRole('button', { name: 'Copy' })),
        await box(card.getByText(/Expires in 6d/)),
        await box(card.getByText(/Rotate from GitHub/)),
        await box(card.getByRole('button', { name: 'Hide history' })),
      ];
    },
  },
  {
    id: 'vault-add', url: '/guide/demo?shot=vault', vh: 1500,
    act: async (p) => {
      await p.getByRole('button', { name: 'Add integration' }).click();
      const m = p.locator('h2', { hasText: 'Add integration' }).locator('xpath=..');
      await m.getByPlaceholder('e.g. Acme Corp GitHub deploy token').fill('Storefront deploy token');
      await m.getByPlaceholder('e.g. Acme storefront, Internal CRM, Staging').fill('Acme storefront');
      await m.getByPlaceholder('Paste the token or key').fill('ghp_8Jr2kQ7xWm4Lc9Vb1Tz6Ny3Hp5Sd0Fa9fQ2');
      await m.getByPlaceholder('e.g. c3jumpw, billing@acme.com').fill('acme-studio');
      await m.getByPlaceholder('e.g. GITHUB_TOKEN').fill('GITHUB_TOKEN');
      const d = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
      await field(m, 'Expires on').locator('input').fill(d);
      await m.getByPlaceholder('Anything the next person needs to know').fill('Used by the Vercel build. Rotate from GitHub → Developer settings.');
    },
    clip: async (p) => pad(await box(p.locator('h2', { hasText: 'Add integration' }).locator('xpath=..')), 0),
    marks: async (p) => {
      const m = p.locator('h2', { hasText: 'Add integration' }).locator('xpath=..');
      return [
        await box(field(m, 'Name')),
        await box(field(m, 'App / tool / system')),
        await box(field(m, 'Provider')),
        await box(field(m, 'Personal access token')),
        await box(field(m, 'Account this belongs to')),
        await box(field(m, 'Who owns that account?')),
        await box(field(m, 'Expires on')),
        await box(field(m, 'Notes')),
        await box(m.getByRole('button', { name: 'Add integration' })),
      ];
    },
  },
  {
    id: 'vault-share', vw: 960, url: '/guide/demo?shot=vault', vh: 1200,
    act: async (p) => {
      await p.getByRole('button', { name: 'Share credentials' }).click();
      const c = p.locator('.card', { hasText: 'Sharing' }).first();
      await field(c, 'Their email').locator('input').fill('alex@brightcode.dev');
      await field(c, 'What to share').locator('select').selectOption('system');
      await field(c, 'Which system').locator('select').selectOption('Acme storefront');
      await field(c, 'Access expires').locator('select').selectOption('30');
      await field(c, 'Note (optional)').locator('input').fill('Fixing the checkout bug');
    },
    clip: async (p) => pad(await box(p.locator('.card', { hasText: 'Sharing' }).first()), 12),
    marks: async (p) => {
      const c = p.locator('.card', { hasText: 'Sharing' }).first();
      return [
        await box(field(c, 'Their email')),
        await box(field(c, 'What to share')),
        await box(field(c, 'Which system')),
        await box(field(c, 'Access expires')),
        await box(c.getByRole('button', { name: 'Share', exact: true })),
        union(await box(c.getByText('sam@pixelforge.dev').locator('xpath=../..')), await box(c.getByRole('button', { name: 'Revoke' }))),
      ];
    },
  },
  {
    id: 'domains', vw: 960, url: '/guide/demo?shot=domains', vh: 900,
    clip: async (p) => {
      const h1 = await box(p.locator('main h1'));
      const last = await box(p.locator('.card', { hasText: 'crm.acmestudio.com' }));
      return { x: 0, y: h1.y - 20, width: p.viewportSize().width, height: last.y + last.height + 20 - (h1.y - 20) };
    },
    marks: async (p) => {
      const c = p.locator('.card', { hasText: 'Renew for 2 years' });
      return [
        await box(p.getByRole('button', { name: 'Add domain' })),
        await box(c.getByText('Auto-renew off')),
        await box(c.getByText(/Domain renewal/).locator('xpath=..')),
        await box(c.getByText(/^SSL:/).locator('xpath=..')),
        await box(c.getByText('Client account', { exact: true })),
        union(await box(c.getByRole('button', { name: 'Edit' })), await box(c.getByRole('button', { name: 'Delete' }))),
      ];
    },
  },
  {
    id: 'domains-add', url: '/guide/demo?shot=domains', vh: 1500,
    act: async (p) => {
      await p.getByRole('button', { name: 'Add domain' }).click();
      const m = p.locator('h2', { hasText: 'Add domain' }).locator('xpath=..');
      await m.getByPlaceholder('example.com', { exact: true }).fill('acmestudio.com');
      await m.getByPlaceholder('e.g. Acme storefront').fill('Acme storefront');
      await m.getByPlaceholder('e.g. Namecheap').fill('Namecheap');
      await m.getByPlaceholder('e.g. Cloudflare').fill('Cloudflare');
      const d1 = new Date(Date.now() + 200 * 864e5).toISOString().slice(0, 10);
      const d2 = new Date(Date.now() + 80 * 864e5).toISOString().slice(0, 10);
      await field(m, 'Domain expires').locator('input').fill(d1);
      await field(m, 'SSL expires').locator('input').fill(d2);
    },
    clip: async (p) => pad(await box(p.locator('h2', { hasText: 'Add domain' }).locator('xpath=..')), 0),
    marks: async (p) => {
      const m = p.locator('h2', { hasText: 'Add domain' }).locator('xpath=..');
      return [
        await box(field(m, 'Domain name')),
        await box(field(m, 'App / tool / system')),
        union(await box(field(m, 'Registrar')), await box(field(m, 'Registrar login'))),
        union(await box(field(m, 'DNS provider')), await box(field(m, 'DNS login'))),
        union(await box(field(m, 'Domain expires')), await box(field(m, 'SSL expires'))),
        await box(m.getByText('Auto-renew is enabled at the registrar').locator('xpath=..')),
        await box(m.getByRole('button', { name: 'Add domain' })),
      ];
    },
  },
  {
    id: 'changes', vw: 960, url: '/guide/demo?shot=changes', vh: 1300,
    act: async (p) => {
      await p.locator('textarea').first().fill('Add a size guide link under the product photos\nFooter shows last year’s copyright date');
      await p.getByLabel('Associated app, tool or system').fill('Acme storefront');
    },
    clip: async (p) => {
      const h1 = await box(p.locator('main h1'));
      const sec = await box(p.locator('main section').first());
      return { x: 0, y: h1.y - 20, width: p.viewportSize().width, height: sec.y + sec.height + 20 - (h1.y - 20) };
    },
    marks: async (p) => {
      const firstRow = p.locator('main section').first();
      return [
        await box(p.locator('textarea').first()),
        union(await box(p.getByLabel('Associated app, tool or system')), await box(p.getByLabel('Priority').first())),
        await box(p.getByRole('button', { name: /^Add 2 requests$/ })),
        await box(p.getByRole('tablist')),
        await box(p.getByRole('button', { name: /^Copy & mark sent$/ })),
        await box(firstRow.getByLabel('Status').first()),
        union(await box(firstRow.getByRole('button', { name: 'Copy' }).first()), await box(firstRow.getByRole('button', { name: 'Delete' }).first())),
      ];
    },
  },
  {
    id: 'changes-done', vw: 960, url: '/guide/demo?shot=changes', vh: 1100,
    act: async (p) => {
      await p.getByRole('tab', { name: /Changelog/ }).click();
      await p.waitForTimeout(200);
    },
    clip: async (p) => {
      const tabs = await box(p.getByRole('tablist'));
      const sec = await box(p.locator('main section').first());
      return { x: 0, y: tabs.y - 16, width: p.viewportSize().width, height: sec.y + sec.height + 20 - (tabs.y - 16) };
    },
    marks: async (p) => [
      await box(p.getByRole('tab', { name: /Changelog/ })),
      await box(p.getByRole('button', { name: /Copy changelog/ })),
      await box(p.getByText('Done', { exact: true }).first()),
      await box(p.getByPlaceholder(/Resolution note/)),
    ],
  },
  {
    id: 'settings', vw: 960, url: '/guide/demo?shot=settings', vh: 900,
    clip: async (p) => {
      const h1 = await box(p.locator('main h1'));
      const last = await box(p.locator('.card', { hasText: 'support@pixelforge.dev' }));
      return { x: 0, y: h1.y - 20, width: p.viewportSize().width, height: last.y + last.height + 20 - (h1.y - 20) };
    },
    marks: async (p) => [
      await box(p.getByText('Their email').locator('xpath=..')),
      await box(p.getByText('Access expires').locator('xpath=..')),
      await box(p.getByRole('button', { name: 'Grant access' })),
      await box(p.locator('.card', { hasText: 'support@pixelforge.dev' })),
    ],
  },

  // ---- Admin tracks of the getting-started tour -------------------
  {
    id: 'admin', vw: 1280, url: '/guide/demo?shot=admin', vh: 1200,
    clip: async (p) => {
      const tabs = await box(p.locator('nav[aria-label="Admin sections"]'));
      const t = await box(p.locator('[data-guide=admin-table]'));
      return { x: 0, y: tabs.y - 16, width: p.viewportSize().width, height: t.y + t.height + 20 - (tabs.y - 16) };
    },
    marks: async (p) => {
      const row = p.locator('[data-guide=admin-table] tbody tr').first();
      const td = (n) => row.locator('td').nth(n);
      return [
        await box(p.locator('[data-guide=admin-scope]')),
        await box(p.getByRole('button', { name: 'Import subscribers' })),
        await box(p.locator('[data-guide=status-legend]')),
        await box(td(0)),
        await box(td(1)),
        union(await box(td(2)), await box(td(3))),
        await box(td(4)),
        await box(td(5)),
      ];
    },
  },
  {
    id: 'admin-audit', vw: 1280, url: '/guide/demo?shot=admin', vh: 2400,
    clip: async (p) => pad(union(await box(p.locator('[data-guide=systeme-panel]')), await box(p.locator('[data-guide=admin-actions]'))), 12),
    marks: async (p) => {
      const panel = p.locator('[data-guide=systeme-panel]');
      return [
        union(await box(panel.getByText('systeme.io segments')), await box(panel.getByText(/^Signups get/))),
        await box(panel.getByRole('button', { name: 'Sync tags now' })),
        await box(panel.locator('table')),
        await box(p.locator('[data-guide=admin-actions]')),
      ];
    },
  },
  {
    id: 'admin-trial', vw: 1280, url: '/guide/demo?shot=admin', vh: 1100,
    act: async (p) => {
      const row = p.locator('[data-guide=admin-table] tbody tr', { hasText: 'sam@newbakery.co' });
      await row.getByRole('button', { name: 'Trial' }).click();
      const m = p.locator('h2', { hasText: 'Start a manual trial' }).locator('xpath=..');
      await m.getByRole('button', { name: '30 days' }).click();
      await field(m, 'Note (internal)').locator('input').fill('Demo call: wants to try it on 2 sites');
    },
    clip: async (p) => pad(await box(p.locator('h2', { hasText: 'Start a manual trial' }).locator('xpath=..')), 0),
    marks: async (p) => {
      const m = p.locator('h2', { hasText: 'Start a manual trial' }).locator('xpath=..');
      return [
        await box(m.getByRole('button', { name: '14 days' }).locator('xpath=..')),
        await box(field(m, 'Trial ends on')),
        await box(field(m, 'Note (internal)')),
        await box(m.locator('label', { hasText: 'Email them that the trial is on' })),
        await box(m.getByRole('button', { name: 'Start trial' })),
      ];
    },
  },
  {
    id: 'admin-cutoff', vw: 1280, url: '/guide/demo?shot=admin', vh: 1100,
    act: async (p) => {
      const row = p.locator('[data-guide=admin-table] tbody tr', { hasText: 'owner@joestires.com' });
      await row.getByRole('button', { name: 'Cut off' }).click();
      const m = p.locator('h2', { hasText: 'Cut off automations?' }).locator('xpath=..');
      await m.locator('textarea').fill('21 days lapsed, no reply to three reminders');
      await field(m, 'to confirm').locator('input').fill('CUTOFF');
    },
    clip: async (p) => pad(await box(p.locator('h2', { hasText: 'Cut off automations?' }).locator('xpath=..')), 0),
    marks: async (p) => {
      const m = p.locator('h2', { hasText: 'Cut off automations?' }).locator('xpath=..');
      return [
        await box(m.locator('p').first()),
        await box(field(m, 'Reason')),
        await box(field(m, 'to confirm')),
        await box(m.getByRole('button', { name: 'Cut off', exact: true })),
      ];
    },
  },
  {
    id: 'admin-tech', vw: 1280, url: '/guide/demo?shot=admin-tech', vh: 1000,
    clip: async (p) => {
      const h1 = await box(p.locator('main h1'));
      const a = await box(p.locator('[data-guide=admin-actions]'));
      return { x: 0, y: h1.y - 20, width: p.viewportSize().width, height: a.y + a.height + 20 - (h1.y - 20) };
    },
    marks: async (p) => {
      const row = p.locator('[data-guide=admin-table] tbody tr').first();
      return [
        await box(p.locator('[data-guide=admin-scope]')),
        await box(row.locator('td').nth(0)),
        await box(row.locator('td').nth(5)),
        await box(p.locator('[data-guide=admin-actions]')),
      ];
    },
  },
  {
    id: 'sites', vw: 1280, url: '/guide/demo?shot=sites', vh: 1100,
    clip: async (p) => {
      const tabs = await box(p.locator('nav[aria-label="Admin sections"]'));
      const prompt = await box(p.locator('details', { hasText: 'Builder prompt' }));
      return { x: 0, y: tabs.y - 16, width: p.viewportSize().width, height: prompt.y + prompt.height + 20 - (tabs.y - 16) };
    },
    marks: async (p) => {
      const row = p.locator('table tbody tr').first();
      const td = (n) => row.locator('td').nth(n);
      return [
        await box(p.getByRole('button', { name: 'Register a site' })),
        await box(p.getByText(/^4 sites/)),
        await box(td(0)),
        await box(td(2)),
        await box(td(3)),
        await box(td(4)),
        await box(td(5)),
        await box(p.locator('details', { hasText: 'Builder prompt' })),
      ];
    },
  },
  {
    id: 'sites-key', vw: 1280, url: '/guide/demo?shot=sites', vh: 1000,
    act: async (p) => {
      await p.route('**/api/admin/sites', (r) =>
        r.fulfill({ json: { ok: true, id: '9', key: 'unyl_7b2e91c04f6a3d58e0b1c97a2f4d6e8b13c5a7f9e2d4b6c8' } })
      );
      await p.getByRole('button', { name: 'Register a site' }).click();
      const d = p.getByRole('dialog');
      await d.locator('label', { hasText: 'Site or app name' }).locator('input').fill('Lakeside Florist shop');
      await d.locator('label', { hasText: 'Client or business name' }).locator('input').fill('Lakeside Florist');
      await d.locator('label', { hasText: 'Domain' }).locator('input').fill('shop.lakesideflorist.com');
      await d.getByRole('button', { name: 'Register and get key' }).click();
      await p.getByRole('dialog', { name: /is registered/ }).waitFor();
    },
    clip: async (p) => pad(await box(p.getByRole('dialog')), 0),
    marks: async (p) => {
      const d = p.getByRole('dialog');
      return [
        await box(d.locator('input[readonly]').locator('xpath=..')),
        await box(d.locator('ol')),
        await box(d.getByRole('button', { name: 'Copy builder prompt' })),
        await box(d.getByRole('button', { name: /saved the key/ })),
      ];
    },
  },
  {
    id: 'sites-pause', vw: 1280, url: '/guide/demo?shot=sites', vh: 1000,
    act: async (p) => {
      const row = p.locator('table tbody tr', { hasText: 'Riverside Gym website' });
      await row.getByRole('radio', { name: 'Paused' }).click();
      const d = p.getByRole('dialog');
      await d.locator('textarea').fill('Invoice 1077 unpaid 30 days after reminders');
      await d.locator('label', { hasText: 'Type PAUSE' }).locator('input').fill('PAUSE');
    },
    clip: async (p) => pad(await box(p.getByRole('dialog')), 0),
    marks: async (p) => {
      const d = p.getByRole('dialog');
      return [
        await box(d.locator('p').first()),
        await box(d.locator('label', { hasText: 'Reason' })),
        await box(d.locator('label', { hasText: 'Type PAUSE' })),
        await box(d.getByRole('button', { name: 'Pause site' })),
      ];
    },
  },
  {
    id: 'vault-shared', vw: 960, url: '/guide/demo?shot=vault-shared', vh: 1600,
    clip: async (p) => pad(await box(p.locator('.card', { hasText: 'Storefront deploy token' })), 12),
    marks: async (p) => {
      const card = p.locator('.card', { hasText: 'Storefront deploy token' });
      return [
        await box(card.getByText(/^Shared by/)),
        union(await box(card.getByText('ghp_…9fQ2')), await box(card.getByRole('button', { name: 'Reveal', exact: true }))),
        await box(card.getByText('Healthy', { exact: true })),
        await box(card.getByRole('button', { name: 'Check' })),
      ];
    },
  },
];

function pad(b, n) {
  return { x: Math.max(0, b.x - n), y: Math.max(0, b.y - n), width: b.width + 2 * n, height: b.height + 2 * n };
}

if (process.argv[2] === '--convert') {
  // PNG -> WebP needs sharp (installed with Next.js).
  const sharp = require('sharp');
  const src = process.argv[3];
  const root = path.join(__dirname, '..');
  (async () => {
    for (const theme of ['dark', 'light']) {
      fs.mkdirSync(path.join(root, 'public/guide', theme), { recursive: true });
      for (const f of fs.readdirSync(path.join(src, theme))) {
        await sharp(path.join(src, theme, f)).webp({ quality: 82 }).toFile(path.join(root, 'public/guide', theme, f.replace(/\.png$/, '.webp')));
      }
    }
    fs.copyFileSync(path.join(src, 'manifest.json'), path.join(root, 'src/lib/guideShots.json'));
    console.log('converted');
  })();
  return;
}

(async () => {
  const only = process.argv[3] ? process.argv[3].split(',') : null;
  const browser = await chromium.launch();
  const manifest = {};
  for (const theme of ['dark', 'light']) {
    for (const s of SHOTS) {
      if (only && !only.includes(s.id)) continue;
      const ctx = await browser.newContext({ viewport: { width: s.vw || 1280, height: s.vh }, deviceScaleFactor: DSF, timezoneId: 'UTC', locale: 'en-US' });
      // Same frozen instant as the server (scripts/fake-now.cjs), so
      // client-side "x min ago" labels match and re-runs are identical.
      await ctx.clock.setFixedTime(new Date(process.env.GUIDE_NOW || '2026-11-18T14:00:00Z'));
      await ctx.addInitScript((t) => { try { localStorage.setItem('unybase-theme', t); } catch (e) {} }, theme);
      const p = await ctx.newPage();
      await p.goto(BASE + s.url, { waitUntil: 'load' });
      await p.waitForTimeout(600);
      if (s.act) await s.act(p);
      await p.waitForTimeout(250);
      const clip = await s.clip(p);
      const marks = await s.marks(p);
      const file = path.join(OUT, theme, `${s.id}.png`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      await p.screenshot({ path: file, clip });
      if (theme === 'dark') {
        manifest[s.id] = {
          w: Math.round(clip.width * DSF),
          h: Math.round(clip.height * DSF),
          marks: marks.map((b) => ({
            x: +(((b.x - clip.x) / clip.width) * 100).toFixed(2),
            y: +(((b.y - clip.y) / clip.height) * 100).toFixed(2),
            w: +((b.width / clip.width) * 100).toFixed(2),
            h: +((b.height / clip.height) * 100).toFixed(2),
          })),
        };
      }
      console.log(theme, s.id, Math.round(clip.width), 'x', Math.round(clip.height), marks.length, 'marks');
      await ctx.close();
    }
  }
  // A partial run (a comma-separated list of shot ids as the second
  // argument) updates just those entries, starting from the existing
  // manifest in OUT, or from src/lib/guideShots.json.
  let full = manifest;
  if (only) {
    const prev = [path.join(OUT, 'manifest.json'), path.join(__dirname, '../src/lib/guideShots.json')].find((f) => fs.existsSync(f));
    full = { ...(prev ? JSON.parse(fs.readFileSync(prev, 'utf8')) : {}), ...manifest };
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(full, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
