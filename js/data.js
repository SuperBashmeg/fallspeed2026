// Fetches the official spreadsheet straight from Google (these endpoints send CORS headers)
// and turns it into { maps, players, updated, closes }.
import { SHEET_ID, SEEDING_GID, NO_TIME_SECONDS } from './config.js';

const BASE = `https://docs.google.com/spreadsheets/d/${SHEET_ID}`;

// Flag image URL per player (lowercased name). The flags are images inside the sheet, which the CSV
// export drops, so they come from the sheet's HTML view. That page is big (~450 KB), so it is only
// fetched again when a player shows up without a known flag.
const flagCache = new Map();
let flagsLoaded = false;

export async function loadData() {
  const seedingUrl = `${BASE}/export?format=csv&gid=${SEEDING_GID}&t=${Date.now()}`;
  const data = parseSeeding(parseCSV(await fetchText(seedingUrl)));

  if (!flagsLoaded || data.players.some((p) => !flagCache.has(p.name.toLowerCase()))) {
    // Flags are optional: if this fails, players just show without one.
    try {
      const htmlUrl = `${BASE}/htmlview/sheet?headers=false&gid=${SEEDING_GID}&t=${Date.now()}`;
      for (const [name, url] of parseFlags(await fetchText(htmlUrl))) flagCache.set(name, url);
      flagsLoaded = true;
    } catch (e) {
      console.warn('Could not load flags:', e);
    }
  }
  for (const p of data.players) p.flag = flagCache.get(p.name.toLowerCase()) || null;
  data.fetchedAt = Date.now();
  return data;
}

async function fetchText(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Spreadsheet request failed (${res.status})`);
  return res.text();
}

// RFC 4180 CSV parser (quoted fields, escaped quotes, newlines inside quotes).
export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', i = 0, quoted = false;
  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { quoted = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const clean = (s) => String(s ?? '').trim();
const low = (s) => clean(s).toLowerCase();

// "58.734", "1,000.000" or "1:02.345" -> ms. Returns null for empty cells and the 1000 s placeholder.
export function parseTime(cell) {
  const s = clean(cell).replace(/,/g, '');
  if (!s) return null;
  const sec = s.includes(':') ? s.split(':').reduce((a, part) => a * 60 + parseFloat(part), 0) : parseFloat(s);
  if (!Number.isFinite(sec) || sec <= 0 || sec >= NO_TIME_SECONDS) return null;
  return Math.round(sec * 1000);
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
// "Nov 8, 2026" + "01:01:08 UTC" -> epoch ms (the sheet writes these in UTC).
function parseSheetDate(dateStr, timeStr) {
  const d = /([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(clean(dateStr));
  if (!d) return null;
  const month = MONTHS.indexOf(d[1].toLowerCase());
  if (month < 0) return null;
  const t = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(clean(timeStr)) || [];
  return Date.UTC(+d[3], month, +d[2], +(t[1] || 0), +(t[2] || 0), +(t[3] || 0));
}

// Finds a label cell like "Last Updated:" anywhere and reads the date + time in the two cells below.
function findLabeledDate(rows, label) {
  for (let r = 0; r < rows.length; r++) {
    const c = rows[r].findIndex((v) => low(v).startsWith(label));
    if (c >= 0) return parseSheetDate(rows[r + 1]?.[c], rows[r + 2]?.[c]);
  }
  return null;
}

export function parseSeeding(rows) {
  const hi = rows.findIndex((r) => low(r[0]) === 'seed');
  if (hi < 0) throw new Error('Could not find the "Seed" header row in the Seeding tab.');
  const header = rows[hi];
  const playerCol = Math.max(1, header.findIndex((v) => low(v) === 'player'));
  let totalCol = header.findIndex((v) => low(v) === 'total');
  if (totalCol < 0) totalCol = header.length;

  // Every named column between "Player" and "Total" is a map.
  const mapCols = [];
  for (let c = playerCol + 1; c < totalCol; c++) if (clean(header[c])) mapCols.push(c);
  if (!mapCols.length) throw new Error('No map columns found in the Seeding tab.');

  const players = [];
  const seen = new Set();
  for (const r of rows.slice(hi + 1)) {
    // The player name sits somewhere in the merged "Player" cell range before the first map column.
    let name = '';
    for (let c = playerCol; c < mapCols[0] && !name; c++) name = clean(r[c]);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    players.push({ name, times: mapCols.map((c) => parseTime(r[c])) });
  }

  return {
    maps: mapCols.map((c) => ({ name: clean(header[c]) })),
    players,
    updated: findLabeledDate(rows, 'last updated'),
    closes: findLabeledDate(rows, 'closes'),
  };
}

// ---- flags ----
// In each leaderboard row of the HTML view the flag image sits between the seed and the player name:
// <td>1</td><td><img flag></td><td>Pain</td><td><img team></td>... (exact columns may shift).
// Returns [[lowercased name, flag url], ...].
export function parseFlags(htmlText) {
  const doc = new DOMParser().parseFromString(htmlText, 'text/html');
  const out = [];
  for (const tr of doc.querySelectorAll('tr')) {
    const tds = [...tr.querySelectorAll('td')];
    if (!/^\d+$/.test(clean(tds[0]?.textContent))) continue; // rows start with the seed number
    let flag = null;
    for (const td of tds.slice(1)) {
      const text = clean(td.textContent);
      if (text) { if (flag) out.push([text.toLowerCase(), flag]); break; }
      flag = flag || td.querySelector('img')?.getAttribute('src') || null;
    }
  }
  return out.map(([name, url]) => [name, flagSize(url)]);
}

// Google serves these through an image proxy whose URL ends in a size spec ("=s27-w27-h18-s").
// Ask for the largest size it has (72x48) so the flags stay sharp on high-DPI screens.
const flagSize = (url) => /googleusercontent\.com\//.test(url) ? url.replace(/=[^=/]*$/, '=w72-h48') : url;
