import mongoose from 'mongoose'

const loginEventSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    role: { type: String, enum: ['admin', 'user'], required: true },
    status: { type: String, enum: ['success', 'failed'], required: true },
    reason: { type: String, default: '' },
    ipAddress: { type: String, default: '' },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

export const LoginEventModel =
  mongoose.models.LoginEvent || mongoose.model('LoginEvent', loginEventSchema)

