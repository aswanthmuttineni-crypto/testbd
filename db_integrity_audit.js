import dotenv from "dotenv";
import mongoose from "mongoose";
import Room from "./src/models/Room.js";
import Tenant from "./src/models/Tenant.js";
import Rent from "./src/models/Rent.js";
import Expense from "./src/models/Expense.js";
import Setting from "./src/models/Setting.js";
import User from "./src/models/User.js";
import { connectDb } from "./src/config/db.js";

dotenv.config();

async function runAudit() {
  console.log("=== STARTING DATABASE INTEGRITY AUDIT ===");
  await connectDb();
  console.log("✔ Connected to database successfully.");

  const issues = [];
  const logIssue = (module, desc, severity = "HIGH") => {
    issues.push({ module, desc, severity });
    console.log(`[${severity}] [${module}] ${desc}`);
  };

  // 1. Check Rooms
  const rooms = await Room.find({});
  const roomsMap = new Map(rooms.map((r) => [String(r._id), r]));
  console.log(`- Auditing ${rooms.length} rooms...`);
  for (const r of rooms) {
    if (r.capacity < 1) {
      logIssue("Room", `Room ${r.roomNo} has invalid capacity: ${r.capacity}`);
    }
    if (r.rentAmount < 0) {
      logIssue("Room", `Room ${r.roomNo} has negative rent amount: ${r.rentAmount}`);
    }
  }

  // 2. Check Tenants
  const tenants = await Tenant.find({});
  const activeBeds = new Map(); // key: roomId_bedNo -> tenantName
  console.log(`- Auditing ${tenants.length} tenants...`);
  for (const t of tenants) {
    // Check room validity
    const room = roomsMap.get(String(t.roomId));
    if (!room) {
      logIssue("Tenant", `Tenant "${t.name}" references non-existent roomId: ${t.roomId}`);
    } else {
      // Check bed index
      if (t.bedNo < 1 || t.bedNo > room.capacity) {
        logIssue("Tenant", `Tenant "${t.name}" assigned to invalid bed ${t.bedNo} in Room ${room.roomNo} (capacity ${room.capacity})`);
      }
      // Check active double booking
      if (t.status === "ACTIVE") {
        const bedKey = `${t.roomId}_${t.bedNo}`;
        if (activeBeds.has(bedKey)) {
          logIssue("Tenant", `Double Booking! Both "${t.name}" and "${activeBeds.get(bedKey)}" are active in Room ${room.roomNo} Bed ${t.bedNo}`);
        } else {
          activeBeds.set(bedKey, t.name);
        }
      }
    }

    if (t.monthlyRent < 0) {
      logIssue("Tenant", `Tenant "${t.name}" has negative monthly rent: ${t.monthlyRent}`);
    }
    if (t.advanceAmount < 0) {
      logIssue("Tenant", `Tenant "${t.name}" has negative advance amount: ${t.advanceAmount}`);
    }
  }

  // 3. Check Rents
  const rents = await Rent.find({});
  console.log(`- Auditing ${rents.length} rent records...`);
  const tenantIds = new Set(tenants.map(t => String(t._id)));
  for (const r of rents) {
    if (!tenantIds.has(String(r.tenantId))) {
      logIssue("Rent", `Rent record for ${r.month} ${r.year} references non-existent tenantId: ${r.tenantId}`);
    }
    if (r.amount < 0) {
      logIssue("Rent", `Rent record for tenant ${r.tenantId} has negative amount: ${r.amount}`);
    }
  }

  // 4. Check Expenses
  const expenses = await Expense.find({});
  console.log(`- Auditing ${expenses.length} expenses...`);
  for (const e of expenses) {
    if (e.amount < 0) {
      logIssue("Expense", `Expense "${e.title}" has negative amount: ${e.amount}`);
    }
  }

  // 5. Check Settings
  const settingsCount = await Setting.countDocuments({});
  if (settingsCount === 0) {
    logIssue("Setting", "No settings document found. The system needs settings to function properly.", "MEDIUM");
  } else if (settingsCount > 1) {
    logIssue("Setting", `Multiple settings documents found (${settingsCount}). There should be exactly one.`, "LOW");
  }

  console.log("\n=== DATABASE INTEGRITY AUDIT SUMMARY ===");
  if (issues.length === 0) {
    console.log("🎉 NO DATABASE INTEGRITY ISSUES FOUND!");
  } else {
    console.log(`⚠️ FOUND ${issues.length} INTEGRITY ISSUES!`);
  }
  
  mongoose.disconnect();
  process.exit(issues.length > 0 ? 1 : 0);
}

runAudit().catch((err) => {
  console.error("Audit failed to execute:", err);
  process.exit(1);
});
