# EtchSnap

Turn a top-down photo of any object into a transparent PNG design ready for **UV printing** or **laser engraving**.

## Features

- Paste your **Gemini API key** (stored locally in the browser)
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

## API key

Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

Your key never leaves your browser except when calling Google's Gemini API directly from the app.

## Production build

```bash
npm run build
npm run preview
```

## Notes

- Image generation uses Google's `gemini-2.5-flash-image` model.
- Laser mode post-processes output to pure black artwork on a transparent background.
- SVG export vectorizes the generated artwork for laser cutters and design tools.
- Results depend on your prompt, photo quality, and selection area — iterate for best engraving output.
