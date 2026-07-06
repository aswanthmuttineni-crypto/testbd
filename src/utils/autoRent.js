import Rent from "../models/Rent.js";
import Tenant from "../models/Tenant.js";
import { MONTHS } from "./monthlyDues.js";

/**
 * For every active tenant, create a PENDING rent record for every month
 * from their joining month up to and including the current month,
 * if no record already exists for that month/year.
 */
export async function autoGenerateRents() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  const activeTenants = await Tenant.find({ status: "ACTIVE" });
  let created = 0;

  for (const tenant of activeTenants) {
    const joinDate = new Date(tenant.joiningDate);
    let y = joinDate.getFullYear();
    let m = joinDate.getMonth(); // 0-indexed

    // Walk from joining month up to and including current month
    while (y < currentYear || (y === currentYear && m <= currentMonth)) {
      const monthName = MONTHS[m];

      const exists = await Rent.exists({ tenantId: tenant._id, month: monthName, year: y });
      if (!exists) {
        await Rent.create({
          tenantId: tenant._id,
          month: monthName,
          year: y,
          amount: tenant.monthlyRent,
          status: "PENDING"
        });
        created++;
        console.log(`[AutoRent] Created PENDING: ${tenant.name} - ${monthName} ${y}`);
      }

      m++;
      if (m > 11) { m = 0; y++; }
    }
  }

  if (created > 0) console.log(`[AutoRent] Done. Created ${created} pending rent records.`);
  return created;
}

/**
 * Schedule auto-generation: run on startup + every day at midnight
 * to catch the 1st of each new month.
 */
export function startRentScheduler() {
  // Run immediately on startup
  autoGenerateRents().catch(console.error);

  // Run every 24 hours
  setInterval(() => {
    autoGenerateRents().catch(console.error);
  }, 24 * 60 * 60 * 1000);

  console.log("[AutoRent] Scheduler started.");
}
