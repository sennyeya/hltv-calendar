import fs from "node:fs/promises";
import path from "node:path";
import { HLTV } from "@beermonster/hltv";
import ical from "ical-generator";

const TEAMS = {
  falcons: { id: 11283, name: "Falcons" },
  spirit: { id: 7020, name: "Spirit" },
};

const OUTPUTS = [
  ["falcons", ["falcons"]],
  ["spirit", ["spirit"]],
  ["falcons-spirit", ["falcons", "spirit"]],
];

const outDir = path.resolve("public/cs2");

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function teamSlug(name) {
  const normalized = clean(name).toLowerCase();
  return Object.entries(TEAMS).find(([, team]) =>
    normalized === team.name.toLowerCase() ||
    (team.name === "Spirit" && normalized === "team spirit")
  )?.[0];
}

function matchUrl(match) {
  return match.id ? `https://www.hltv.org/matches/${match.id}/_` : undefined;
}

function toEvent(match) {
  if (!match.date || !match.team1?.name || !match.team2?.name) return null;

  const start = new Date(match.date);
  if (Number.isNaN(start.getTime())) return null;

  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  const eventName = clean(match.event?.name);
  const format = clean(match.format);
  const description = [eventName, format].filter(Boolean).join(" · ");
  const url = matchUrl(match);

  return {
    id: `hltv-match-${match.id}@hltv-calendar`,
    start,
    end,
    summary: `${clean(match.team1.name)} vs ${clean(match.team2.name)}`,
    description,
    url,
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

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  // One HLTV request for both teams. The package is unofficial and HLTV may
  // occasionally block automated requests, so the workflow does not delete
  // previously published calendars unless generation succeeds.
  const matches = await HLTV.getMatches({
    teamIds: Object.values(TEAMS).map((team) => team.id),
  });

  const upcoming = matches
    .filter((match) => match.date && match.date > Date.now() - 15 * 60 * 1000)
    .sort((a, b) => a.date - b.date);

  for (const [filename, wanted] of OUTPUTS) {
    const selected = upcoming.filter((match) => {
      const participants = [teamSlug(match.team1?.name), teamSlug(match.team2?.name)];
      return wanted.some((slug) => participants.includes(slug));
    });

    await fs.writeFile(
      path.join(outDir, `${filename}.ics`),
      makeCalendar(
        `CS2 — ${wanted.map((slug) => TEAMS[slug].name).join(" + ")}`,
        selected
      ),
      "utf8"
    );
  }

  const generated = new Date().toISOString();
  await fs.writeFile(
    path.resolve("public/index.html"),
    `<!doctype html><meta charset="utf-8"><title>HLTV Calendar</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px system-ui;max-width:42rem;margin:3rem auto;padding:0 1rem;line-height:1.5}a{display:block;margin:.8rem 0}</style><h1>HLTV Calendar</h1><p>Spoiler-free CS2 calendar feeds. Updated automatically from upcoming HLTV matches.</p><a href="cs2/falcons.ics">Falcons</a><a href="cs2/spirit.ics">Team Spirit</a><a href="cs2/falcons-spirit.ics">Falcons + Team Spirit</a><small>Last generated: ${generated}</small>`,
    "utf8"
  );

  console.log(`Generated calendars from ${upcoming.length} upcoming matches.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
