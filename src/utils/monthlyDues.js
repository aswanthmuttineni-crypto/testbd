import Rent from "../models/Rent.js";
import "../models/Room.js";
import Tenant from "../models/Tenant.js";

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

export function currentRentPeriod(date = new Date()) {
  return {
    month: MONTHS[date.getMonth()],
    year: date.getFullYear()
  };
}

export async function getMonthlyDues(period = currentRentPeriod()) {
  const [activeTenants, rents] = await Promise.all([
    Tenant.find({ status: "ACTIVE" }).populate("roomId", "roomNo floor capacity").sort({ name: 1 }),
    Rent.find({ month: period.month, year: period.year })
  ]);

  const paidTenantIds = new Set(
    rents
      .filter((rent) => rent.status === "PAID")
      .map((rent) => String(rent.tenantId))
  );
  const rentByTenantId = new Map(rents.map((rent) => [String(rent.tenantId), rent]));

  const dues = activeTenants
    .filter((tenant) => !paidTenantIds.has(String(tenant._id)))
    .map((tenant) => {
      const rent = rentByTenantId.get(String(tenant._id));
      return {
        tenant,
        month: period.month,
        year: period.year,
        amount: rent?.amount ?? tenant.monthlyRent,
        status: rent?.status || "PENDING"
      };
    });

  return { ...period, dues };
}
