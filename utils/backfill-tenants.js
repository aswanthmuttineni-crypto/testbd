import dotenv from "dotenv";
import { connectDb } from "../src/config/db.js";
import Tenant from "../src/models/Tenant.js";

dotenv.config();

await connectDb();

const result = await Tenant.updateMany(
  {},
  [
    {
      $set: {
        email: { $ifNull: ["$email", ""] },
        aadhaarNo: { $ifNull: ["$aadhaarNo", ""] },
        guardianName: { $ifNull: ["$guardianName", ""] },
        guardianPhone: { $ifNull: ["$guardianPhone", ""] },
        address: { $ifNull: ["$address", ""] },
        notes: { $ifNull: ["$notes", ""] }
      }
    }
  ]
);

const invalidProofs = await Tenant.updateMany(
  { idProof: { $type: "string" } },
  { $unset: { idProof: "" } }
);

console.log(`Backfilled tenant fields on ${result.modifiedCount} records.`);
console.log(`Removed invalid idProof values from ${invalidProofs.modifiedCount} records.`);
process.exit(0);
