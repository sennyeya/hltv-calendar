# hltv-calendar

Minimal, spoiler-free CS2 calendar feeds for **Falcons** and **Team Spirit**.

The site is regenerated every four hours by GitHub Actions and deployed to GitHub Pages.

## Feeds

Once GitHub Pages is enabled for **GitHub Actions**, subscribe to:

- `https://sennyeya.github.io/hltv-calendar/cs2/falcons.ics`
- `https://sennyeya.github.io/hltv-calendar/cs2/spirit.ics`
- `https://sennyeya.github.io/hltv-calendar/cs2/falcons-spirit.ics`

The combined feed is the intended iPhone subscription.

## How it works

The generator requests upcoming matches for the two HLTV team IDs, filters them, and emits standard ICS files. Match IDs become stable ICS UIDs so schedule changes update existing calendar events instead of intentionally creating new ones.

Data is sourced from HLTV through the unofficial `@beermonster/hltv` package. HLTV has no official public API, so scraping can occasionally break or be blocked by Cloudflare.

## Setup

1. Open **Settings → Pages** for this repository.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Open **Actions → Update calendar** and run it once with **Run workflow**.
4. After deployment succeeds, subscribe to the combined feed in Apple Calendar.

The workflow refreshes every four hours at minute 17.
