# U.S. Open Pool

A small live web app for running the golf pool.

## Run it

```sh
ADMIN_PASSWORD="pick-a-password" npm start
```

Then open:

```text
http://localhost:4173
```

## What it does

- Players submit 8 picks from the required tiers.
- Admin can mark paid entries, delete entries, and update golfer scores.
- Leaderboard updates live for everyone connected to the app.
- Best 4 golfer totals count.
- Missed-cut golfers receive +10 for blank Saturday and Sunday rounds.
- Winner bonus is -5.
- Other top-5 finishers receive -2.
- Ties sort by 5th-best golfer score, then 6th, then 7th, then 8th.

## Score CSV Import

Paste rows in this format:

```csv
golfer,r1,r2,r3,r4,status,finish
Scottie Scheffler,-2,-1,-3,-1,active,1
Aaron Rai,1,0,,,mc,
```

Use `active`, `mc`, or `wd` for status.

## Deploy It

This app is ready to deploy on Render.

1. Push this folder to a GitHub repo.
2. In Render, choose **New > Blueprint** and select the repo.
3. Render will read `render.yaml`.
4. Add a private `ADMIN_PASSWORD` value when Render asks for environment variables.
5. Deploy.

The Render setup includes a persistent disk mounted at `/var/data`, so entries and scores survive restarts and deploys.

## Admin Access

Everyone can view the leaderboard and submit picks. Only someone with the `ADMIN_PASSWORD` can:

- update golfer scores
- import score CSV rows
- mark entries paid or unpaid
- delete entries
