import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const defaultNewsPath = path.resolve(__dirname, '../data/fallbackNews.json')

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5050),
  mongoUri: process.env.MONGO_URI ?? '',
  newsDatasetPath: process.env.NEWS_DATASET_PATH ?? defaultNewsPath,
  csvPredictionDatasetPath: process.env.CSV_PREDICTION_DATASET_PATH ?? './server/data/uploads/data.csv',
  apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:5050',
  clientBaseUrl: process.env.CLIENT_BASE_URL ?? 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-env',
  adminAccessKey: process.env.ADMIN_ACCESS_KEY ?? '',
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpSecure: String(process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true',
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  emailFrom: process.env.EMAIL_FROM ?? '',
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
}
