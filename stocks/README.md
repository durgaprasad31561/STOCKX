# StockSentix

StockSentix is a full-stack educational project for:

1. Converting daily market headlines into sentiment features.
2. Aligning sentiment with next-day returns for a watchlist.
3. Measuring correlation with time-aware alignment (no look-ahead in feature/label join).
4. Storing experiment runs in MongoDB (or local file fallback).
5. Visualizing scatter and rolling 30-day correlation in a premium dashboard.

## Tech Stack

1. Frontend: React, Tailwind CSS, Framer Motion, Recharts
2. Backend: Node.js, Express
3. Storage: MongoDB (optional) + JSON fallback (`server/storage/runs.json`)
4. Data inputs:
   - Yahoo chart API for daily close prices (fallback to synthetic price path if unavailable)
   - Kaggle-style CSV news file (`Combined_News_DJIA.csv`) or bundled fallback news JSON

## Project Structure

1. `src/`: frontend app and UI components
2. `server/app.js`: Express API entry point
3. `server/routes/analysisRoutes.js`: run-analysis and history APIs
4. `server/services/analysisService.js`: sentiment-return alignment and statistics
5. `server/services/sentimentService.js`: VADER-like and FinBERT-like scoring
6. `server/services/dataSourceService.js`: news + market data loaders
7. `server/services/runStore.js`: Mongo/file run persistence

## Setup

1. Install dependencies:
```bash
npm install
```
2. Create environment file:
```bash
copy .env.example .env
```
3. Optional: configure `MONGO_URI` and `NEWS_DATASET_PATH` in `.env`.

## Run

1. Start frontend + backend together:
```bash
npm run dev
```
2. Frontend: `http://localhost:5173`
3. Backend: `http://localhost:5050`

## API

1. `GET /api/health`
2. `POST /api/auth/register`
3. `POST /api/auth/login`
4. `POST /api/auth/forgot-password-otp`
5. `POST /api/auth/reset-password-otp`
6. `GET /api/auth/users` (admin only)
7. `DELETE /api/auth/users/:id` (admin only)
8. `GET /api/auth/searches` (admin only)
9. `GET /api/auth/events` (admin only)
10. `GET /api/history` (auth required)
11. `POST /api/run` (auth required)

Example request:

```json
{
  "ticker": "AAPL",
  "model": "FinBERT",
  "dateFrom": "2026-01-01",
  "dateTo": "2026-02-13"
}
```

Response includes:

1. `correlation`
2. `explanation`
3. `sampleSize`
4. `scatterData`
5. `rollingCorrelation`
6. `sentimentFeatures`

## Validation

1. Lint:
```bash
npm run lint
```
2. Build:
```bash
npm run build
```

## Notes

1. This project is for educational analysis, not trading advice.
2. The FinBERT mode is a finance-lexicon approximation, not the full transformer model.
3. If live market data is unavailable, the backend falls back to synthetic prices so the full pipeline still runs.
4. Login attempts are stored in MongoDB Atlas `loginevents` collection, users are in `users`, and run/search history is in `runs`.
5. Set `ADMIN_ACCESS_KEY` for admin register/login passkey checks.
6. Do not use your Atlas connection password as app passkey; keep DB credentials and app auth secrets separate.
