export function removeFrameBorder(imageData: ImageData): boolean {
  const { width, height, data } = imageData
  if (width < 8 || height < 8) return false

  const maxScan = Math.min(
    Math.max(6, Math.floor(Math.min(width, height) * 0.14)),
    56,
  )

  const alphaAt = (x: number, y: number) => data[(y * width + x) * 4 + 3]
  const lumAt = (x: number, y: number) => {
    const i = (y * width + x) * 4
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }

  const isFrameRow = (y: number): boolean => {
    let first = -1
    let last = -1
    const lums: number[] = []

    for (let x = 0; x < width; x += 1) {
      if (alphaAt(x, y) > 35) {
        if (first === -1) first = x
        last = x
        lums.push(lumAt(x, y))
      }
    }

    if (first === -1 || last - first + 1 < width * 0.55) return false

    const avg = lums.reduce((sum, value) => sum + value, 0) / lums.length
    const variance =
      lums.reduce((sum, value) => sum + (value - avg) ** 2, 0) / lums.length

    return variance < 1600
  }

  const isFrameCol = (x: number): boolean => {
    let first = -1
    let last = -1
    const lums: number[] = []

    for (let y = 0; y < height; y += 1) {
      if (alphaAt(x, y) > 35) {
        if (first === -1) first = y
        last = y
        lums.push(lumAt(x, y))
      }
    }

    if (first === -1 || last - first + 1 < height * 0.55) return false

    const avg = lums.reduce((sum, value) => sum + value, 0) / lums.length
    const variance =
      lums.reduce((sum, value) => sum + (value - avg) ** 2, 0) / lums.length

    return variance < 1600
  }

  let top = 0
  let bottom = 0
  let left = 0
  let right = 0

  for (let y = 0; y < maxScan; y += 1) {
    if (isFrameRow(y)) top = y + 1
    else break
  }

  for (let y = height - 1; y >= height - maxScan; y -= 1) {
    if (isFrameRow(y)) bottom = height - y
    else break
  }

  for (let x = 0; x < maxScan; x += 1) {
    if (isFrameCol(x)) left = x + 1
    else break
  }

  for (let x = width - 1; x >= width - maxScan; x -= 1) {
    if (isFrameCol(x)) right = width - x
    else break
  }

  const sides = [top, bottom, left, right].filter((value) => value > 0).length
  if (sides < 3) return false

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inTop = top > 0 && y < top
      const inBottom = bottom > 0 && y >= height - bottom
      const inLeft = left > 0 && x < left
      const inRight = right > 0 && x >= width - right

      if (!(inTop || inBottom || inLeft || inRight)) continue
      if (alphaAt(x, y) <= 35) continue

      const i = (y * width + x) * 4
      data[i + 3] = 0
    }
  }

  return true
}

export function stripOuterEdgePixels(imageData: ImageData, margin = 2): void {
  const { width, height, data } = imageData

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nearEdge =
        x < margin ||
        y < margin ||
        x >= width - margin ||
        y >= height - margin

      if (!nearEdge) continue

      const i = (y * width + x) * 4
      if (data[i + 3] > 35) {
        data[i + 3] = 0
      }
    }
  }
}
