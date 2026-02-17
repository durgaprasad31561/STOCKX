const genericLexicon = {
  gain: 1.6,
  growth: 1.4,
  rally: 1.8,
  beat: 1.7,
  strong: 1.1,
  upgrade: 1.6,
  jump: 1.5,
  improve: 1.2,
  risk: -1.1,
  weak: -1.3,
  miss: -1.7,
  slump: -1.8,
  downgrade: -1.6,
  crash: -2.2,
  fall: -1.4,
  volatile: -0.6,
}

const financeLexicon = {
  bullish: 2.1,
  outperform: 2,
  guidance: 0.9,
  margin: 0.8,
  buyback: 1.4,
  inflow: 1.1,
  beat: 1.6,
  miss: -1.8,
  bearish: -2.1,
  downgrades: -1.6,
  recession: -1.7,
  inflation: -0.9,
  outflow: -1.2,
  lawsuit: -1.4,
  default: -2,
}

const negations = new Set(['no', 'not', 'never', 'without', 'hardly'])
const intensifiers = new Set(['very', 'highly', 'significantly', 'extremely'])

function cleanToken(token) {
  return token.toLowerCase().replace(/[^a-z]/g, '')
}

function scoreWithLexicon(text, lexicon, { applyBoosters }) {
  const tokens = text.split(/\s+/).map(cleanToken).filter(Boolean)
  if (!tokens.length) return 0

  let score = 0
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    const base = lexicon[token]
    if (!base) continue

    const prev = tokens[i - 1]
    let adjusted = base

    if (prev && negations.has(prev)) adjusted *= -0.7
    if (applyBoosters && prev && intensifiers.has(prev)) adjusted *= 1.25
    score += adjusted
  }

  return score / Math.max(1, Math.sqrt(tokens.length))
}

export function scoreHeadline(text, model = 'VADER') {
  if (!text || typeof text !== 'string') return 0
  const mode = model.toUpperCase()
  if (mode === 'FINBERT') {
    return scoreWithLexicon(text, { ...genericLexicon, ...financeLexicon }, { applyBoosters: true })
  }
  return scoreWithLexicon(text, genericLexicon, { applyBoosters: true })
}

export function computeDailySentiment(headlinesByDate, model) {
  const daily = []
  for (const [date, headlines] of Object.entries(headlinesByDate)) {
    if (!headlines.length) continue
    const values = headlines.map((text) => scoreHeadline(text, model))
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    const variance =
      values.length > 1
        ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
        : 0
    daily.push({
      date,
      sentimentMean: Number(mean.toFixed(4)),
      sentimentVariance: Number(variance.toFixed(4)),
      headlineCount: headlines.length,
      positiveHeadlineCount: values.filter((value) => value > 0).length,
      negativeHeadlineCount: values.filter((value) => value < 0).length,
    })
  }

  return daily.sort((a, b) => a.date.localeCompare(b.date))
}
