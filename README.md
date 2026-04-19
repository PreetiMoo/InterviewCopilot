# InterviewCopilot

Chrome Extension (Manifest V3) plus a Node/Express API backed by MongoDB. The extension scrapes job listings (LinkedIn jobs, Glassdoor), generates tailored interview questions with Google Gemini, and stores practice sessions in MongoDB.

## Project layout

- `extension/` — React 18 + Vite + Tailwind, built into `extension/dist/` for loading in Chrome
- `server/` — Express + Mongoose API (`server.js`, routes, controllers, models)

## Server (`/server`)

### Prerequisites

- Node.js 18+
- MongoDB reachable via `MONGODB_URI`
- A [Google AI Studio](https://aistudio.google.com/) API key for Gemini

### Setup

1. Copy environment template and fill in values:

   ```bash
   cd server
   cp .env.example .env
   ```

2. Install dependencies and start:

   ```bash
   npm install
   npm start
   ```

   The API listens on `http://localhost:5000` by default (`PORT` in `.env`).

### API

- `POST /api/generate-questions` — body: `{ jobTitle, company, cultureSignals }`
- `POST /api/get-feedback` — body: `{ sessionId, question, answer, jobTitle, company }`
- `GET /api/sessions` — last 20 sessions, newest first

## Extension (`/extension`)

### Build

```bash
cd extension
npm install
npm run build
```

Load the **unpacked** extension from `extension/dist/` (not the repo root).

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the folder `extension/dist`

### Side panel

1. Pin the extension if you like
2. Click the toolbar icon to open the **popup**, then click **Open Panel** (Chrome requires a user gesture to open the side panel)
3. Use **Detect** on a supported job URL, then **Generate Interview Questions**

### Backend URL

- Default API base URL is `http://localhost:5000`, stored in `chrome.storage.local` under `backendUrl`
- In the side panel header, click the **settings (gear)** icon to change the URL (for example after you deploy the API)
- If you call a host other than `localhost` / `127.0.0.1`, add that origin to `host_permissions` in `extension/public/manifest.json`, then run `npm run build` again

### Supported job pages (content script)

- `https://www.linkedin.com/jobs/*`
- `https://www.glassdoor.com/*`
- `https://www.glassdoor.co.in/*`

Scraping runs after a short delay; if fields cannot be read reliably, the extension switches to **manual mode** so you can paste company, title, and description.

## Environment variables (server)

| Variable         | Description                          |
|-----------------|--------------------------------------|
| `GEMINI_API_KEY`| Google Gemini API key                |
| `GEMINI_FREE_TIER` | Set to `1` (default) to call **1.5 Flash-8B / 1.5 Flash-002** before 2.x models—free tier often has **no quota** on `gemini-2.0-flash` (`limit: 0`). Set to `0` to prefer 2.x first. |
| `GEMINI_MODEL`  | Optional: pin a single model id. See [Gemini models](https://ai.google.dev/gemini-api/docs/models) and [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits). |
| `MONGODB_URI`   | MongoDB connection string            |
| `PORT`          | HTTP port (default `5000`)           |

See `server/.env.example`.

## Host privacy policy on GitHub Pages

This repo includes a publish-ready page at `docs/index.html`.

1. Push your latest changes to GitHub.
2. Open your repository on GitHub.
3. Go to **Settings** -> **Pages**.
4. Under **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` (or your default branch)
   - **Folder**: `/docs`
5. Click **Save**.
6. Wait for deployment to finish (usually 1-3 minutes).
7. Your public policy URL will be:
   - `https://<your-username>.github.io/<your-repo>/`

For Chrome Web Store submission, use that GitHub Pages URL as your privacy policy link.
