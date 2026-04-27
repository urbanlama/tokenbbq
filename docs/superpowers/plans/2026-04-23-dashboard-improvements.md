# Dashboard Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the changes described in `docs/superpowers/specs/2026-04-23-dashboard-improvements-design.md`: re-center the dashboard on tokens (not cost), align popup visuals with the brand palette, and rebuild the two click-through hero charts (Daily Usage Patterns, Monthly Analysis).

**Architecture:** All changes are contained in `src/dashboard.ts`, a ~1640-line file that emits a complete HTML document (including Tailwind via CDN, Chart.js v4 via CDN, and an embedded `<script>` block) from a single exported `renderDashboard(data)` function. Logic changes go into the embedded script. No new files, no new dependencies.

**Tech Stack:** TypeScript (compiled by `tsdown`), Hono server, Chart.js v4, Tailwind CSS (CDN), inline SVG for secondary visuals.

**Verification model:** This project has no frontend test infrastructure. Each task ends with a **manual browser check**: kill and restart the dev server, hard-reload `http://localhost:3000`, observe the specific change. Keep the Chrome DevTools Console open throughout — any new red error is a regression.

---

## Pre-flight

- [ ] **P1: Confirm clean working tree**

Run:
```bash
cd "/c/Users/maxbl/Desktop/Projekte/TokenBBQ"
git status
```
Expected: `nothing to commit, working tree clean` on branch `master`.

- [ ] **P2: Confirm dev server is running**

Run:
```bash
curl -sf http://localhost:3000 | head -1
```
Expected: `<!DOCTYPE html>`. If not, start it: `npm run dev`.

- [ ] **P3: Create a working branch**

Run:
```bash
git checkout -b feat/tokens-focus-and-popup-rebuild
```
Expected: `Switched to a new branch 'feat/tokens-focus-and-popup-rebuild'`.

---

## Phase 1 — Foundations (helpers)

### Task 1: Add `fmtTokens` helper

**Files:**
- Modify: `src/dashboard.ts:363-364`

- [ ] **Step 1: Edit the file**

Locate the existing helpers around line 363:
```js
function fmt(n) { return n.toLocaleString('en-US'); }
function fmtUSD(n) { return '$' + n.toFixed(2); }
```

Insert a new `fmtTokens` function immediately after `fmtUSD`:

```js
function fmt(n) { return n.toLocaleString('en-US'); }
function fmtUSD(n) { return '$' + n.toFixed(2); }
function fmtTokens(n) {
  if (n == null || isNaN(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.round(n).toLocaleString('en-US');
}
```

- [ ] **Step 2: Manual verification via dev console**

Restart server:
```bash
# Kill the background dev process then:
npm run dev
```

In Chrome, reload `http://localhost:3000`. Open DevTools Console and run:
```js
fmtTokens(1596587372)   // expect: "1.6B"
fmtTokens(106924680)    // expect: "106.9M"
fmtTokens(24815)        // expect: "24.8K"
fmtTokens(152)          // expect: "152"
fmtTokens(0)            // expect: "0"
```

All five must match. If any fails, fix `fmtTokens` and re-test.

- [ ] **Step 3: Commit**

```bash
git add src/dashboard.ts
git commit -m "feat: add fmtTokens helper for abbreviated token counts"
```

---

### Task 2: Add `BRAND_COLORS` constant

**Files:**
- Modify: `src/dashboard.ts:344-349` (the top-of-script constants block)

- [ ] **Step 1: Edit the file**

Locate the constants block at the top of the embedded script:
```js
let DATA = ${jsonData};
const SOURCE_COLORS = ${JSON.stringify(SOURCE_COLORS)};
const SOURCE_LABELS = ${JSON.stringify(SOURCE_LABELS)};
const SOURCE_ORDER = ['claude-code', 'codex', 'opencode', 'amp', 'pi'];
const LIVE_REFRESH_MS = 5000;
```

Insert `BRAND_COLORS` immediately after `SOURCE_ORDER`:

```js
let DATA = ${jsonData};
const SOURCE_COLORS = ${JSON.stringify(SOURCE_COLORS)};
const SOURCE_LABELS = ${JSON.stringify(SOURCE_LABELS)};
const SOURCE_ORDER = ['claude-code', 'codex', 'opencode', 'amp', 'pi'];
const BRAND_COLORS = {
  primary: '#E87B35',
  primarySoft: '#E87B3533',
  primaryGhost: '#E87B3510',
  trendUp: '#dc6b5c',
  trendDown: '#74aa9c',
};
const LIVE_REFRESH_MS = 5000;
```

- [ ] **Step 2: Verify**

Restart server, reload page, in Console:
```js
BRAND_COLORS.primary     // "#E87B35"
BRAND_COLORS.trendUp     // "#dc6b5c"
BRAND_COLORS.trendDown   // "#74aa9c"
```

- [ ] **Step 3: Commit**

```bash
git add src/dashboard.ts
git commit -m "feat: add BRAND_COLORS constant for popup accent consistency"
```

---

## Phase 2 — Main dashboard surface (Track 1)

### Task 3: Reorder KPI cards

**Files:**
- Modify: `src/dashboard.ts:244-265`

- [ ] **Step 1: Edit the file**

Replace the entire `<!-- Summary Cards -->` block at lines 243–265 with the new order (Tokens first). The card `id`s and inner value `id`s stay the same so JS bindings continue to work.

Current block:
```html
<!-- Summary Cards -->
<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
    <div id="card-total-cost" class="clickable-card bg-card dark:bg-card light:bg-light-card border border-border dark:border-border light:border-light-border rounded-xl p-5">
      <div class="text-gray-400 text-sm mb-1">Total Cost</div>
      <div class="text-2xl font-bold text-orange-400" id="totalCost"></div>
    </div>
    <div id="card-total-tokens" class="clickable-card bg-card dark:bg-card light:bg-light-card border border-border dark:border-border light:border-light-border rounded-xl p-5">
      <div class="text-gray-400 text-sm mb-1">Total Tokens</div>
      <div class="text-2xl font-bold text-blue-400" id="totalTokens"></div>
    </div>
    <div id="card-active-days" class="clickable-card bg-card dark:bg-card light:bg-light-card border border-border dark:border-border light:border-light-border rounded-xl p-5">
      <div class="text-gray-400 text-sm mb-1">Active Days</div>
      <div class="text-2xl font-bold text-green-400" id="activeDays"></div>
    </div>
    <div id="card-cost-per-day" class="clickable-card bg-card dark:bg-card light:bg-light-card border border-border dark:border-border light:border-light-border rounded-xl p-5">
      <div class="text-gray-400 text-sm mb-1">Cost / Day</div>
      <div class="text-2xl font-bold text-yellow-400" id="costPerDay"></div>
    </div>
    <div id="card-top-model" class="clickable-card bg-card dark:bg-card light:bg-light-card border border-border dark:border-border light:border-light-border rounded-xl p-5">
      <div class="text-gray-400 text-sm mb-1">Top Model</div>
      <div class="text-lg font-bold truncate" id="topModel"></div>
    </div>
  </div>
```

Replace with (Tokens · Cost · Cost/Day · Active Days · Top Model):
```html
<!-- Summary Cards -->
<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
    <div id="card-total-tokens" class="clickable-card bg-card dark:bg-card light:bg-light-card border border-border dark:border-border light:border-light-border rounded-xl p-5">
      <div class="text-gray-400 text-sm mb-1">Total Tokens</div>
      <div class="text-2xl font-bold text-blue-400" id="totalTokens"></div>
    </div>
    <div id="card-total-cost" class="clickable-card bg-card dark:bg-card light:bg-light-card border border-border dark:border-border light:border-light-border rounded-xl p-5">
      <div class="text-gray-400 text-sm mb-1">Total Cost</div>
      <div class="text-2xl font-bold text-orange-400" id="totalCost"></div>
    </div>
    <div id="card-cost-per-day" class="clickable-card bg-card dark:bg-card light:bg-light-card border border-border dark:border-border light:border-light-border rounded-xl p-5">
      <div class="text-gray-400 text-sm mb-1">Cost / Day</div>
      <div class="text-2xl font-bold text-yellow-400" id="costPerDay"></div>
    </div>
    <div id="card-active-days" class="clickable-card bg-card dark:bg-card light:bg-light-card border border-border dark:border-border light:border-light-border rounded-xl p-5">
      <div class="text-gray-400 text-sm mb-1">Active Days</div>
      <div class="text-2xl font-bold text-green-400" id="activeDays"></div>
    </div>
    <div id="card-top-model" class="clickable-card bg-card dark:bg-card light:bg-light-card border border-border dark:border-border light:border-light-border rounded-xl p-5">
      <div class="text-gray-400 text-sm mb-1">Top Model</div>
      <div class="text-lg font-bold truncate" id="topModel"></div>
    </div>
  </div>
```

- [ ] **Step 2: Apply `fmtTokens` to the Total Tokens value**

At `src/dashboard.ts:684`, change:
```js
document.getElementById('totalTokens').textContent = fmt(data.totals.totalTokens);
```
to:
```js
document.getElementById('totalTokens').textContent = fmtTokens(data.totals.totalTokens);
```

- [ ] **Step 3: Verify**

Restart server, reload page.

Visual check:
- KPI row reads left-to-right: **Total Tokens** · **Total Cost** · **Cost / Day** · **Active Days** · **Top Model**.
- Total Tokens value is abbreviated (e.g., `3.9B`, not `3,956,035,205`).
- Click any KPI card — its popup still opens (IDs preserved).

- [ ] **Step 4: Commit**

```bash
git add src/dashboard.ts
git commit -m "feat: reorder KPI cards to Tokens first and abbreviate totalTokens"
```

---

### Task 4: Rename chart titles (Cost → Tokens)

**Files:**
- Modify: `src/dashboard.ts:274` and `src/dashboard.ts:282`

- [ ] **Step 1: Edit**

Line 274, change:
```html
<h2 class="text-lg font-semibold text-white dark:text-white light:text-gray-900 mb-4">Cost by Provider</h2>
```
to:
```html
<h2 class="text-lg font-semibold text-white dark:text-white light:text-gray-900 mb-4">Tokens by Provider</h2>
```

Line 282, change:
```html
<h2 class="text-lg font-semibold text-white dark:text-white light:text-gray-900 mb-4">Top Models by Cost</h2>
```
to:
```html
<h2 class="text-lg font-semibold text-white dark:text-white light:text-gray-900 mb-4">Top Models by Tokens</h2>
```

- [ ] **Step 2: Verify**

Restart server, reload. Donut card shows "Tokens by Provider". Horizontal-bar card shows "Top Models by Tokens".

(Data is still cost-based at this step — the number switch happens in Tasks 5 and 6. The donut and bars will look identical, just re-titled.)

- [ ] **Step 3: Commit**

```bash
git add src/dashboard.ts
git commit -m "feat: rename main charts from Cost to Tokens"
```

---

### Task 5: Switch `renderSourceChart` data from cost to tokens

**Files:**
- Modify: `src/dashboard.ts:772-802`

- [ ] **Step 1: Edit**

Replace the entire `renderSourceChart` function body. The current:
```js
function renderSourceChart(data) {
  if (sourceChartInstance) sourceChartInstance.destroy();
  
  const labels = data.bySource.map(s => SOURCE_LABELS[s.source] || s.source);
  const values = data.bySource.map(s => s.costUSD);
  const colors = data.bySource.map(s => SOURCE_COLORS[s.source] || '#666');
  const total = values.reduce((a, b) => a + b, 0);
  
  sourceChartInstance = new Chart(document.getElementById('sourceChart'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }]
    },
    options: {
      responsive: true,
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15 } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pct = total > 0 ? (ctx.parsed / total) * 100 : 0;
              return ctx.label + ': ' + fmtUSD(ctx.parsed) + ' (' + pct.toFixed(1) + '%)';
            }
          }
        }
      }
    }
  });
}
```

becomes:
```js
function renderSourceChart(data) {
  if (sourceChartInstance) sourceChartInstance.destroy();
  
  const labels = data.bySource.map(s => SOURCE_LABELS[s.source] || s.source);
  const values = data.bySource.map(s => sumTokens(s.tokens));
  const colors = data.bySource.map(s => SOURCE_COLORS[s.source] || '#666');
  const total = values.reduce((a, b) => a + b, 0);
  
  sourceChartInstance = new Chart(document.getElementById('sourceChart'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }]
    },
    options: {
      responsive: true,
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15 } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pct = total > 0 ? (ctx.parsed / total) * 100 : 0;
              return ctx.label + ': ' + fmtTokens(ctx.parsed) + ' (' + pct.toFixed(1) + '%)';
            }
          }
        }
      }
    }
  });
}
```

Changes: `s.costUSD` → `sumTokens(s.tokens)`; `fmtUSD` → `fmtTokens` in the tooltip.

Note: `sumTokens` is already defined elsewhere in `dashboard.ts` (see existing `dailySourceLookup` usage around line 748) — no need to redefine.

- [ ] **Step 2: Verify**

Restart server, reload. Donut "Tokens by Provider": slice proportions change (now reflect token share, not dollar share). Hover a slice — tooltip reads `Claude Code: 3.5B (89.4%)` — token count abbreviated, percent unchanged format.

- [ ] **Step 3: Commit**

```bash
git add src/dashboard.ts
git commit -m "feat: switch Tokens by Provider donut from cost to token data"
```

---

### Task 6: Switch `renderModelChart` data from cost to tokens

**Files:**
- Modify: `src/dashboard.ts:804-851`

- [ ] **Step 1: Edit `getModelChartRows` sort**

At line 825–827:
```js
  return selected
    .slice(0, maxRows)
    .sort((a, b) => b.costUSD - a.costUSD || a.model.localeCompare(b.model));
```

Change to:
```js
  return selected
    .slice(0, maxRows)
    .sort((a, b) => sumTokens(b.tokens) - sumTokens(a.tokens) || a.model.localeCompare(b.model));
```

- [ ] **Step 2: Edit `renderModelChart` function body**

Replace current (lines 830–851):
```js
function renderModelChart(data) {
  if (modelChartInstance) modelChartInstance.destroy();
  
  const top = getModelChartRows(data);
  modelChartInstance = new Chart(document.getElementById('modelChart'), {
    type: 'bar',
    data: {
      labels: top.map(m => shortModel(m.model) + ' · ' + (SOURCE_LABELS[m.source] || m.source)),
      datasets: [{
        data: top.map(m => m.costUSD),
        backgroundColor: top.map(m => SOURCE_COLORS[m.source] || '#6366F1'),
        borderRadius: 4,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmtUSD(ctx.parsed.x) } } },
      scales: { x: { ticks: { callback: v => fmtUSD(Number(v)) } } }
    }
  });
}
```

with:
```js
function renderModelChart(data) {
  if (modelChartInstance) modelChartInstance.destroy();
  
  const top = getModelChartRows(data);
  modelChartInstance = new Chart(document.getElementById('modelChart'), {
    type: 'bar',
    data: {
      labels: top.map(m => shortModel(m.model) + ' · ' + (SOURCE_LABELS[m.source] || m.source)),
      datasets: [{
        data: top.map(m => sumTokens(m.tokens)),
        backgroundColor: top.map(m => SOURCE_COLORS[m.source] || '#6366F1'),
        borderRadius: 4,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmtTokens(ctx.parsed.x) } } },
      scales: { x: { ticks: { callback: v => fmtTokens(Number(v)) } } }
    }
  });
}
```

Changes: `m.costUSD` → `sumTokens(m.tokens)`; both `fmtUSD` → `fmtTokens`.

- [ ] **Step 3: Verify**

Restart server, reload. "Top Models by Tokens": bars reordered by token volume (not cost). X-axis reads `200M`, `400M`, etc. Hover a bar — tooltip `1.5B`. The top model bar is now whichever model has the highest token count (may be the same as before, may differ).

- [ ] **Step 4: Commit**

```bash
git add src/dashboard.ts
git commit -m "feat: switch Top Models chart from cost to tokens, resort by tokens"
```

---

### Task 7: Switch `renderMonthlyChart` data from cost to tokens

**Files:**
- Modify: `src/dashboard.ts:853-877`

- [ ] **Step 1: Edit**

Replace (lines 853–877):
```js
function renderMonthlyChart(data) {
  if (monthlyChartInstance) monthlyChartInstance.destroy();

  monthlyChartInstance = new Chart(document.getElementById('monthlyChart'), {
    type: 'line',
    data: {
      labels: data.monthly.map(m => m.month),
      datasets: [{
        label: 'Cost (USD)',
        data: data.monthly.map(m => m.costUSD),
        borderColor: '#E87B35',
        backgroundColor: '#E87B3522',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#E87B35',
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmtUSD(ctx.parsed.y) } } },
      scales: { y: { ticks: { callback: v => fmtUSD(Number(v)) } } }
    }
  });
}
```

with:
```js
function renderMonthlyChart(data) {
  if (monthlyChartInstance) monthlyChartInstance.destroy();

  monthlyChartInstance = new Chart(document.getElementById('monthlyChart'), {
    type: 'line',
    data: {
      labels: data.monthly.map(m => m.month),
      datasets: [{
        label: 'Tokens',
        data: data.monthly.map(m => sumTokens(m.tokens)),
        borderColor: BRAND_COLORS.primary,
        backgroundColor: BRAND_COLORS.primarySoft,
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: BRAND_COLORS.primary,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmtTokens(ctx.parsed.y) } } },
      scales: { y: { ticks: { callback: v => fmtTokens(Number(v)) } } }
    }
  });
}
```

Changes: `m.costUSD` → `sumTokens(m.tokens)`; label `'Cost (USD)'` → `'Tokens'`; hardcoded `#E87B35*` → `BRAND_COLORS.*`; both `fmtUSD` → `fmtTokens`.

- [ ] **Step 2: Verify**

Restart server, reload. Monthly Trend line: Y-axis reads token values (`500M`, `1B`, `1.5B`). Hover a point — tooltip shows abbreviated tokens. Line color unchanged (orange).

- [ ] **Step 3: Commit**

```bash
git add src/dashboard.ts
git commit -m "feat: switch Monthly Trend from cost to tokens using BRAND_COLORS"
```

---

## Phase 3 — Daily Usage Patterns popup rebuild

### Task 8: Replace sparkline with canvas placeholder + refactor popup content

**Files:**
- Modify: `src/dashboard.ts:1438-1477` (`buildDailyChartPopup`)

- [ ] **Step 1: Rewrite `buildDailyChartPopup`**

Replace the whole function (lines 1438–1477):
```js
function buildDailyChartPopup(data) {
  const daily = data.daily;
  if (!daily.length) return '<div style="color:#6b7280;padding:16px 0">No data in range</div>';
  
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
  
  let html = '';
  html += '<div style="background:rgba(0,0,0,0.2);padding:16px;border-radius:12px;margin:12px 0">'
    + '<div style="font-size:12px;color:#9ca3af;margin-bottom:8px">Token volume timeline</div>';
  if (sorted.length > 2) {
    html += pSparkline(sorted.map(d => sumTokens(d.tokens)), '#60a5fa', 60);
  }
  html += '</div>';

  const weekMap = {};
  daily.forEach(d => {
    const dt = new Date(d.date + 'T12:00:00');
    const mon = new Date(dt);
    mon.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
    const wk = isoDate(mon);
    if (!weekMap[wk]) weekMap[wk] = { tokens: 0 };
    weekMap[wk].tokens += sumTokens(d.tokens);
  });
  const weeks = Object.entries(weekMap).sort();
  const bestWeek = weeks.length ? weeks.reduce((b, w) => w[1].tokens > b[1].tokens ? w : b, weeks[0]) : null;

  html += '<div class="p-stat-grid cols-2">'
    + pStatCard('Avg Daily Tokens', fmt(Math.round(data.totals.totalTokens / Math.max(daily.length, 1))), '#a78bfa')
    + pStatCard('Busiest Week', bestWeek ? fmt(bestWeek[1].tokens) : '0', '#f87171', bestWeek ? 'Week of ' + bestWeek[0] : '')
    + '</div>';

  html += pSection('Token Volume by Day of Week');
  const dow = computeDayOfWeek(daily);
  const maxDow = Math.max(...dow.map(d => d.avgTokens), 1);
  dow.forEach(d => {
    html += pBarRow(d.name, fmt(Math.round(d.avgTokens)), d.avgTokens / maxDow, '#60a5fa');
  });

  return html;
}
```

with:
```js
function buildDailyChartPopup(data) {
  const daily = data.daily;
  if (!daily.length) return '<div style="color:#6b7280;padding:16px 0">No data in range</div>';

  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));

  let html = '';

  // Hero: Area chart with brand-orange gradient (rendered after insertion — see Task 9).
  html += '<div style="background:rgba(0,0,0,0.2);padding:16px;border-radius:12px;margin:12px 0 16px">'
    + '<div style="font-size:12px;color:#9ca3af;margin-bottom:8px">Token volume timeline</div>'
    + '<canvas id="popupDailyChart" height="220" style="max-height:220px"></canvas>'
    + '</div>';

  const weekMap = {};
  daily.forEach(d => {
    const dt = new Date(d.date + 'T12:00:00');
    const mon = new Date(dt);
    mon.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
    const wk = isoDate(mon);
    if (!weekMap[wk]) weekMap[wk] = { tokens: 0 };
    weekMap[wk].tokens += sumTokens(d.tokens);
  });
  const weeks = Object.entries(weekMap).sort();
  const bestWeek = weeks.length ? weeks.reduce((b, w) => w[1].tokens > b[1].tokens ? w : b, weeks[0]) : null;

  const avgDaily = Math.round(data.totals.totalTokens / Math.max(daily.length, 1));
  html += '<div class="p-stat-grid cols-2">'
    + pStatCard('Avg Daily Tokens', fmtTokens(avgDaily), BRAND_COLORS.primary)
    + pStatCard('Busiest Week', bestWeek ? fmtTokens(bestWeek[1].tokens) : '0', SOURCE_COLORS['claude-code'], bestWeek ? 'Week of ' + bestWeek[0] : '')
    + '</div>';

  html += pSection('Token Volume by Day of Week');
  const dow = computeDayOfWeek(daily);
  const maxDow = Math.max(...dow.map(d => d.avgTokens), 1);
  dow.forEach(d => {
    html += pBarRow(d.name, fmtTokens(Math.round(d.avgTokens)), d.avgTokens / maxDow, BRAND_COLORS.primary);
  });

  // Defer chart rendering to after the popup content is inserted — see showPopup hook.
  html += '<script data-popup-hero="daily">'
    + 'window.__popupHeroData = { kind: "daily", values: ' + JSON.stringify(sorted.map(d => sumTokens(d.tokens))) + ', labels: ' + JSON.stringify(sorted.map(d => d.date)) + ' };'
    + '<\\/script>';

  return html;
}
```

Key changes:
- Sparkline `pSparkline(...)` replaced with `<canvas id="popupDailyChart" height="220">`.
- `fmt(...)` calls for tokens replaced with `fmtTokens(...)`.
- Stat-card accent colors switched from `#a78bfa` / `#f87171` to `BRAND_COLORS.primary` / `SOURCE_COLORS['claude-code']`.
- Day-of-week bar color switched from `#60a5fa` to `BRAND_COLORS.primary`.
- A hidden inline script tag stashes the chart data into `window.__popupHeroData` so that Task 9 can pick it up and render the chart.

- [ ] **Step 2: Verify (before Task 9)**

Restart server, reload, click "Daily Token Usage" card.

Expected intermediate state:
- Popup opens.
- Where the sparkline was: a **blank 220px area** (canvas exists but no chart rendered yet — that's Task 9).
- Stat cards: "Avg Daily Tokens" and "Busiest Week" values are abbreviated tokens, accent colors are warm orange/terracotta (not violet/red).
- Day-of-week bars are orange (not blue), labels abbreviated tokens.

If these three are correct, move on. (Do not commit yet — the canvas is empty, half-broken state.)

---

### Task 9: Render the popup hero area chart and manage lifecycle

**Files:**
- Modify: `src/dashboard.ts:1160-1188` (`showPopup` and its close wiring)

- [ ] **Step 1: Declare a top-level holder for the popup chart instance**

Near the other `let ...ChartInstance = null;` declarations around line 351, add:
```js
let popupHeroChart = null;
```

- [ ] **Step 2: Extend `showPopup` to render the hero chart after content insertion**

Replace (lines 1160–1181):
```js
function showPopup(title, contentHtml, sourceEl = null) {
  document.getElementById('popupTitle').textContent = title;
  document.getElementById('popupContent').innerHTML = contentHtml;
  document.getElementById('popupContent').scrollTop = 0;
  
  const box = document.getElementById('popupBox');
  if (sourceEl) {
    const r = sourceEl.getBoundingClientRect();
    const dX = (r.left + r.width / 2) - (window.innerWidth / 2);
    const dY = (r.top + r.height / 2) - (window.innerHeight / 2);
    box.style.setProperty('--tx-x', dX + 'px');
    box.style.setProperty('--tx-y', dY + 'px');
    box.style.setProperty('--tx-s', '0.05');
  } else {
    box.style.setProperty('--tx-x', '0px');
    box.style.setProperty('--tx-y', '20px');
    box.style.setProperty('--tx-s', '0.9');
  }
  
  const overlay = document.getElementById('popupOverlay');
  overlay.classList.add('popup-open');
}
```

with:
```js
function showPopup(title, contentHtml, sourceEl = null) {
  destroyPopupHeroChart();
  document.getElementById('popupTitle').textContent = title;
  document.getElementById('popupContent').innerHTML = contentHtml;
  document.getElementById('popupContent').scrollTop = 0;
  
  const box = document.getElementById('popupBox');
  if (sourceEl) {
    const r = sourceEl.getBoundingClientRect();
    const dX = (r.left + r.width / 2) - (window.innerWidth / 2);
    const dY = (r.top + r.height / 2) - (window.innerHeight / 2);
    box.style.setProperty('--tx-x', dX + 'px');
    box.style.setProperty('--tx-y', dY + 'px');
    box.style.setProperty('--tx-s', '0.05');
  } else {
    box.style.setProperty('--tx-x', '0px');
    box.style.setProperty('--tx-y', '20px');
    box.style.setProperty('--tx-s', '0.9');
  }
  
  const overlay = document.getElementById('popupOverlay');
  overlay.classList.add('popup-open');

  // Render popup hero chart if the builder staged data in window.__popupHeroData
  requestAnimationFrame(() => {
    const stage = window.__popupHeroData;
    if (!stage) return;
    if (stage.kind === 'daily') renderPopupDailyHero(stage);
    else if (stage.kind === 'monthly') renderPopupMonthlyHero(stage);
    window.__popupHeroData = null;
  });
}

function destroyPopupHeroChart() {
  if (popupHeroChart) {
    popupHeroChart.destroy();
    popupHeroChart = null;
  }
}

function renderPopupDailyHero(stage) {
  const canvas = document.getElementById('popupDailyChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0, BRAND_COLORS.primarySoft);
  gradient.addColorStop(1, BRAND_COLORS.primaryGhost);
  popupHeroChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: stage.labels,
      datasets: [{
        label: 'Tokens',
        data: stage.values,
        borderColor: BRAND_COLORS.primary,
        backgroundColor: gradient,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: BRAND_COLORS.primary,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => items[0].label,
            label: ctx => fmtTokens(ctx.parsed.y) + ' tokens'
          }
        }
      },
      scales: {
        x: { ticks: { maxTicksLimit: 8, color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { callback: v => fmtTokens(Number(v)), color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

// Monthly hero implemented in Task 10.
function renderPopupMonthlyHero(stage) { /* filled in Task 10 */ }
```

- [ ] **Step 3: Wire `closePopup` to destroy the chart**

Replace (lines 1182–1184):
```js
function closePopup() {
  document.getElementById('popupOverlay').classList.remove('popup-open');
}
```

with:
```js
function closePopup() {
  document.getElementById('popupOverlay').classList.remove('popup-open');
  destroyPopupHeroChart();
}
```

- [ ] **Step 4: Verify**

Restart server, reload, click "Daily Token Usage".

Expected:
- Hero chart renders: smooth orange line, gradient fill below, ~220px tall.
- Y-axis labels abbreviated (`500M`, etc.).
- X-axis shows max 8 date ticks, not all days crammed in.
- Hover anywhere on the chart — tooltip shows `<date>` + `<tokens> tokens`.
- Close the popup (click outside or press Esc) — no errors in console.
- Open a different popup (e.g., click "Total Cost" KPI) — no stale chart, no errors.
- Open Daily again — chart re-renders cleanly.
- Open and close Daily 10× in a row — no memory warning, no console errors.

- [ ] **Step 5: Commit**

```bash
git add src/dashboard.ts
git commit -m "feat: rebuild Daily Usage Patterns popup with brand-orange area hero chart"
```

---

## Phase 4 — Monthly Analysis popup rebuild

### Task 10: Implement monthly hero bars + rewrite popup content

**Files:**
- Modify: `src/dashboard.ts:1527-1570` (`buildMonthlyChartPopup`)
- Modify: `renderPopupMonthlyHero` stub added in Task 9

- [ ] **Step 1: Rewrite `buildMonthlyChartPopup`**

Replace (lines 1527–1570):
```js
function buildMonthlyChartPopup(data) {
  const months = data.monthly;
  if (!months.length) return '<div style="color:#6b7280;padding:16px 0">No data in range</div>';
  
  let html = '';
  if (months.length > 2) {
    html += '<div style="background:rgba(0,0,0,0.2);padding:16px;border-radius:12px;margin:12px 0">'
      + '<div style="font-size:12px;color:#9ca3af;margin-bottom:8px">Monthly spend trajectory</div>'
      + pSparkline(months.map(m => m.costUSD), '#f87171', 60)
      + '</div>';
  }

  const sortedByCost = [...months].sort((a, b) => b.costUSD - a.costUSD);
  const avgMonthly = months.reduce((s, m) => s + m.costUSD, 0) / months.length;

  html += '<div class="p-stat-grid cols-2">'
    + pStatCard('Avg Monthly Cost', fmtUSD(avgMonthly), '#60a5fa')
    + pStatCard('Peak Month', fmtUSD(sortedByCost[0].costUSD), '#f87171', sortedByCost[0].month)
    + '</div>';

  html += pSection('Month-over-month Analysis');
  
  // Custom bar chart with +/- indicators
  const maxMonthCost = sortedByCost[0].costUSD || 1;
  months.forEach((m, i) => {
    const prev = months[i - 1];
    let changeLabel = '';
    if (prev && prev.costUSD > 0) {
      const g = (m.costUSD - prev.costUSD) / prev.costUSD * 100;
      const col = g >= 0 ? '#f87171' : '#4ade80';
      changeLabel = '<span style="color:' + col + ';font-size:11px;margin-left:8px">' + (g >= 0 ? '↑ ' : '↓ ') + Math.abs(g).toFixed(1) + '%</span>';
    }
    
    html += '<div style="margin-bottom:10px">'
      + '<div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px">'
      + '<div><span style="color:#d1d5db">' + m.month + '</span>' + changeLabel + '</div>'
      + '<strong style="color:#fff">' + fmtUSD(m.costUSD) + '</strong>'
      + '</div>'
      + '<div class="p-bar-track" style="height:5px"><div class="p-bar-fill" style="width:'+(m.costUSD/maxMonthCost*100)+'%;background:#a855f7"></div></div>'
      + '</div>';
  });

  return html;
}
```

with:
```js
function buildMonthlyChartPopup(data) {
  const months = data.monthly;
  if (!months.length) return '<div style="color:#6b7280;padding:16px 0">No data in range</div>';

  const monthsTok = months.map(m => sumTokens(m.tokens));
  const monthsCost = months.map(m => m.costUSD);

  // Compute month-over-month change using tokens
  const changes = monthsTok.map((t, i) => {
    if (i === 0) return null;
    const prev = monthsTok[i - 1];
    if (prev <= 0) return null;
    return (t - prev) / prev * 100;
  });

  let html = '';

  // Hero: thick vertical bars (rendered after insertion — see renderPopupMonthlyHero in Task 9 + patch below)
  html += '<div style="background:rgba(0,0,0,0.2);padding:16px;border-radius:12px;margin:12px 0 16px">'
    + '<div style="font-size:12px;color:#9ca3af;margin-bottom:8px">Monthly token volume</div>'
    + '<canvas id="popupMonthlyChart" height="240" style="max-height:240px"></canvas>'
    + '</div>';

  const sortedByTok = [...months].map((m, i) => ({ m, t: monthsTok[i] })).sort((a, b) => b.t - a.t);
  const avgMonthlyTok = monthsTok.reduce((s, t) => s + t, 0) / months.length;

  html += '<div class="p-stat-grid cols-2">'
    + pStatCard('Avg Monthly Tokens', fmtTokens(Math.round(avgMonthlyTok)), BRAND_COLORS.primary)
    + pStatCard('Peak Month', fmtTokens(sortedByTok[0].t), SOURCE_COLORS['claude-code'], sortedByTok[0].m.month)
    + '</div>';

  html += pSection('Month-over-month Analysis');

  const maxMonthTok = Math.max(...monthsTok, 1);
  months.forEach((m, i) => {
    const tok = monthsTok[i];
    const g = changes[i];
    let changeLabel = '';
    if (g != null) {
      const up = g >= 0;
      const col = up ? BRAND_COLORS.trendUp : BRAND_COLORS.trendDown;
      changeLabel = '<span style="color:' + col + ';font-size:11px;margin-left:8px">' + (up ? '↑ ' : '↓ ') + Math.abs(g).toFixed(1) + '%</span>';
    }

    html += '<div style="margin-bottom:10px">'
      + '<div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px">'
      + '<div><span style="color:#d1d5db">' + m.month + '</span>' + changeLabel + '</div>'
      + '<strong style="color:#fff">' + fmtTokens(tok) + '</strong>'
      + '</div>'
      + '<div class="p-bar-track" style="height:5px"><div class="p-bar-fill" style="width:' + (tok / maxMonthTok * 100) + '%;background:' + BRAND_COLORS.primary + '"></div></div>'
      + '</div>';
  });

  // Stage hero data for showPopup to pick up
  html += '<script data-popup-hero="monthly">'
    + 'window.__popupHeroData = { kind: "monthly", labels: ' + JSON.stringify(months.map(m => m.month)) + ', tokens: ' + JSON.stringify(monthsTok) + ', costs: ' + JSON.stringify(monthsCost) + ', changes: ' + JSON.stringify(changes) + ' };'
    + '<\\/script>';

  return html;
}
```

Key changes:
- Sparkline dropped; replaced with `<canvas id="popupMonthlyChart" height="240">`.
- Stat cards: "Avg Monthly Cost" → "Avg Monthly Tokens" (`fmtTokens`, `BRAND_COLORS.primary`); "Peak Month" now keyed on tokens.
- MoM row list: values via `fmtTokens`, bar fill `BRAND_COLORS.primary`, change arrows via `BRAND_COLORS.trendUp`/`.trendDown`.
- No more `#f87171`, `#60a5fa`, `#4ade80`, `#a855f7` in this function.

- [ ] **Step 2: Replace the `renderPopupMonthlyHero` stub with real implementation**

Replace:
```js
// Monthly hero implemented in Task 10.
function renderPopupMonthlyHero(stage) { /* filled in Task 10 */ }
```

with:
```js
function renderPopupMonthlyHero(stage) {
  const canvas = document.getElementById('popupMonthlyChart');
  if (!canvas) return;
  popupHeroChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: stage.labels,
      datasets: [{
        label: 'Tokens',
        data: stage.tokens,
        backgroundColor: BRAND_COLORS.primary,
        hoverBackgroundColor: '#F09147',
        borderRadius: 6,
        borderSkipped: false,
        barPercentage: 0.72,
        categoryPercentage: 0.9,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => items[0].label,
            label: ctx => {
              const i = ctx.dataIndex;
              const tokLabel = fmtTokens(stage.tokens[i]) + ' tokens';
              const costLabel = fmtUSD(stage.costs[i]);
              const g = stage.changes[i];
              const gLabel = g == null ? '' : ' · ' + (g >= 0 ? '↑' : '↓') + ' ' + Math.abs(g).toFixed(1) + '%';
              return tokLabel + ' · ' + costLabel + gLabel;
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: '#9ca3af' }, grid: { display: false } },
        y: { ticks: { callback: v => fmtTokens(Number(v)), color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}
```

- [ ] **Step 3: Verify**

Restart server, reload, click "Monthly Trend".

Expected:
- Popup opens with a thick-bars chart as hero (~240px tall). One orange bar per month. Rounded top corners.
- Y-axis abbreviated token values. X-axis shows month labels (`2026-03`, `2026-04`).
- Hover a bar — tooltip reads e.g. `1.6B tokens · $2318.90 · ↑ 207.7%`. Cost is USD non-abbreviated.
- Below the chart: stat cards "Avg Monthly Tokens" and "Peak Month" with token values, warm orange/terracotta accents.
- Below that: row list with per-month bars in orange, values in `fmtTokens`, arrow change in terracotta (up) or sage (down).
- No blue, violet, or bright green anywhere in this popup.
- Close and reopen 5× — no leak, no console errors.

- [ ] **Step 4: Commit**

```bash
git add src/dashboard.ts
git commit -m "feat: rebuild Monthly Analysis popup with thick-bars hero and token focus"
```

---

## Final acceptance

- [ ] **F1: Cross-check against spec**

Open `docs/superpowers/specs/2026-04-23-dashboard-improvements-design.md` side-by-side with the running dashboard. For each item in the three Tracks and in "Testing", confirm visually.

Minimum matrix:
- Header KPI order: `Total Tokens · Total Cost · Cost/Day · Active Days · Top Model` ✓
- Total Tokens value abbreviated ✓
- Donut titled "Tokens by Provider", slices token-based ✓
- Horizontal bars titled "Top Models by Tokens", sorted by tokens ✓
- Monthly line shows tokens with abbreviated Y-axis ✓
- Daily popup: orange area hero, brand-colored stat cards, orange day-of-week bars, all numbers `fmtTokens` ✓
- Monthly popup: orange thick-bars hero, token stat cards, orange row bars, terracotta/sage MoM arrows ✓
- Daily Breakdown table unchanged ✓
- No Tailwind-accent colors (`#60a5fa`, `#a78bfa`, `#a855f7`, `#f87171`, `#4ade80`) remain in the two modified popups (use browser search in DevTools `Sources` panel on the rendered inline script) ✓
- Light-mode toggle still works ✓

- [ ] **F2: Run the build as a smoke check**

```bash
npm run lint
```
Expected: exits 0, no type errors.

```bash
npm run build
```
Expected: exits 0, produces `dist/index.js`.

- [ ] **F3: Push the branch to the fork**

```bash
git push -u origin feat/tokens-focus-and-popup-rebuild
```

Expected: branch created on `urbanlama/tokenbbq`. The user can decide later whether to merge to their master or open a PR against `offbyone1/tokenbbq`.

---

## Self-review record

**Spec coverage:**
- Track 1 KPI reorder → Task 3 ✓
- Track 1 three charts cost→tokens → Tasks 5, 6, 7 ✓
- Track 1 title renames → Task 4 ✓
- Track 2 `fmtTokens` helper → Task 1 ✓ (applied across all modified sites in later tasks)
- Track 2 `BRAND_COLORS` → Task 2 ✓ (applied across all modified sites)
- Track 2 no popup accents `#60a5fa`/`#a78bfa`/`#a855f7`/`#f87171`/`#4ade80` in scope → Tasks 8, 10 ✓
- Track 3 Daily popup rebuild with Area hero → Tasks 8, 9 ✓
- Track 3 Monthly popup rebuild with thick bars → Task 10 ✓
- Track 3 popup chart lifecycle → Task 9 ✓
- Spec Testing § items → F1 matrix ✓

**Placeholder scan:** no TBDs, all code blocks complete, all colors specified, all selectors named.

**Type/name consistency:** `popupHeroChart`, `destroyPopupHeroChart`, `renderPopupDailyHero`, `renderPopupMonthlyHero`, `window.__popupHeroData` used consistently across Tasks 8, 9, 10. `BRAND_COLORS.primary` / `.primarySoft` / `.primaryGhost` / `.trendUp` / `.trendDown` keys match definition in Task 2. `sumTokens`, `fmtTokens`, `fmtUSD`, `pStatCard`, `pSection`, `pBarRow`, `pctStr` all reference existing or newly defined symbols.
