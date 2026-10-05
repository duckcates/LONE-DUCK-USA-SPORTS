// GET /api/team?lg=nba&t=BOS
// One team's roster, head coach and season schedule. Cached for 30 minutes.
import { LG, code, siteURL, getJSON, parseEvent, parseRoster, cacheHeaders } from "../lib/espn.mjs";

const TEAM_IDS = {}; // remembered while the function stays warm

async function teamId(lg, t) {
  if (!TEAM_IDS[lg]) {
    const d = await getJSON(siteURL(lg, "teams"));
    const m = {};
    for (const x of d.sports?.[0]?.leagues?.[0]?.teams || []) {
      if (x.team) m[code(lg, x.team.abbreviation)] = x.team.id;
    }
    TEAM_IDS[lg] = m;
  }
  return TEAM_IDS[lg][t];
}

export default async (req) => {
  const u = new URL(req.url);
  const lg = u.searchParams.get("lg");
  const t = (u.searchParams.get("t") || "").toUpperCase();
  if (!LG[lg] || !/^[A-Z]{2,4}$/.test(t)) {
    return Response.json({ error: "Use /api/team?lg=nba&t=BOS" }, { status: 400 });
  }
  try {
    const id = await teamId(lg, t);
    if (!id) return Response.json({ error: "Unknown team" }, { status: 404, headers: cacheHeaders(3600) });

    const [ro, sc] = await Promise.allSettled([
      getJSON(siteURL(lg, `teams/${id}/roster`)),
      getJSON(siteURL(lg, `teams/${id}/schedule`)),
    ]);
    const roster = ro.status === "fulfilled" ? parseRoster(lg, ro.value) : { coach: null, groups: [] };
    const games = sc.status === "fulfilled" ? (sc.value.events || []).map((e) => parseEvent(lg, e)).filter(Boolean) : [];
    const ok = roster.groups.length || games.length;
    return Response.json(
      { lg, t, updatedAt: new Date().toISOString(), coach: roster.coach, groups: roster.groups, games },
      { status: ok ? 200 : 502, headers: cacheHeaders(ok ? 1800 : 30) }
    );
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502, headers: cacheHeaders(30) });
  }
};

export const config = { path: "/api/team" };
