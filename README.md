# Academy Reunion site

Plain static HTML/CSS/JS, ready for GitHub Pages. All text is lorem ipsum placeholder and all images are placeholders.

## How it's laid out
- **Home**: banner image, then six numbered tiles (Event Details, RSVP, Venue & Menu, Attendees, Shenanigans, FAQ).
- **Inside pages**: clicking a tile shows the banner, a tab bar (← Home, Event Details, RSVP, Venue & Menu, Attendees, Shenanigans, FAQ) and that section. Each section has its own link (e.g. `.../#venue`), so links can be shared directly.
- The footer is a navy bar (`--navy` in styles.css, matched to the GIF) with the animated heading GIF.

## Files
- `index.html`: all page content. Each section is marked with a comment (`<!-- 01 EVENT DETAILS -->`, etc.).
- `styles.css`: layout and styling. Colors are at the top under `:root`.
- `script.js`: page switching, RSVP submit, live weather.
- `assets/banner.svg`: banner placeholder. Replace with your artwork (about 1600 × 320; it shows as a 5:1 strip) and update the `src` in index.html.
- `assets/placeholder.svg`, `assets/avatar.svg`: placeholders for photos and attendee headshots.
- `assets/heading.gif`: animated heading in the footer (450 × 240, shown at 150 × 80).

## Turning on RSVP
GitHub Pages can't store form data, so RSVPs go through Formspree (free tier is 50 submissions/month).
1. Sign up at https://formspree.io and create a new form.
2. Copy the form ID (the part after `/f/` in the endpoint, e.g. `xyzabcd`).
3. In `index.html`, replace `YOUR_FORM_ID` in the form's `action` with it.
Each RSVP is emailed to you and listed in the Formspree dashboard, which can export to CSV.

Prefer a Google Form instead? Replace the whole `<form class="card rsvp-form">…</form>` block with the
`<iframe>` embed code from Google Forms (Send → `<>` tab). Responses then land in a Google Sheet.

## Live weather
The weather cards (top of the FAQ page) pull a real forecast from Open-Meteo (free, no account or key). On the `wxgrid` line in `index.html`, set:
- `data-lat` / `data-lon`: the venue's coordinates (right-click the spot in Google Maps to copy them)
- `data-start`: the first day of the event, as `YYYY-MM-DD`
- `data-days`: how many days (add or remove `<div class="wx">` cards to match)

Forecasts only exist about 16 days out, so until then the cards show whatever text you put in them.

## Publishing on GitHub Pages
1. Create a GitHub repo and upload these files to the root of the `main` branch.
2. In the repo: Settings → Pages → Source: "Deploy from a branch", Branch: `main` / `(root)`.
3. The site appears at `https://<your-username>.github.io/<repo-name>/`.
