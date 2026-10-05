# Lone Duck USA Sports: putting it on Netlify

Once this is live, scores, standings, rosters, head coaches and team schedules
for the NFL, MLB, NBA and NHL update on their own from ESPN. You don't need to
republish anything.

## What's in this folder

- `public/index.html` is the website.
- `netlify/functions/scores.mjs` serves scores and standings at `/api/scores`.
- `netlify/functions/team.mjs` serves one team's roster and schedule at `/api/team`.
- `netlify/lib/espn.mjs` holds the shared code that reads ESPN's data. If ESPN
  changes something, this is the file that needs fixing.
- `netlify.toml` and `package.json` are settings files. Netlify reads them automatically.

## Setup (about 30 minutes, no coding)

Important: Netlify's drag-and-drop "Netlify Drop" page only hosts plain files
and will NOT run the automatic-update functions. Use GitHub as described below.

### 1. Put the files on GitHub
1. Make a free account at github.com.
2. Click **New repository**. Name it `lone-duck-usa-sports`, leave it Public or
   choose Private, and click **Create repository**.
3. On the next page, click **uploading an existing file**.
4. Unzip the download. Open the `lone-duck-usa-sports` folder and drag
   everything inside it (the `public` and `netlify` folders plus
   `netlify.toml`, `package.json` and this file) into the GitHub upload box.
5. Click **Commit changes**.

### 2. Connect it to Netlify
1. Make a free account at netlify.com and choose to sign in with GitHub.
2. Click **Add new site**, then **Import an existing project**, then **GitHub**.
3. Pick the `lone-duck-usa-sports` repository.
4. The settings fill in on their own: publish directory `public`, functions
   directory `netlify/functions`. Leave the build command empty.
5. Click **Deploy**. It takes a minute or two.

### 3. Check that it works
1. Open `https://YOUR-SITE.netlify.app/api/scores`. You should see a page of
   data that starts with `{"updatedAt":`. The `errors` list near the end
   should be empty or short.
2. Open the main site. "Scores as of" should show today's time, and clicking
   any team should load its full roster within a second or two.

You can change the site name, or connect your own domain, in Netlify under
**Site configuration**, then **Domain management**.

## How updating works
- Scores and standings refresh every minute while games are live and every
  five minutes otherwise, whenever someone has the page open.
- Netlify keeps a copy of each answer for 60 seconds (rosters for 30 minutes),
  so ESPN gets asked about once a minute at most, no matter how many visitors
  you have.
- If ESPN can't be reached, the site keeps showing the built-in data.

## What's still entered by hand
- Captain "C"/"A" and two-way "TW" tags show only for players entered before
  the switch to automatic updates.
- Win-chance percentages appear only on games entered by hand.
- The MLB playoff bracket is hidden once it's more than three days old.
- Pick'em picks are saved on each visitor's own device. There's no shared
  leaderboard on Netlify yet.

## If something breaks
ESPN's data feeds are free but unofficial, so ESPN can change them without
warning. If scores stop updating, open `/api/scores`, copy the `errors` list,
and send it to Claude along with `netlify/lib/espn.mjs`.

Updating the site later: edit or replace files on GitHub, and Netlify
redeploys automatically within a minute or two.
