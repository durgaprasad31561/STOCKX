import fs from 'node:fs/promises'
import path from 'node:path'
import { WatchlistModel } from '../models/Watchlist.js'

const storagePath = path.resolve(process.cwd(), 'server/storage/watchlists.json')
const MAX_WATCHLIST_ITEMS = 30

function sanitizeSymbol(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._^=-]/g, '')
}

function normalizeSymbols(symbols) {
  const unique = new Set()
  for (const symbol of symbols || []) {
    const clean = sanitizeSymbol(symbol)
    if (clean) unique.add(clean)
  }
  return Array.from(unique).slice(0, MAX_WATCHLIST_ITEMS)
}

async function readFileWatchlists() {
  try {
    const raw = await fs.readFile(storagePath, 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

async function writeFileWatchlists(payload) {
  await fs.writeFile(storagePath, JSON.stringify(payload, null, 2), 'utf8')
}

export async function getUserWatchlist({ useMongo, username }) {
  if (!username) return []

  if (useMongo) {
    const doc = await WatchlistModel.findOne({ username }).lean()
    return normalizeSymbols(doc?.symbols || [])
  }

  const payload = await readFileWatchlists()
  return normalizeSymbols(payload[username] || [])
}

export async function addUserWatchlistSymbol({ useMongo, username, symbol }) {
  const clean = sanitizeSymbol(symbol)
  if (!username || !clean) throw new Error('A valid symbol is required.')

  if (useMongo) {
    const doc = await WatchlistModel.findOneAndUpdate(
      { username },
      { $setOnInsert: { username }, $addToSet: { symbols: clean } },
      { upsert: true, new: true },
    ).lean()
    const normalized = normalizeSymbols(doc?.symbols || [])
    if (normalized.length !== (doc?.symbols || []).length) {
      await WatchlistModel.updateOne({ username }, { $set: { symbols: normalized } })
    }
    return normalized
  }

  const payload = await readFileWatchlists()
  const next = normalizeSymbols([...(payload[username] || []), clean])
  payload[username] = next
  await writeFileWatchlists(payload)
  return next
}

export async function removeUserWatchlistSymbol({ useMongo, username, symbol }) {
  const clean = sanitizeSymbol(symbol)
  if (!username || !clean) throw new Error('A valid symbol is required.')

  if (useMongo) {
    const doc = await WatchlistModel.findOneAndUpdate(
      { username },
      { $pull: { symbols: clean } },
      { new: true },
    ).lean()
    return normalizeSymbols(doc?.symbols || [])
  }

  const payload = await readFileWatchlists()
  const current = normalizeSymbols(payload[username] || [])
  payload[username] = current.filter((item) => item !== clean)
  await writeFileWatchlists(payload)
  return payload[username]
}
