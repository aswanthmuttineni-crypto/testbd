import mongoose from "mongoose";

export async function connectDb() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is missing. Copy .env.example to .env and set MongoDB Atlas URI.");
  }
  await mongoose.connect(uri);
  console.log("MongoDB connected");
}
