import mongoose from 'mongoose'

const watchlistSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    symbols: { type: [String], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

export const WatchlistModel = mongoose.models.Watchlist || mongoose.model('Watchlist', watchlistSchema)
