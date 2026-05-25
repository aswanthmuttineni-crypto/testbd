import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { connectDb } from "../src/config/db.js";
import User from "../src/models/User.js";
import Room from "../src/models/Room.js";
import Setting from "../src/models/Setting.js";

dotenv.config();

await connectDb();

await User.updateOne(
  { email: "admin@gmail.com" },
  {
    name: "Admin",
    email: "admin@gmail.com",
    password: await bcrypt.hash("admin123", 10),
    role: "ADMIN"
  },
  { upsert: true }
);

if ((await Room.countDocuments()) === 0) {
  await Room.insertMany([
    { roomNo: "101", floor: 1, capacity: 3, rentAmount: 5000 },
    { roomNo: "102", floor: 1, capacity: 2, rentAmount: 4500 },
    { roomNo: "201", floor: 2, capacity: 4, rentAmount: 5500 }
  ]);
}

await Setting.updateOne({}, {}, { upsert: true });

console.log("Seed complete. Login: admin@gmail.com / admin123");
process.exit(0);
