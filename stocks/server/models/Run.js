import mongoose from 'mongoose'

const runSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    requestedBy: { type: String, required: true, index: true },
    requestedRole: { type: String, enum: ['admin', 'user'], required: true },
    stock: { type: String, required: true },
    correlation: { type: Number, required: true },
    model: { type: String, required: true },
    dateFrom: { type: String, required: true },
    dateTo: { type: String, required: true },
    sampleSize: { type: Number, required: true },
    runType: { type: String, enum: ['correlation', 'csv_prediction'], default: 'correlation' },
    predictionLabel: { type: String, enum: ['UP', 'DOWN', null], default: null },
    predictionProbability: { type: Number, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

export const RunModel = mongoose.models.Run || mongoose.model('Run', runSchema)
