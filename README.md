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

This app deploys automatically from `main` via GitHub Actions. The workflow builds the Vite app and publishes the `dist` folder to GitHub Pages.

Live site: https://etchsnap.techjeeper.com

If Pages was previously serving the raw repo (`/src/main.tsx` MIME errors), re-run the **Deploy to GitHub Pages** workflow after merging these changes. In repo settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

## Notes

- Image generation uses Google's `gemini-2.5-flash-image` model or OpenAI's `gpt-image-1` model.
- Laser mode post-processes output to pure black artwork on a transparent background.
- SVG export vectorizes the generated artwork for laser cutters and design tools.
- Results depend on your prompt, photo quality, and selection area — iterate for best engraving output.
