import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'user'], required: true, index: true },
    isEmailVerified: { type: Boolean, default: false, index: true },
    emailVerificationTokenHash: { type: String, default: null, index: true },
    emailVerificationExpiresAt: { type: Date, default: null },
    emailVerificationOtpHash: { type: String, default: null, index: true },
    emailVerificationOtpExpiresAt: { type: Date, default: null },
    passwordResetOtpHash: { type: String, default: null, index: true },
    passwordResetOtpExpiresAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

export const UserModel = mongoose.models.User || mongoose.model('User', userSchema)
