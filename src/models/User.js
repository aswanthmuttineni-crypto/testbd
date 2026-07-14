import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["ADMIN", "TENANT"], default: "ADMIN" },
    plainPassword: { type: String, default: "" },
    // FCM device tokens for free push notifications (one user may sign in on several devices)
    fcmTokens: { type: [String], default: [] }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
