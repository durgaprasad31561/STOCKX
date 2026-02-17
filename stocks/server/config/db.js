import mongoose from 'mongoose'
import { env } from './env.js'

export async function connectMongo() {
  if (!env.mongoUri) return false

  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 3000 })
    return true
  } catch (error) {
    console.warn(`[db] Mongo unavailable, fallback to file storage: ${error.message}`)
    return false
  }
}

