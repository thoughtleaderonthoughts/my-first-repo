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

No build step or API key is required.
