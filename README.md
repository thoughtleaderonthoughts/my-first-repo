# Bright Reads

Bright Reads is a cheerful, browser-based reading practice app for children in kindergarten through second grade. Children choose a short story and read it aloud one word at a time. The current word glows yellow; correctly recognized words turn green before the app advances.

## Features

- Eight original stories across kindergarten, first-grade, and second-grade levels
- Grade-level library filters and responsive book cards
- Guided, word-by-word reading using the browser's Web Speech API
- A sound-it-out phonics panel that highlights letter teams as speech is recognized
- A choice of installed English voices, plus read-aloud help for a single word or the full page
- Page progress, encouraging feedback, and a completion celebration
- Keyboard-accessible controls and reduced-motion support

## Preview the app

The easiest way to preview Bright Reads is to run:

```bash
python3 preview.py
```

This starts a local server and opens <http://localhost:8000> in your default browser. Press <kbd>Ctrl</kbd>+<kbd>C</kbd> in the terminal when you are finished. Use `python3 preview.py --no-browser` if you only want to start the server, or `python3 preview.py --port 3000` to choose another port.

Chrome or Edge currently offer the broadest support for browser speech recognition. Allow microphone access when prompted. The microphone works on `localhost`; opening `index.html` directly from the filesystem may prevent the browser from requesting access.

The **Story voice** menu shows the English text-to-speech voices provided by your browser and device. Newer operating-system voices often sound more natural. Premium cloud voices such as ElevenLabs require a separate account, API key, internet service, and usage plan, so Bright Reads does not send children's reading or story text to one by default.

## Optional: install Playwright for automated previews

If you want to take screenshots or run browser automation on your own computer, install Playwright and its Chromium browser:

```bash
npm init -y
npm install --save-dev @playwright/test
npx playwright install chromium
```

The hosted coding environment used to build this app currently blocks those downloads with HTTP 403 responses, so the browser could not be installed here. The one-command Python preview above has no external dependencies and works with a browser already installed on your computer.

No build step is required. Stories and read-aloud work without an account; cloud progress requires the free Supabase setup below.

## Reader accounts and progress

Open **My reading account** and sign in using an email link. Use a parent or guardian's email and a reader nickname. One reader profile is supported per sign-in account.

- Progress syncs after each recognized word. Refresh progress or return to the browser window to fetch another device's changes.
- The dashboard shows unique books completed, pages completed, word positions mastered, and books in progress. Re-reading does not inflate these totals.
- The bookshelf shows grade, completed pages, and first completion date, with Continue or Read again buttons.
- All three pages must be read to finish a book. Skipping pages and playing read-aloud do not count as reading progress.
- **Reset everything** clears cloud progress, nickname, and voice/speed preferences after confirmation. It retains the authentication account. Other devices refresh the reset state; stale writes are rejected.
- The voice picker lists actual English voices supplied by the device/browser. Use **Try** to sample them, and choose Slow, Gentle, or Natural speed. Your voice preference syncs; a missing voice falls back to the browser default on another device.

Cloud saving requires a connection. Failed saves remain queued in the open tab and can be retried with **Refresh progress**. Keep the tab open until it reports saved; offline durability is not provided. Signed-out practice is not saved or later imported.

## Connect Supabase (free hosted plan)

1. Create a free project at <https://supabase.com/dashboard>.
2. In **SQL Editor**, paste and run `supabase/setup.sql`. It creates the account table, row-level access policy, and transactional progress/reset function. It is safe to run again.
3. Set `supabaseUrl` and `supabasePublishableKey` in `app-config.js` using your project's public URL and publishable key (legacy anon key also works). Never use a service-role or secret key in this file.
4. In **Authentication → URL Configuration**, set the Site URL to your app URL, and allow `http://localhost:8000/` as a redirect while testing. For a published site, add its full HTTPS URL too. Each device needs access to a running copy of the app with the same project settings; localhost always refers to that device.
5. Enable Email authentication and keep signups enabled. Configure SMTP for inviting real users: Supabase's default mail service restricts recipients and is intended for testing. See <https://supabase.com/docs/guides/auth/auth-smtp>.
6. Open My reading account, enter the parent email, and open the sign-in link. Repeat on a second device with the same email to see saved progress.

Until configured, sign-in is visibly unavailable and the library remains usable. Supabase stores the account email, reader nickname, voice preferences, and reading progress. The app does not upload microphone recordings to Supabase; browser speech recognition may use its own online service.

## Development checks

Use Node.js 22+ and pnpm 10+:

```bash
pnpm install --frozen-lockfile
pnpm test
node --check script.js
node --check account.js
python -m py_compile preview.py
```

Tests run a local PostgreSQL-compatible database through PGlite to exercise the actual SQL: user isolation, progress validation, first completion, duplicate saves, reset, and stale-device rejection. No production credentials are required.
