// Shared helpers for reading ESPN's public (unofficial) sports data.
// ESPN can change these feeds without notice. If something breaks, this is the file to fix.

export const LG = {
  nfl: ["football", "nfl"],
  mlb: ["baseball", "mlb"],
  nba: ["basketball", "nba"],
  nhl: ["hockey", "nhl"],
};

// ESPN abbreviations that differ from the codes the site uses.
const ALIAS = {
  nfl: { JAX: "JAC", LAR: "LA", WSH: "WAS" },
  mlb: { CHW: "CWS", ARI: "AZ", OAK: "ATH" },
  nba: { GS: "GSW", NY: "NYK", NO: "NOP", SA: "SAS", UTAH: "UTA", WSH: "WAS" },
  nhl: { UTAH: "UTA" },
};
export const code = (lg, abbr) => {
  const a = String(abbr || "").toUpperCase();
  return (ALIAS[lg] || {})[a] || a;
};

const BASE = "https://site.api.espn.com/apis";
export const siteURL = (lg, path) => `${BASE}/site/v2/sports/${LG[lg][0]}/${LG[lg][1]}/${path}`;
export const standingsURL = (lg, query = "") => `${BASE}/v2/sports/${LG[lg][0]}/${LG[lg][1]}/standings${query}`;

export async function getJSON(url, ms = 8000) {
  const r = await fetch(url, {
    headers: { "User-Agent": "LoneDuckUSA/1.0", Accept: "application/json" },
    signal: AbortSignal.timeout(ms),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.json();
}

// How long Netlify's CDN may reuse a response before asking ESPN again.
export const cacheHeaders = (seconds) => ({
  "Cache-Control": "public, max-age=0, must-revalidate",
  "Netlify-CDN-Cache-Control": `public, durable, max-age=${seconds}, stale-while-revalidate=${seconds * 5}`,
});

const num = (s) => {
  if (s == null || s === "") return null;
  const v = typeof s === "object" ? (s.value ?? s.displayValue) : s;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// One game -> [away, home, awayScore, homeScore, startISO, label, awayWin%, homeWin%, state, statusText]
// state is "pre", "in" or "post".
export function parseEvent(lg, ev, teamsOut) {
  const c = ev?.competitions?.[0];
  if (!c || !Array.isArray(c.competitors)) return null;
  const H = c.competitors.find((x) => x.homeAway === "home");
  const A = c.competitors.find((x) => x.homeAway === "away");
  if (!H || !A) return null;
  const a = code(lg, A.team?.abbreviation), h = code(lg, H.team?.abbreviation);
  if (!a || !h) return null;

  const t = (c.status || ev.status || {}).type || {};
  let state = t.state || "pre";
  if (state === "post" && t.completed === false) state = "pre"; // postponed or canceled
  const detail = t.shortDetail || t.detail || "";

  if (teamsOut) {
    for (const x of [A, H]) {
      const k = code(lg, x.team?.abbreviation);
      if (k && !teamsOut[k]) {
        teamsOut[k] = {
          name: x.team.name || x.team.shortDisplayName || x.team.displayName || k,
          color: x.team.color ? "#" + x.team.color : null,
        };
      }
    }
  }

  const tv = (c.broadcasts || [])
    .flatMap((b) => b.names || (b.media?.shortName ? [b.media.shortName] : []))
    .slice(0, 2)
    .join(", ");
  const label = c.notes?.[0]?.headline || tv || "";
  const showScore = state !== "pre";
  const iso = new Date(ev.date || c.date).toISOString();
  return [a, h, showScore ? num(A.score) : null, showScore ? num(H.score) : null, iso, label, null, null, state, detail];
}

const STANDINGS_NOTE = {
  nfl: "Updated automatically.",
  mlb: "Updated automatically.",
  nba: "Updated automatically.",
  nhl: "Overtime and shootout losses are not counted in the L column.",
};
const shortGroup = (s) =>
  String(s || "")
    .replace(/^American League /, "AL ")
    .replace(/^National League /, "NL ")
    .replace(/ Division$/, "");

export function parseStandings(lg, d) {
  const groups = [];
  const walk = (n) => {
    if (!n) return;
    const entries = n.standings?.entries;
    if (Array.isArray(entries) && entries.length) {
      const rows = entries
        .map((e) => {
          const s = {};
          for (const st of e.stats || []) s[st.name || st.type] = st.value;
          const t = code(lg, e.team?.abbreviation);
          if (!t) return null;
          return { t, w: s.wins ?? 0, l: s.losses ?? 0, pts: s.points, pct: s.winPercent };
        })
        .filter(Boolean)
        .sort((x, y) =>
          x.pts != null && y.pts != null
            ? y.pts - x.pts || y.w - x.w
            : (y.pct ?? 0) - (x.pct ?? 0) || y.w - x.w
        );
      groups.push([shortGroup(n.name || n.abbreviation), rows.map((r) => [r.t, r.w, r.l])]);
    }
    (n.children || []).forEach(walk);
  };
  walk(d);
  return groups.length ? { note: STANDINGS_NOTE[lg], groups } : null;
}

// Roster grouping per league, in display order.
const ORDER = {
  nhl: ["Goalies", "Defense", "Forwards"],
  nba: ["Guards", "Forwards", "Centers"],
  mlb: ["Pitchers", "Catchers", "Infielders", "Outfielders", "Designated hitters"],
  nfl: ["Offense", "Defense", "Special teams"],
};
function bucket(lg, pos, group) {
  const p = String(pos || "").toUpperCase();
  if (lg === "nhl") return p === "G" ? "Goalies" : p === "D" ? "Defense" : "Forwards";
  if (lg === "nba") return p === "C" ? "Centers" : p.includes("F") ? "Forwards" : "Guards";
  if (lg === "mlb") {
    if (["P", "SP", "RP"].includes(p)) return "Pitchers";
    if (p === "C") return "Catchers";
    if (["1B", "2B", "3B", "SS", "IF"].includes(p)) return "Infielders";
    if (["LF", "CF", "RF", "OF"].includes(p)) return "Outfielders";
    if (p === "DH") return "Designated hitters";
  }
  if (lg === "nfl") {
    const g = String(group || "").toLowerCase();
    if (g.startsWith("off")) return "Offense";
    if (g.startsWith("def")) return "Defense";
    if (g.startsWith("special")) return "Special teams";
  }
  const g = String(group || "Other");
  return g.charAt(0).toUpperCase() + g.slice(1).replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

export function parseRoster(lg, d) {
  const flat = [];
  for (const x of d?.athletes || []) {
    if (Array.isArray(x?.items)) x.items.forEach((p) => flat.push([p, x.position]));
    else if (x) flat.push([x, null]);
  }
  const groups = new Map((ORDER[lg] || []).map((k) => [k, []]));
  for (const [p, grp] of flat) {
    const pos = p.position?.abbreviation || "";
    const b = bucket(lg, pos, grp);
    if (!groups.has(b)) groups.set(b, []);
    groups.get(b).push([p.jersey ?? null, p.displayName || p.fullName || "", pos || null]);
  }
  const co = Array.isArray(d?.coach) ? d.coach[0] : null;
  return {
    coach: co ? [co.firstName, co.lastName].filter(Boolean).join(" ") : null,
    groups: [...groups].filter(([, v]) => v.length),
  };
}
