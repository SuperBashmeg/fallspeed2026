import { html, render, useState, useEffect, useMemo, useRef } from './vendor/preact-htm.mjs';
import * as C from './config.js';
import { loadData } from './data.js';

// ---------- formatting ----------
const p2 = (n) => String(n).padStart(2, '0');
const fmt = (ms) => ms == null ? '—' : Math.floor(ms / 60000) + ':' + p2(Math.floor(ms % 60000 / 1000)) + '.' + String(ms % 1000).padStart(3, '0');
const short = (a) => a < 60000 ? (a / 1000).toFixed(3) : fmt(a);
const fgap = (ms) => ms === 0 ? '—' : '+' + short(ms);
const by = (author) => author ? 'by ' + author : '';
const plural = (n) => n + (n === 1 ? ' player' : ' players');

const ACCENT = 'var(--accent)';
const MEDALS = [['Author', '#3ddc97'], ['Gold', '#f5c542'], ['Silver', '#c7ced6'], ['Bronze', '#d08a52']];

// ---------- persistence + routing ----------
const BASE_KEY = 'fs26.base';
const loadBase = () => { try { return localStorage.getItem(BASE_KEY) || null; } catch { return null; } };
const saveBase = (name) => { try { name ? localStorage.setItem(BASE_KEY, name) : localStorage.removeItem(BASE_KEY); } catch { /* storage blocked */ } };

const HASH = { board: '#leaderboard', maps: '#maps', h2h: '#head-to-head' };
const viewFromHash = () => Object.keys(HASH).find((k) => HASH[k] === location.hash) || null;

const useNow = (ms) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
};

// ---------- model ----------
function buildModel(data) {
  const MAPS = data.maps.map((m) => {
    const cfg = C.MAPS.find((c) => c.name.trim().toLowerCase() === m.name.toLowerCase());
    return { name: m.name, author: cfg?.author || '', img: cfg?.img || C.FALLBACK_MAP_IMG, medals: cfg?.medals || [] };
  });
  const ps = data.players.map((r, i) => {
    const miss = r.times.filter((x) => x == null).length;
    const sum = r.times.reduce((a, x) => a + (x ?? 0), 0);
    return { id: r.name, name: r.name, flag: r.flag, t: r.times, r: [], miss, sum, score: sum + miss * C.MISSING_PENALTY_MS, order: i };
  });
  const bySeed = ps.slice().sort((a, b) => a.score - b.score || a.order - b.order);
  bySeed.forEach((p, i) => { p.seed = i + 1; });
  const ranks = MAPS.map((_, mi) => {
    const fin = ps.filter((p) => p.t[mi] != null).sort((a, b) => a.t[mi] - b.t[mi] || a.seed - b.seed);
    fin.forEach((p, i) => { p.r[mi] = i + 1; });
    return fin;
  });
  const byId = new Map(ps.map((p) => [p.id, p]));
  const byName = (q) => {
    const k = String(q || '').trim().toLowerCase();
    return k ? ps.find((p) => p.name.toLowerCase() === k) || null : null;
  };
  return { MAPS, NM: MAPS.length, ps, bySeed, ranks, byId, byName, leader: bySeed[0], hasFlags: ps.some((p) => p.flag) };
}

// ---------- small pieces ----------
// The flag image the organizers put in the sheet. The sheet only exposes the image (not the country
// name), so it is decorative; a blank placeholder keeps names aligned for players without a flag.
function Flag({ p, model, large }) {
  const cls = 'flag' + (large ? ' flag-lg' : '');
  if (!p.flag) return model.hasFlags ? html`<span class=${cls + ' flag-none'} aria-hidden="true"></span>` : null;
  return html`<img class=${cls} src=${p.flag} alt="" loading="lazy" referrerpolicy="no-referrer" />`;
}

const XIcon = () => html`<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const Logo = ({ size = 26 }) => html`<svg width=${size} height=${size} viewBox="0 0 26 26" aria-hidden="true"><path d="M13 2c5 4 8 8 8 12a8 8 0 0 1-16 0c0-4 3-8 8-12z" fill="var(--accent)"></path><path d="M13 9v15" stroke="var(--bg)" stroke-width="2"></path></svg>`;
const BaseTag = ({ big }) => html`<span class=${'tag tag-base' + (big ? ' tag-lg' : '')}>${big ? 'Comparison base' : 'BASE'}</span>`;

// ---------- hero (ticks every second on its own) ----------
function Hero({ closes, mapCount }) {
  const now = useNow(1000);
  const left = Math.max(0, closes - now);
  const closed = left === 0;
  const countdown = [
    [Math.floor(left / 864e5), 'days'], [Math.floor(left / 36e5) % 24, 'hours'],
    [Math.floor(left / 6e4) % 60, 'min'], [Math.floor(left / 1e3) % 60, 'sec'],
  ];
  const cd = new Date(closes);
  const evs = [
    { label: 'Seeding closes', date: cd.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) + ' · ' + p2(cd.getUTCHours()) + ':' + p2(cd.getUTCMinutes()) + ' UTC', end: closes },
    ...C.MATCH_DAYS,
  ];
  const nextIdx = evs.findIndex((e) => now < e.end);

  return html`
  <section class="hero">
    <div class="hero-text">
      <div class="stack-14">
        <p class="eyebrow">Trackmania · Seeding phase<span class="phase"><span class="dot"></span>${closed ? 'Seeding closed' : 'Seeding open'}</span></p>
        <h1 class="hero-title">FallSpeed <span class="acc">2026</span></h1>
        <p class="hero-lede">Seeding is time attack on ${mapCount} maps. Your seed comes from the sum of your best times. Lower is better.</p>
      </div>
      <div class="stack-12">
        <p class="label">${closed ? 'Seeding has closed' : 'Seeding closes in'}</p>
        <div class="countdown" role="timer" aria-live="off">
          ${countdown.map(([v, unit]) => html`<div class="cd-box"><span class="cd-val">${p2(v)}</span><span class="cd-unit">${unit}</span></div>`)}
        </div>
      </div>
      <ol class="schedule" aria-label="Schedule">
        ${evs.map((e, i) => {
          const done = now >= e.end, next = i === nextIdx;
          return html`<li class=${'ev' + (done ? ' is-done' : next ? ' is-next' : '')}>
            <span class="ev-chip">${done ? 'Done' : next ? 'Next' : 'Upcoming'}</span>
            <span class="ev-title">${e.label}</span>
            <span class="ev-date">${e.date}</span>
          </li>`;
        })}
      </ol>
    </div>
    <figure class="hero-art">
      <img src="assets/fallspeed-art.webp" alt="FallSpeed 2026 official art: a skull driving a red car down an autumn road at sunset" width="520" height="520" />
      <figcaption>Official event art</figcaption>
    </figure>
  </section>`;
}

// ---------- app ----------
function App() {
  const [st, setSt] = useState(() => {
    const saved = loadBase();
    return { view: viewFromHash() || 'board', meId: saved, meQuery: saved || '', search: '', sortKey: 'seed', sortDir: 1,
      mapIdx: 0, showMissing: true, aId: null, bId: null, aQ: null, bQ: null, profileId: null, scrollReq: 0 };
  });
  const set = (o) => setSt((s) => ({ ...s, ...o }));
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const now = useNow(30000);
  const lastFocus = useRef(null);
  const closeBtn = useRef(null);

  // ---- data loading + auto refresh ----
  const refresh = async () => {
    setLoading(true);
    try { setData(await loadData()); setError(null); }
    catch (e) { setError(e?.message || String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    refresh();
    const t = setInterval(() => { if (!document.hidden) refresh(); }, C.REFRESH_MS);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const onVis = () => { if (!document.hidden && data && Date.now() - data.fetchedAt > C.REFRESH_MS) refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [data]);

  // ---- routing ----
  useEffect(() => {
    const onPop = () => { const v = viewFromHash(); if (v) set({ view: v }); };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    const h = HASH[st.view];
    if (location.hash === h) return;
    if (viewFromHash()) history.pushState(null, '', h); else history.replaceState(null, '', h);
  }, [st.view]);
  useEffect(() => {
    if (!st.scrollReq) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('fs-view')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, [st.scrollReq]);
  // Switch view and scroll it into sight (the views sit below the hero).
  const go = (view, extra) => () => setSt((s) => ({ ...s, view, ...extra, scrollReq: s.scrollReq + 1 }));

  // ---- comparison base persistence ----
  useEffect(() => { if (st.meId || !st.meQuery) saveBase(st.meId); }, [st.meId]);

  // ---- profile dialog: focus, Escape, scroll lock ----
  useEffect(() => {
    if (st.profileId == null) {
      document.body.style.overflow = '';
      if (lastFocus.current?.isConnected) lastFocus.current.focus();
      lastFocus.current = null;
      return;
    }
    if (!lastFocus.current) lastFocus.current = document.activeElement;
    document.body.style.overflow = 'hidden';
    closeBtn.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') set({ profileId: null }); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [st.profileId]);

  const model = useMemo(() => data ? buildModel(data) : null, [data]);
  const closes = data?.closes || C.SEEDING_CLOSE_FALLBACK;
  const mapCount = model ? model.NM : C.MAPS.length;
  const view = st.view;

  const me = model && st.meId ? model.byId.get(st.meId) || null : null;
  const onMe = (e) => {
    const v = e.target.value;
    const m = model?.byName(v);
    set({ meQuery: v, meId: m ? m.id : v ? st.meId : null });
  };
  const clearMe = () => set({ meQuery: '', meId: null });

  const nav = [['board', 'Leaderboard'], ['maps', 'Maps'], ['h2h', 'Head to head']];

  return html`
  <div class="page">
    ${model && html`<datalist id="fs-players">${model.bySeed.map((p) => html`<option key=${p.id} value=${p.name}></option>`)}</datalist>`}

    <header class="topbar">
      <div class="wrap topbar-in">
        <a href="#top" class="brand"><${Logo} /><span class="brand-word">FALLSPEED<span class="acc"> 26</span></span></a>
        <nav class="nav" aria-label="Sections">
          ${nav.map(([k, label]) => html`<button class=${'btn pill nav-btn' + (view === k ? ' is-on' : '')} type="button" onClick=${go(k)} aria-current=${view === k ? 'page' : 'false'}>${label}</button>`)}
        </nav>
        <div class="base-pick">
          <label for="fs-me">Compare against</label>
          <input id="fs-me" class=${'in base-in' + (me ? ' is-set' : '')} list="fs-players" value=${st.meQuery} onInput=${onMe} placeholder="Pick a base player" autocomplete="off" />
          ${me && html`<button class="btn icon-btn" type="button" onClick=${clearMe} aria-label="Clear comparison base"><${XIcon} /></button>`}
        </div>
      </div>
    </header>

    <main id="top" class="wrap">
      <${Hero} closes=${closes} mapCount=${mapCount} />
      ${model ? html`
        <${MapStrip} model=${model} openMap=${(i) => go('maps', { mapIdx: i })} />
        <div id="fs-view" class="view-anchor">
          ${view === 'board' && html`<${Board} model=${model} st=${st} set=${set} me=${me} clearMe=${clearMe} data=${data} now=${now} error=${error} loading=${loading} />`}
          ${view === 'maps' && html`<${MapBoards} model=${model} st=${st} set=${set} me=${me} />`}
          ${view === 'h2h' && html`<${HeadToHead} model=${model} st=${st} set=${set} me=${me} />`}
        </div>
      ` : html`<${LoadState} error=${error} loading=${loading} retry=${refresh} />`}
    </main>

    <footer class="footer">
      <div class="wrap footer-in">
        <div class="footer-text">
          <p class="brand-word">FALLSPEED<span class="acc"> 26</span></p>
          <p class="muted">Unofficial fan-made site. Data from the official FallSpeed 2026 <a href=${C.LINKS.spreadsheet} target="_blank" rel="noopener">spreadsheet</a>.</p>
        </div>
        <nav class="footer-links" aria-label="Official links">
          ${[['Discord', C.LINKS.discord], ['Rulebook', C.LINKS.rulebook], ['Spreadsheet', C.LINKS.spreadsheet]]
            .filter(([, href]) => href)
            .map(([label, href]) => html`<a class="pill-link" href=${href} target="_blank" rel="noopener">${label}</a>`)}
        </nav>
      </div>
    </footer>

    ${model && st.profileId != null && model.byId.get(st.profileId) && html`
      <${Profile} model=${model} P=${model.byId.get(st.profileId)} base=${me} set=${set} closeBtn=${closeBtn}
        toH2H=${(a, b) => go('h2h', { aId: a.id, aQ: a.name, bId: b.id, bQ: b.name, profileId: null })()} />`}
  </div>`;
}

function LoadState({ error, loading, retry }) {
  if (error) return html`
    <section class="panel state" role="alert">
      <p class="state-title">Couldn't load the spreadsheet</p>
      <p class="muted">${error}</p>
      <button class="btn pill pill-solid" type="button" onClick=${retry} disabled=${loading}>${loading ? 'Retrying…' : 'Try again'}</button>
    </section>`;
  return html`<section class="panel state" aria-busy="true"><span class="spinner" aria-hidden="true"></span><p class="muted">Loading live data from the spreadsheet…</p></section>`;
}

// ---------- maps strip ----------
function MapStrip({ model, openMap }) {
  const { MAPS, ranks, ps } = model;
  return html`
  <section aria-labelledby="fs-maps-h" class="maps-strip">
    <div class="sec-head">
      <h2 id="fs-maps-h" class="h2">The maps</h2>
      <p class="hint">Select a map to see its leaderboard</p>
    </div>
    <div class="map-grid">
      ${MAPS.map((m, i) => {
        const top = ranks[i][0];
        return html`
        <button class="btn map-card" type="button" onClick=${openMap(i)}>
          <span class="map-card-img"><img src=${m.img} alt="" loading="lazy" /></span>
          <span class="map-card-body">
            <span class="stack-2">
              <span class="map-card-name">${m.name}</span>
              ${m.author && html`<span class="by">by <span class="author">${m.author}</span></span>`}
            </span>
            <span class="map-card-stats">
              <span>Best <span class="mono hi">${top ? fmt(top.t[i]) : '—'}</span> ${top ? '· ' + top.name : ''}</span>
              <span>${ranks[i].length}/${ps.length} finished</span>
            </span>
            ${m.medals.length > 0 && html`
            <span class="medal-grid">
              ${m.medals.map((t, k) => html`<span class="medal-cell"><span class="medal-dot" style=${{ background: MEDALS[k][1] }}></span>${MEDALS[k][0]}<span class="mono hi push">${fmt(t)}</span></span>`)}
            </span>`}
          </span>
        </button>`;
      })}
    </div>
  </section>`;
}

// comparison delta of t vs base time bt
function deltaVs(me, p, t, bt) {
  if (!me || p.id === me.id || t == null || bt == null) return null;
  const d = t - bt;
  const s = short(Math.abs(d));
  return d === 0 ? { text: '0.000', color: 'var(--text)' } : d < 0 ? { text: '-' + s, color: 'var(--green)' } : { text: '+' + s, color: 'var(--red)' };
}

// ---------- global leaderboard ----------
function Board({ model, st, set, me, clearMe, data, now, error, loading }) {
  const { MAPS, NM, ps, leader } = model;
  const topN = C.TOP_SEEDS, cut = C.QUALIFY_CUT;
  const { sortKey, sortDir: dir } = st;
  const sortBy = (k) => () => set({ sortKey: k, sortDir: sortKey === k ? -dir : 1 });
  const head = (k) => ({
    sort: sortBy(k), arrow: sortKey === k ? (dir === 1 ? '↑' : '↓') : '',
    aria: sortKey === k ? (dir === 1 ? 'ascending' : 'descending') : 'none',
    color: sortKey === k ? ACCENT : 'var(--muted)',
  });
  const val = (p, k) => k === 'seed' ? p.seed : k === 'name' ? p.name.toLowerCase() : k === 'total' ? p.score : p.t[+k.slice(1)];
  const q = st.search.trim().toLowerCase();
  const list = ps.filter((p) => !q || p.name.toLowerCase().includes(q)).sort((a, b) => {
    const va = val(a, sortKey), vb = val(b, sortKey);
    if (va == null && vb == null) return a.seed - b.seed;
    if (va == null) return 1;
    if (vb == null) return -1;
    return (va < vb ? -1 : va > vb ? 1 : a.seed - b.seed) * (va === vb ? 1 : dir);
  });

  const updated = data.updated || data.fetchedAt;
  const mins = Math.max(0, Math.round((now - updated) / 6e4));
  const updatedRel = mins < 1 ? 'just now' : mins < 60 ? mins + ' min ago' : mins < 1440 ? Math.floor(mins / 60) + ' h ago' : Math.floor(mins / 1440) + ' d ago';
  const ud = new Date(updated);
  const updatedText = ud.toLocaleString('en-GB', { month: 'short', day: 'numeric', timeZone: 'UTC' }) + ', ' + p2(ud.getUTCHours()) + ':' + p2(ud.getUTCMinutes()) + ' UTC';

  const gridCols = `64px minmax(170px, 1.5fr) repeat(${NM}, minmax(118px, 1fr)) minmax(120px, 1fr) 84px`;
  const tableMin = (64 + 170 + NM * 118 + 120 + 84 + (NM + 4) * 12 + 36) + 'px';
  const hs = head('seed'), hn = head('name'), ht = head('total');

  const rows = list.map((p, i) => {
    const isMe = !!me && p.id === me.id;
    const out = p.seed > cut;
    const seedCls = p.seed <= 3 ? 'seed-top3' : p.seed <= topN ? 'seed-topn' : p.seed <= cut ? '' : 'seed-out';
    const td = !p.miss && me && !me.miss ? deltaVs(me, p, p.score, me.score) : null;
    const next = list[i + 1];
    return html`
    <div key=${p.id} role="row" class=${'row fs-row' + (isMe ? ' is-me' : out ? ' is-out' : p.seed <= topN && !p.miss ? ' is-top' : '')} style=${{ gridTemplateColumns: gridCols }}>
      <div role="cell"><span class=${'seed ' + seedCls}>${p.seed}</span></div>
      <div role="cell" class="name-cell">
        <${Flag} p=${p} model=${model} />
        <button class="btn fs-name" type="button" onClick=${() => set({ profileId: p.id })} aria-label=${'Open profile of ' + p.name}>${p.name}</button>
        ${isMe && html`<${BaseTag} />`}
        ${p.miss > 0 && html`<span class="tag tag-outline">${(NM - p.miss) + '/' + NM + ' maps'}</span>`}
      </div>
      ${MAPS.map((_, mi) => {
        const t = p.t[mi];
        if (t == null) return html`<div role="cell" class="tcell"><span class="t none">—</span><span class="tsub">no time</span></div>`;
        const r = p.r[mi];
        const dd = deltaVs(me, p, t, me && me.t[mi]);
        if (dd) return html`<div role="cell" class="tcell"><span class="t">${fmt(t)}</span><span class="tsub strong" style=${{ color: dd.color }}>${dd.text}</span></div>`;
        return html`<div role="cell" class="tcell"><span class=${'t' + (r === 1 ? ' best' : '')}>${fmt(t)}</span><span class="tsub">#${r} on map</span></div>`;
      })}
      <div role="cell" class="tcell">
        <span class=${'t total' + (p.miss ? ' none' : '')}>${p.miss ? fmt(p.sum) : fmt(p.score)}</span>
        ${td ? html`<span class="tsub strong" style=${{ color: td.color }}>${td.text}</span>` : html`<span class="tsub">${p.miss ? 'penalized' : ''}</span>`}
      </div>
      <div role="cell" class="gap">${p.miss ? '—' : fgap(p.score - leader.score)}</div>
    </div>
    ${p.seed === cut && next && next.seed === cut + 1 && html`
    <div key=${'cut'} role="row" class="cut-row">
      <span class="dash red"></span><span role="cell" class="cut-label">Seeding cut · top ${cut} advance</span><span class="dash red"></span>
    </div>`}`;
  });

  return html`
  <section aria-labelledby="fs-board-h" class="view">
    <div class="board-head">
      <div class="stack-4">
        <h2 id="fs-board-h" class="h2">Global leaderboard</h2>
        <p class="hint">${ps.length} players · Last updated <time datetime=${ud.toISOString()} class="soft">${updatedText}</time> (${updatedRel})${loading ? ' · refreshing…' : error ? ' · couldn\'t refresh, showing last data' : ''}</p>
      </div>
      <div class="search">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.6"></circle><path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path></svg>
        <label for="fs-search" class="sr-only">Search players</label>
        <input id="fs-search" class="in" type="search" value=${st.search} onInput=${(e) => set({ search: e.target.value })} placeholder="Search players" autocomplete="off" />
      </div>
    </div>

    ${me && html`
    <div class="base-banner">
      <span>Times shown as delta to <strong class="acc">${me.name}</strong></span>
      <span class="mono strong" style="color: var(--green)">-0.000 faster</span>
      <span class="mono strong" style="color: var(--red)">+0.000 slower</span>
      <button class="btn pill pill-sm push" type="button" onClick=${clearMe}>Show plain times</button>
    </div>`}

    <div class="scroll table">
      <div role="table" aria-label="Global leaderboard" style=${{ minWidth: tableMin }}>
        <div role="row" class="row head-row" style=${{ gridTemplateColumns: gridCols }}>
          <div role="columnheader" aria-sort=${hs.aria}><button class="btn th" type="button" onClick=${hs.sort} style=${{ color: hs.color }}>Seed ${hs.arrow}</button></div>
          <div role="columnheader" aria-sort=${hn.aria}><button class="btn th" type="button" onClick=${hn.sort} style=${{ color: hn.color }}>Player ${hn.arrow}</button></div>
          ${MAPS.map((m, i) => {
            const h = head('m' + i);
            return html`<div role="columnheader" aria-sort=${h.aria} style="min-width: 0"><button class="btn th th-map" type="button" onClick=${h.sort} title=${m.name + (m.author ? ' by ' + m.author : '')} style=${{ color: h.color }}><span class="th-map-name">${m.name} ${h.arrow}</span><span class="th-map-by">${by(m.author)}</span></button></div>`;
          })}
          <div role="columnheader" aria-sort=${ht.aria} class="right"><button class="btn th" type="button" onClick=${ht.sort} style=${{ color: ht.color }}>Total ${ht.arrow}</button></div>
          <div role="columnheader" class="right th th-static">Gap</div>
        </div>
        ${rows}
        ${rows.length === 0 && html`<p class="empty">No player matches “${st.search}”.</p>`}
      </div>
    </div>
    <p class="legend">
      <span class="legend-item"><span class="sw sw-top3"></span>Top 3</span>
      <span class="legend-item"><span class="sw sw-topn"></span>Top ${topN}</span>
      <span class="legend-item"><span class="sw sw-out"></span>Outside top ${cut}, does not advance</span>
      <span>— means no time on that map yet. A missing map is heavily penalized, so those players rank last.</span>
    </p>
  </section>`;
}

// ---------- per-map leaderboards ----------
function MapBoards({ model, st, set, me }) {
  const { MAPS, NM, ps, ranks } = model;
  const mapIdx = Math.max(0, Math.min(st.mapIdx || 0, NM - 1));
  const map = MAPS[mapIdx];
  const fin = ranks[mapIdx];
  const best = fin[0] ? fin[0].t[mapIdx] : 0;
  const medalList = map.medals.map((t, k) => ({ name: MEDALS[k][0], color: MEDALS[k][1], t }));
  const medalOf = (t) => t == null ? null : medalList.find((m) => t <= m.t) || null;
  const medalCount = (m) => fin.filter((p) => p.t[mapIdx] <= m.t).length;
  const cols = { gridTemplateColumns: 'var(--map-cols)' };

  const rowFor = (p, i) => {
    const t = p.t[mapIdx];
    const isMe = !!me && p.id === me.id;
    const mdl = medalOf(t);
    const md = deltaVs(me, p, t, me && me.t[mapIdx]);
    return html`
    <div key=${p.id} role="row" class=${'row fs-row' + (isMe ? ' is-me' : '')} style=${cols}>
      <div role="cell"><span class=${'seed' + (i < 3 ? ' seed-top3' : '')}>${i + 1}</span></div>
      <div role="cell" class="name-cell">
        <${Flag} p=${p} model=${model} />
        <button class="btn fs-name" type="button" onClick=${() => set({ profileId: p.id })} aria-label=${'Open profile of ' + p.name}>${p.name}</button>
        ${isMe && html`<${BaseTag} />`}
      </div>
      <div role="cell" class="mtime" style=${{ color: md ? md.color : i === 0 ? ACCENT : 'var(--text)' }}>
        ${mdl && html`<span class="medal-dot" title=${mdl.name + ' medal'} style=${{ background: mdl.color }}></span><span class="sr-only">${mdl.name} medal,</span>`}
        <span>${md ? md.text : fmt(t)}</span>
      </div>
      <div role="cell" class="gap">${fgap(t - best)}</div>
    </div>`;
  };
  const bar = (m) => html`
    <div key=${'bar-' + m.name} role="row" class="medal-bar">
      <span role="cell" class="medal-bar-label" style=${{ color: m.color }}><span class="medal-dot" style=${{ background: m.color }}></span>${m.name === 'Author' ? 'Author time' : m.name + ' medal'}</span>
      <span role="cell" class="mono strong medal-bar-time" style=${{ color: m.color }}>${fmt(m.t)}</span>
      <span class="dash" style=${{ borderColor: m.color }}></span>
      <span role="cell" class="hint-12">${plural(medalCount(m))} at or under</span>
    </div>`;

  // Interleave medal lines between finishers (handles 0 players above or below any medal).
  const mapRows = [];
  let mk = 0;
  fin.forEach((p, i) => {
    while (mk < medalList.length && p.t[mapIdx] > medalList[mk].t) mapRows.push(bar(medalList[mk++]));
    mapRows.push(rowFor(p, i));
  });
  while (mk < medalList.length) mapRows.push(bar(medalList[mk++]));
  if (st.showMissing) {
    ps.filter((p) => p.t[mapIdx] == null).sort((a, b) => a.seed - b.seed).forEach((p) => {
      const isMe = !!me && p.id === me.id;
      mapRows.push(html`
      <div key=${p.id} role="row" class=${'row fs-row is-missing' + (isMe ? ' is-me' : '')} style=${cols}>
        <div role="cell"><span class="seed seed-none">–</span></div>
        <div role="cell" class="name-cell">
          <${Flag} p=${p} model=${model} />
          <button class="btn fs-name" type="button" onClick=${() => set({ profileId: p.id })} aria-label=${'Open profile of ' + p.name}>${p.name}</button>
          ${isMe && html`<${BaseTag} />`}
        </div>
        <div role="cell" class="mtime none">no time</div>
        <div role="cell" class="gap"></div>
      </div>`);
    });
  }

  return html`
  <section aria-labelledby="fs-mapb-h" class="view gap-20">
    <h2 id="fs-mapb-h" class="h2">Map leaderboards</h2>
    <div role="tablist" aria-label="Choose a map" class="map-tabs">
      ${MAPS.map((m, i) => html`
      <button class=${'btn map-tab' + (i === mapIdx ? ' is-on' : '')} type="button" role="tab" aria-selected=${i === mapIdx ? 'true' : 'false'} onClick=${() => set({ mapIdx: i })}>
        <img src=${m.img} alt="" />
        <span class="map-tab-text"><span class="map-tab-name">${m.name}</span><span class="by">${by(m.author)}</span></span>
      </button>`)}
    </div>

    <div class="map-layout">
      <div class="map-info">
        <img src=${map.img} alt=${'Screenshot of ' + map.name} />
        <div class="map-info-body">
          <div>
            <p class="map-info-name">${map.name}</p>
            ${map.author && html`<p class="by by-14">by <span class="author">${map.author}</span></p>`}
          </div>
          <div class="stat-grid">
            <div class="stat"><p class="stat-k">Best time</p><p class="stat-v acc">${fin[0] ? fmt(best) : '—'}</p></div>
            <div class="stat"><p class="stat-k">Finished</p><p class="stat-v">${fin.length}/${ps.length}</p></div>
          </div>
          ${medalList.length > 0 && html`
          <div class="medal-list">
            <p class="label-caps">Medals</p>
            ${medalList.map((m) => html`
            <div class="medal-line">
              <span class="medal-dot lg" style=${{ background: m.color }}></span>
              <span class="strong-14">${m.name}</span>
              <span class="mono">${fmt(m.t)}</span>
              <span class="medal-count">${medalCount(m)}/${ps.length}</span>
            </div>`)}
          </div>`}
          <label class="check"><input type="checkbox" checked=${st.showMissing} onChange=${() => set({ showMissing: !st.showMissing })} />Show players without a time</label>
        </div>
      </div>

      <div role="table" aria-label=${'Ranking on ' + map.name} class="table map-table">
        <div role="row" class="row head-row th-static" style=${cols}>
          <div role="columnheader">Rank</div><div role="columnheader">Player</div><div role="columnheader" class="right">${me ? 'Δ ' + me.name : 'Time'}</div><div role="columnheader" class="right">Gap</div>
        </div>
        ${mapRows}
      </div>
    </div>
  </section>`;
}

// ---------- head to head ----------
function HeadToHead({ model, st, set, me }) {
  const { MAPS, NM, ps, bySeed, leader, byId, byName } = model;
  if (ps.length < 2) return html`<section class="view"><h2 class="h2">Head to head</h2><p class="muted">Needs at least two players.</p></section>`;
  const defA = me || leader;
  const defB = defA.id === bySeed[0].id ? bySeed[1] : bySeed[0];
  const A = (st.aId && byId.get(st.aId)) || defA;
  const B = (st.bId && byId.get(st.bId)) || defB;
  const pick = (qKey, idKey) => (e) => { const v = e.target.value; const m = byName(v); set(m ? { [qKey]: v, [idKey]: m.id } : { [qKey]: v }); };
  const totalOf = (p) => p.miss ? fmt(p.sum) + ' (pen.)' : fmt(p.score);

  let aw = 0, bw = 0;
  const cmp = (ta, tb) => {
    if (ta == null && tb == null) return { fill: { width: 0 }, verdict: 'Neither player has a time yet', vc: 'var(--muted2)', aColor: 'var(--muted3)', bColor: 'var(--muted3)' };
    if (ta == null) return { fill: { width: 0 }, verdict: A.name + ' has no time yet', vc: 'var(--muted)', aColor: 'var(--muted3)', bColor: 'var(--text)' };
    if (tb == null) return { fill: { width: 0 }, verdict: B.name + ' has no time yet', vc: 'var(--muted)', aColor: 'var(--text)', bColor: 'var(--muted3)' };
    const g = Math.abs(ta - tb), w = Math.max(3, Math.min(g / 1500, 1) * 50).toFixed(1) + '%';
    if (g === 0) return { fill: { width: 0 }, verdict: 'Dead even', vc: 'var(--text)', aColor: 'var(--text)', bColor: 'var(--text)' };
    if (ta < tb) return { fill: { right: '50%', width: w, background: ACCENT }, verdict: A.name + ' faster by ' + (g / 1000).toFixed(3) + 's', vc: ACCENT, aColor: ACCENT, bColor: 'var(--text)', win: 'a' };
    return { fill: { left: '50%', width: w, background: 'var(--blue)' }, verdict: B.name + ' faster by ' + (g / 1000).toFixed(3) + 's', vc: 'var(--blue)', aColor: 'var(--text)', bColor: 'var(--blue)', win: 'b' };
  };
  const rows = MAPS.map((m, i) => {
    const c = cmp(A.t[i], B.t[i]);
    if (c.win === 'a') aw++;
    if (c.win === 'b') bw++;
    return { name: m.name, sub: by(m.author), img: m.img, total: false, aTime: fmt(A.t[i]), bTime: fmt(B.t[i]),
      aRank: A.r[i] ? 'Rank ' + A.r[i] : 'no time', bRank: B.r[i] ? 'Rank ' + B.r[i] : 'no time', ...c };
  });
  const ct = !A.miss && !B.miss ? cmp(A.score, B.score)
    : { fill: { width: 0 }, verdict: 'Total only compares once both players have every map', vc: 'var(--muted2)', aColor: 'var(--muted3)', bColor: 'var(--muted3)' };
  rows.push({ name: 'Total', sub: 'Sum of all maps', img: '', total: true, aTime: A.miss ? fmt(A.sum) : fmt(A.score), bTime: B.miss ? fmt(B.sum) : fmt(B.score),
    aRank: 'Seed ' + A.seed, bRank: 'Seed ' + B.seed, ...ct });
  const summary = A.id === B.id ? 'Pick two different players' : aw === bw ? 'Maps split ' + aw + '–' + bw : (aw > bw ? A.name : B.name) + ' wins ' + Math.max(aw, bw) + ' of ' + NM + ' maps';

  const card = (p, side, label, q, onInput) => html`
    <div class=${'h2h-card side-' + side}>
      <label for=${'fs-' + side} class="h2h-label">${label}</label>
      <input id=${'fs-' + side} class="in h2h-in" list="fs-players" value=${q} onInput=${onInput} placeholder="Search a player" autocomplete="off" />
      <div class="h2h-meta">
        <span>Seed <strong class="mono hi">${p.seed}</strong></span>
        <span>Total <strong class="mono hi">${totalOf(p)}</strong></span>
        ${p.flag && html`<${Flag} p=${p} model=${model} />`}
      </div>
    </div>`;

  return html`
  <section aria-labelledby="fs-h2h-h" class="view gap-20">
    <h2 id="fs-h2h-h" class="h2">Head to head</h2>
    <div class="h2h-cards">
      ${card(A, 'a', 'Player A', st.aQ ?? A.name, pick('aQ', 'aId'))}
      ${card(B, 'b', 'Player B', st.bQ ?? B.name, pick('bQ', 'bId'))}
    </div>
    <p class="h2h-summary">${summary}</p>
    <div class="stack-12">
      ${rows.map((h) => html`
      <div key=${h.name} class=${'h2h-row' + (h.total ? ' is-total' : '')}>
        <div class="h2h-row-head">
          ${h.img && html`<img src=${h.img} alt="" />`}
          <div class="h2h-row-title"><span class="strong ellip">${h.name}</span><span class="hint-12 muted">${h.sub}</span></div>
        </div>
        <div class="h2h-bar-row">
          <div class="h2h-side"><span class="h2h-time" style=${{ color: h.aColor }}>${h.aTime}</span><span class="hint-12">${h.aRank}</span></div>
          <div class="h2h-bar" aria-hidden="true"><span class="h2h-fill" style=${h.fill}></span><span class="h2h-mid"></span></div>
          <div class="h2h-side right"><span class="h2h-time" style=${{ color: h.bColor }}>${h.bTime}</span><span class="hint-12">${h.bRank}</span></div>
        </div>
        <p class="h2h-verdict" style=${{ color: h.vc }}>${h.verdict}</p>
      </div>`)}
    </div>
  </section>`;
}

// ---------- player profile popup ----------
function Profile({ model, P, base, set, closeBtn, toH2H }) {
  const { MAPS, NM, ps, ranks, leader } = model;
  const cut = C.QUALIFY_CUT, topN = C.TOP_SEEDS;
  const close = () => set({ profileId: null });
  const showCmp = !!base && base.id !== P.id;
  let faster = 0, counted = 0;
  const vs = (tp, tb) => {
    if (tp == null && tb == null) return ['Neither has a time', 'var(--muted2)'];
    if (tp == null) return ['No time yet', 'var(--muted2)'];
    if (tb == null) return [base.name + ' has no time', 'var(--muted2)'];
    const d = tp - tb;
    if (d === 0) return ['Tied', 'var(--text)'];
    const s = (Math.abs(d) / 1000).toFixed(3);
    return d < 0 ? ['-' + s + '  faster', 'var(--green)'] : ['+' + s + '  slower', 'var(--red)'];
  };
  const maps = MAPS.map((m, i) => {
    const t = P.t[i], r = P.r[i], bt = ranks[i][0] ? ranks[i][0].t[i] : 0;
    let cmpText = '', cmpColor = 'var(--muted2)';
    if (showCmp) {
      [cmpText, cmpColor] = vs(t, base.t[i]);
      if (t != null && base.t[i] != null) { counted++; if (t < base.t[i]) faster++; }
    }
    return { name: m.name, sub: by(m.author), img: m.img, time: fmt(t), timeColor: t == null ? 'var(--muted3)' : r === 1 ? ACCENT : 'var(--text)',
      rankText: t == null ? 'no time' : r === 1 ? '#1 on map' : '#' + r + ' · ' + fgap(t - bt), baseTime: fmt(base && base.t[i]), cmpText, cmpColor };
  });
  let tText = 'Needs every map', tColor = 'var(--muted2)';
  if (showCmp && !P.miss && !base.miss) [tText, tColor] = vs(P.score, base.score);
  maps.push({ name: 'Total', sub: 'Sum of all maps', img: '', total: true, time: P.miss ? fmt(P.sum) : fmt(P.score), timeColor: P.miss ? 'var(--muted3)' : 'var(--text)',
    rankText: 'Seed ' + P.seed, baseTime: base ? (base.miss ? fmt(base.sum) + ' (pen.)' : fmt(base.score)) : '', cmpText: tText, cmpColor: tColor });
  const seedCls = P.seed <= 3 ? 'seed-top3' : P.seed <= topN ? 'seed-topn' : P.seed <= cut ? '' : 'seed-out';

  return html`
  <div class="modal">
    <button class="btn modal-scrim" type="button" aria-label="Close profile" tabindex="-1" onClick=${close}></button>
    <div role="dialog" aria-modal="true" aria-labelledby="fs-prof-name" class="dialog">
      <div class="dialog-head">
        ${P.flag ? html`<${Flag} p=${P} model=${model} large />` : null}
        <div class="dialog-title">
          <h2 id="fs-prof-name" class="prof-name">${P.name}</h2>
          <div class="chips">
            <span class=${'chip seedchip ' + seedCls}>Seed ${P.seed}</span>
            ${P.miss > 0 && html`<span class="chip chip-outline">${(NM - P.miss) + '/' + NM + ' maps'}</span>`}
            ${base && base.id === P.id && html`<${BaseTag} big />`}
            ${P.seed <= cut ? html`<span class="chip chip-in">Inside top ${cut}</span>` : html`<span class="chip chip-out">Outside top ${cut}</span>`}
          </div>
          <div class="chips mt-4">
            ${(!base || base.id !== P.id) && html`<button class="btn pill pill-sm hi" type="button" onClick=${() => set({ meId: P.id, meQuery: P.name })}>Use as comparison base</button>`}
            ${showCmp && html`<button class="btn pill pill-sm pill-solid" type="button" onClick=${() => toH2H(base, P)}>Full head to head</button>`}
          </div>
        </div>
        <button ref=${closeBtn} class="btn icon-btn icon-btn-lg" type="button" onClick=${close} aria-label="Close"><${XIcon} /></button>
      </div>

      <div class="prof-stats">
        <div class="stat"><p class="stat-k">Global rank</p><p class="stat-v big acc">#${P.seed}</p><p class="hint-12">of ${ps.length}</p></div>
        <div class="stat"><p class="stat-k">Total</p><p class="stat-v" style=${{ color: P.miss ? 'var(--muted3)' : 'var(--text)' }}>${P.miss ? fmt(P.sum) : fmt(P.score)}</p><p class="hint-12">${P.miss ? 'penalized' : ''}</p></div>
        <div class="stat"><p class="stat-k">Gap to 1st</p><p class="stat-v">${P.miss ? '—' : P.seed === 1 ? 'Leader' : fgap(P.score - leader.score)}</p></div>
      </div>

      <div class="prof-times">
        <div class="sec-head">
          <h3 class="label-caps">Times</h3>
          ${showCmp && counted > 0 && html`<p class="soft fs-13">Faster than ${base.name} on ${faster} of ${counted} maps</p>`}
        </div>
        ${maps.map((m) => html`
        <div key=${m.name} class=${'prof-map' + (m.total ? ' is-total' : '')}>
          ${m.img ? html`<img src=${m.img} alt="" />` : html`<span class="sum-box">SUM</span>`}
          <div class="prof-map-title"><span class="strong-600 ellip">${m.name}</span><span class="hint-12">${m.sub}</span></div>
          <div class="prof-map-time"><span class="mono strong fs-16" style=${{ color: m.timeColor }}>${m.time}</span><span class="muted fs-12">${m.rankText}</span></div>
          ${showCmp && html`
          <div class="prof-cmp">
            <span class="hint-12">${base.name} <span class="mono soft">${m.baseTime}</span></span>
            <span class="mono strong prof-cmp-val" style=${{ color: m.cmpColor }}>${m.cmpText}</span>
          </div>`}
        </div>`)}
        ${!base && html`<p class="hint">Set a comparison base to see how this player stacks up against them.</p>`}
      </div>
    </div>
  </div>`;
}

render(html`<${App} />`, document.getElementById('app'));
