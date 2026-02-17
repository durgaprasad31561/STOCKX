export function mean(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function variance(values) {
  if (values.length <= 1) return 0
  const avg = mean(values)
  return values.reduce((acc, value) => acc + (value - avg) ** 2, 0) / (values.length - 1)
}

export function pearsonCorrelation(xs, ys) {
  if (xs.length !== ys.length || xs.length < 2) return 0
  const avgX = mean(xs)
  const avgY = mean(ys)

  let numerator = 0
  let sumX = 0
  let sumY = 0

  for (let i = 0; i < xs.length; i += 1) {
    const dx = xs[i] - avgX
    const dy = ys[i] - avgY
    numerator += dx * dy
    sumX += dx ** 2
    sumY += dy ** 2
  }

  const denominator = Math.sqrt(sumX * sumY)
  if (denominator === 0) return 0
  return numerator / denominator
}

export function rollingCorrelation(points, windowSize = 30) {
  const out = []
  if (!points.length) return out

  for (let i = 0; i < points.length; i += 1) {
    const start = Math.max(0, i - windowSize + 1)
    const slice = points.slice(start, i + 1)
    if (slice.length < 2) continue

    const sentiments = slice.map((p) => p.sentiment)
    const returns = slice.map((p) => p.return)
    out.push({
      date: points[i].date,
      value: Number(pearsonCorrelation(sentiments, returns).toFixed(4)),
    })
  }

  return out
}

