const GEMINI_ASPECT_RATIOS: Array<{ label: string; value: number }> = [
  { label: '1:1', value: 1 },
  { label: '2:3', value: 2 / 3 },
  { label: '3:2', value: 3 / 2 },
  { label: '3:4', value: 3 / 4 },
  { label: '4:3', value: 4 / 3 },
  { label: '4:5', value: 4 / 5 },
  { label: '5:4', value: 5 / 4 },
  { label: '9:16', value: 9 / 16 },
  { label: '16:9', value: 16 / 9 },
  { label: '21:9', value: 21 / 9 },
]

export function pickGeminiAspectRatio(width: number, height: number): string {
  const target = width / Math.max(height, 1)
  let best = GEMINI_ASPECT_RATIOS[0]
  let bestDist = Number.POSITIVE_INFINITY

  for (const ratio of GEMINI_ASPECT_RATIOS) {
    const distance = Math.abs(Math.log(ratio.value / target))
    if (distance < bestDist) {
      best = ratio
      bestDist = distance
    }
  }

  return best.label
}

export function describeAspectRatio(width: number, height: number): string {
  const roundedW = Math.max(1, Math.round(width))
  const roundedH = Math.max(1, Math.round(height))
  const ratio = width / Math.max(height, 1)
  const picked = pickGeminiAspectRatio(width, height)

  if (ratio >= 1.22) {
    return `${roundedW}:${roundedH}, a WIDE landscape canvas (generate at ${picked}). Spread the artwork across the full WIDTH so it fills this region. Do not place a square badge, stamp, or icon in the center with empty side margins.`
  }

  if (ratio <= 0.82) {
    return `${roundedW}:${roundedH}, a TALL portrait canvas (generate at ${picked}). Stretch the artwork along the full HEIGHT so it fills this region. Do not place a square badge, stamp, or icon in the center with empty top and bottom margins.`
  }

  return `${roundedW}:${roundedH}, a nearly square canvas (generate at ${picked}). Fill this square. A compact emblem is OK only because the region itself is square.`
}
