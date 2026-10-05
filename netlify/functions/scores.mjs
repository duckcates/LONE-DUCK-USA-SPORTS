// GET /api/scores
// Scores (3 days back, 7 days ahead) and standings for all four leagues.
// Netlify's CDN reuses each answer for 60 seconds, so ESPN is asked at most about once a minute.
import { LG, siteURL, standingsURL, getJSON, parseEvent, parseStandings, cacheHeaders } from "../lib/espn.mjs";

const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");

function phaseText(lg, sb, games) {
  const season = sb.leagues?.[0]?.season;
  const parts = [];
  if (season?.type?.name) parts.push(season.type.name);
  if (lg === "nfl" && sb.week?.number) parts.push(`Week ${sb.week.number}`);
  const live = games.filter((g) => g[8] === "in").length;
  let s = parts.join(", ");
  if (live) s += `${s ? ". " : ""}${live} game${live === 1 ? "" : "s"} live now`;
  return s ? s + "." : "";
}

export default async () => {
  const now = Date.now();
  const from = new Date(now - 3 * 864e5), to = new Date(now + 7 * 864e5);
  const out = { updatedAt: new Date(now).toISOString(), source: "ESPN", leagues: {}, teams: {}, errors: [] };

  await Promise.all(
    Object.keys(LG).map(async (lg) => {
      const teams = {};
      const L = { games: [], phase: "", standings: null };
      try {
        const sb = await getJSON(siteURL(lg, `scoreboard?dates=${ymd(from)}-${ymd(to)}&limit=1000`));
        L.games = (sb.events || []).map((e) => parseEvent(lg, e, teams)).filter(Boolean);
        L.phase = phaseText(lg, sb, L.games);
        const year = sb.leagues?.[0]?.season?.year;
        try {
          const st = await getJSON(standingsURL(lg, `?level=3${year ? `&season=${year}` : ""}`));
          L.standings = parseStandings(lg, st);
        } catch (e) {
          out.errors.push(`${lg} standings: ${e.message}`);
        }
      } catch (e) {
        out.errors.push(`${lg} scores: ${e.message}`);
      }
      out.leagues[lg] = L;
      out.teams[lg] = teams;
    })
  );

  const allFailed = Object.values(out.leagues).every((L) => !L.games.length && !L.standings);
  return Response.json(out, {
    status: allFailed ? 502 : 200,
    headers: cacheHeaders(allFailed ? 15 : 60),
  });
};

export const config = { path: "/api/scores" };
