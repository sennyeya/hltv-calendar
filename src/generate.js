import fs from "node:fs/promises";
import path from "node:path";
import ical from "ical-generator";

const API = "https://api.pandascore.co/csgo/matches/upcoming";
const TEAM_ALIASES = {
  falcons: ["falcons", "team falcons"],
  spirit: ["spirit", "team spirit"],
};
const TEAM_NAMES = { falcons: "Falcons", spirit: "Team Spirit" };
const OUTPUTS = [
  ["falcons", ["falcons"]],
  ["spirit", ["spirit"]],
  ["falcons-spirit", ["falcons", "spirit"]],
];
const outDir = path.resolve("public/cs2");

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function slugForTeam(team) {
  const values = [team?.name, team?.acronym, team?.slug]
    .filter(Boolean)
    .map((v) => clean(v).toLowerCase());
  return Object.entries(TEAM_ALIASES).find(([, aliases]) =>
    aliases.some((alias) => values.includes(alias))
  )?.[0];
}

function opponents(match) {
  return (match.opponents ?? []).map((entry) => entry.opponent).filter(Boolean);
}

function toEvent(match) {
  const teams = opponents(match);
  if (teams.length !== 2 || !match.begin_at) return null;
  const start = new Date(match.begin_at);
  if (Number.isNaN(start.getTime())) return null;
  const end = match.end_at ? new Date(match.end_at) : new Date(start.getTime() + 3 * 60 * 60 * 1000);
  const league = clean(match.league?.name);
  const serie = clean(match.serie?.full_name || match.serie?.name);
  const tournament = clean(match.tournament?.name);
  return {
    id: `pandascore-match-${match.id}@hltv-calendar`,
    start,
    end: Number.isNaN(end.getTime()) ? new Date(start.getTime() + 3 * 60 * 60 * 1000) : end,
    summary: `${clean(teams[0].name)} vs ${clean(teams[1].name)}`,
    description: [league, serie, tournament].filter(Boolean).join(" · "),
    url: match.official_stream_url || undefined,
  };
}

function makeCalendar(name, matches) {
  const calendar = ical({
    name,
    prodId: { company: "hltv-calendar", product: "CS2 calendar" },
    timezone: "UTC",
  });
  for (const match of matches) {
    const event = toEvent(match);
    if (event) calendar.createEvent(event);
  }
  return calendar.toString();
}

async function fetchMatches() {
  const token = process.env.PANDASCORE_API_KEY;
  if (!token) throw new Error("PANDASCORE_API_KEY is not set");

  const url = new URL(API);
  url.searchParams.set("per_page", "100");
  url.searchParams.set("sort", "begin_at");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "User-Agent": "hltv-calendar/1.0",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`PandaScore returned HTTP ${response.status}: ${body.slice(0, 500)}`);
  }
  return response.json();
}

async function main() {
  const matches = await fetchMatches();
  if (!Array.isArray(matches)) throw new Error("Unexpected PandaScore response");

  const relevant = matches.filter((match) => {
    const slugs = opponents(match).map(slugForTeam);
    return slugs.includes("falcons") || slugs.includes("spirit");
  });

  await fs.mkdir(outDir, { recursive: true });

  for (const [filename, wanted] of OUTPUTS) {
    const selected = relevant.filter((match) => {
      const slugs = opponents(match).map(slugForTeam);
      return wanted.some((slug) => slugs.includes(slug));
    });
    await fs.writeFile(
      path.join(outDir, `${filename}.ics`),
      makeCalendar(`CS2 — ${wanted.map((slug) => TEAM_NAMES[slug]).join(" + ")}`, selected),
      "utf8"
    );
  }

  const generated = new Date().toISOString();
  await fs.writeFile(
    path.resolve("public/index.html"),
    `<!doctype html><meta charset="utf-8"><title>HLTV Calendar</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px system-ui;max-width:42rem;margin:3rem auto;padding:0 1rem;line-height:1.5}a{display:block;margin:.8rem 0}</style><h1>HLTV Calendar</h1><p>Spoiler-free CS2 calendar feeds for Falcons and Team Spirit, powered by PandaScore.</p><a href="cs2/falcons.ics">Falcons</a><a href="cs2/spirit.ics">Team Spirit</a><a href="cs2/falcons-spirit.ics">Falcons + Team Spirit</a><small>Last generated: ${generated}</small>`,
    "utf8"
  );
  console.log(`Fetched ${matches.length} upcoming matches; ${relevant.length} involve Falcons or Team Spirit.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
