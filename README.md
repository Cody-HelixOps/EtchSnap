# EtchSnap

Turn a top-down photo of any object into a transparent PNG design ready for **UV printing** or **laser engraving**.

## Features

- Paste your **Gemini** or **OpenAI / ChatGPT** API key (stored locally in the browser)
- Upload a top-down photo of your object
- **Click around the edges** to outline the surface area — lines connect each point
- Describe the artwork you want
- Choose **Full color** (UV) or **Black & white** (laser)
- Generate and **download a transparent PNG or vector SVG**

## Quick start

```bash
cd C:\Projects\EtchSnap
npm install
npm run dev
```

Open the local URL shown in the terminal (usually `http://localhost:5173`).

## Privacy

**Your API key stays in your browser only.** EtchSnap has no backend. Keys are saved in your browser's local storage and are sent only to the AI provider you select (Google Gemini or OpenAI) when you generate a design.

## API keys

- **Gemini:** [Google AI Studio](https://aistudio.google.com/apikey)
- **OpenAI / ChatGPT:** [OpenAI Platform](https://platform.openai.com/api-keys) (uses `gpt-image-1` via the Images API)

You bring your own key for whichever provider you choose.

## Production build

```bash
npm run build
npm run preview
```

## GitHub Pages

The production build outputs to the `docs/` folder, which GitHub Pages serves from the `main` branch.

Live site: https://etchsnap.techjeeper.com

### One-time GitHub setting

In the repo, open **Settings → Pages** and set:

- **Source:** Deploy from a branch
- **Branch:** `main`
- **Folder:** `/docs`

If you previously deployed from repo root, that caused the `/src/main.tsx` MIME error because GitHub was serving source files instead of the built app.

After changing the folder to `/docs`, wait a minute and hard-refresh the site.

### Optional: GitHub Actions deploy

There is also a `.github/workflows/deploy.yml` workflow that can deploy the built `dist` folder via GitHub Actions. To use it, set **Pages → Source** to **GitHub Actions** instead.

## Notes

- Image generation uses Google's `gemini-2.5-flash-image` model or OpenAI's `gpt-image-1` model.
- Laser mode post-processes output to pure black artwork on a transparent background.
- SVG export vectorizes the generated artwork for laser cutters and design tools.
- Results depend on your prompt, photo quality, and selection area — iterate for best engraving output.
