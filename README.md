# Dinner Plan 🍽️

A small web app that suggests what's for dinner and picks who's cooking it.

## What it does

- **Cooks**: add the people who take turns making dinner (and remove them).
- **Meals**: comes with starter meals. Add your own or remove ones you don't want.
- **Tonight**: picks a meal and a cook. You can re-roll either one, then **lock it in**.
- **This week**: plans 7 dinners. Cooking turns are shared out evenly, and meals don't repeat until the list runs out.
- **Fair picks**: the app keeps a history of locked-in dinners, so it picks whoever has cooked least lately, never gives the same person two nights in a row, and avoids meals you had recently.

Everything is saved in your browser (localStorage). No account or server needed.

## Running it

Open `index.html` in a browser.

To put it online for free, turn on GitHub Pages: **Settings → Pages → Deploy from a branch → `main` / root**. The app will then be at `https://<your-username>.github.io/Dinner-Plan/`.
