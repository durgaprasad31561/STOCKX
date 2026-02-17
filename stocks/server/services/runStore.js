import fs from 'node:fs/promises'
import path from 'node:path'
import { RunModel } from '../models/Run.js'

const storagePath = path.resolve(process.cwd(), 'server/storage/runs.json')

async function readFileRuns() {
  try {
    const raw = await fs.readFile(storagePath, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeFileRuns(runs) {
  await fs.writeFile(storagePath, JSON.stringify(runs.slice(0, 100), null, 2), 'utf8')
}

export async function saveRun(run, { useMongo }) {
  if (useMongo) {
    await RunModel.create(run)
    return
  }
  const current = await readFileRuns()
  current.unshift(run)
  await writeFileRuns(current)
}

export async function getRecentRuns({ useMongo, limit = 20, requestedBy = null }) {
  if (useMongo) {
    const filter = requestedBy ? { requestedBy } : {}
    return RunModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean()
  }
  const current = await readFileRuns()
  const filtered = requestedBy ? current.filter((row) => row.requestedBy === requestedBy) : current
  return filtered.slice(0, limit)
}
