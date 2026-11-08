// Everything you might want to tweak lives here.

// ---- Spreadsheet ----
export const SHEET_ID = '1wfJyt1hULQlwSz5gomzuw6NO-uOyU0RVm00P8LO0jy4';
export const SEEDING_GID = '798076765'; // "Seeding" tab (times come from its CSV, flags from its HTML view)
export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?usp=sharing`;

// How often the page re-fetches the spreadsheet while it is open.
export const REFRESH_MS = 3 * 60 * 1000;

// ---- Rules ----
// The sheet writes 1,000.000 for a map without a time, and counts it into the total.
export const NO_TIME_SECONDS = 1000;
export const MISSING_PENALTY_MS = NO_TIME_SECONDS * 1000;
export const QUALIFY_CUT = 64; // top N seeds advance
export const TOP_SEEDS = 8; // highlighted group below the top 3

// ---- Schedule ----
// Used until the sheet's "Closes:" cell has been read.
export const SEEDING_CLOSE_FALLBACK = Date.UTC(2026, 10, 20, 19, 0);
const DAY = 864e5;
export const MATCH_DAYS = [
  { label: 'Match day 1', date: 'Sat, Nov 21', end: Date.UTC(2026, 10, 21) + DAY },
  { label: 'Match day 2', date: 'Sat, Nov 28', end: Date.UTC(2026, 10, 28) + DAY },
  { label: 'Match day 3', date: 'Sat, Dec 5', end: Date.UTC(2026, 11, 5) + DAY },
  { label: 'Consolation KOs', date: 'Sat, Dec 12', end: Date.UTC(2026, 11, 12) + DAY },
];

// ---- Maps ----
// Matched to the sheet's map columns by name (case-insensitive). A map that appears in the
// sheet but not here still shows up, with the fallback image and no medals.
// Medal times in ms: [Author, Gold, Silver, Bronze].
export const MAPS = [
  { name: 'trouser chocolate', author: 'a1', img: 'assets/map-trouser.webp', medals: [58057, 62000, 70000, 88000] },
  { name: 'Free From the Shackles of Gravity', author: 'ski and trev', img: 'assets/map-gravity.webp', medals: [69661, 74000, 84000, 105000] },
  { name: 'Auburn', author: 'daeh', img: 'assets/map-auburn.webp', medals: [64421, 71000, 80000, 100000] },
];
export const FALLBACK_MAP_IMG = 'assets/fallspeed-art.webp';

// ---- Footer links ---- (leave a link empty to hide its button)
export const LINKS = {
  discord: 'https://discord.com/invite/SdTgUqhqfD',
  rulebook: 'https://fallspeed26.sharebob.app',
  spreadsheet: SHEET_URL,
};
