export function parseDateInput(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`)
  }
  return d
}

export function toIsoDate(date) {
  return date.toISOString().slice(0, 10)
}

export function addDays(date, days) {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

export function epochSeconds(date) {
  return Math.floor(date.getTime() / 1000)
}

