import { Router } from "express";
import Rent from "../models/Rent.js";
import Expense from "../models/Expense.js";
import Room from "../models/Room.js";
import Tenant from "../models/Tenant.js";
import { protect, requireAdmin } from "../middleware/auth.js";
import { getMonthlyDues, MONTHS } from "../utils/monthlyDues.js";

const router = Router();
router.use(protect);
router.use(requireAdmin);

router.get("/summary", async (req, res, next) => {
  try {
    const now = new Date();
    const selMonth = req.query.month ? String(req.query.month) : null;
    const selYear  = req.query.year  ? Number(req.query.year)  : null;

    const rentFilter    = selMonth && selYear ? { month: selMonth, year: selYear } : {};
    const expenseFilter = selMonth && selYear
      ? { date: {
          $gte: new Date(`${selYear}-${String(MONTHS.indexOf(selMonth) + 1).padStart(2,'0')}-01`),
          $lt:  new Date(`${selYear}-${String(MONTHS.indexOf(selMonth) + 2).padStart(2,'0')}-01`)
        }}
      : {};

    const [rents, expenses, rooms, activeTenants, monthlyDues, allRents] = await Promise.all([
      Rent.find(rentFilter).populate("tenantId", "name"),
      Expense.find(expenseFilter),
      Room.find(),
      Tenant.find({ status: "ACTIVE" }),
      getMonthlyDues(),
      Rent.find().populate("tenantId", "name")   // always full for charts
    ]);

    const totalIncome    = rents.filter(r => r.status === "PAID").reduce((s, r) => s + r.amount, 0);
    const pendingRent    = rents.filter(r => r.status === "PENDING").reduce((s, r) => s + r.amount, 0);
    const totalExpenses  = expenses.reduce((s, e) => s + e.amount, 0);
    const totalBeds      = rooms.reduce((s, r) => s + r.capacity, 0);
    const occupiedBedCount = activeTenants.length;

    res.json({
      totalIncome,
      totalExpenses,
      profit: totalIncome - totalExpenses,
      occupiedRooms: occupiedBedCount,
      vacantRooms: Math.max(totalBeds - occupiedBedCount, 0),
      activeTenantCount: activeTenants.length,
      pendingRent,
      currentMonthDues: monthlyDues.dues.reduce((s, d) => s + d.amount, 0),
      monthlyDues,
      rents: allRents,
      expenses
    });
  } catch (error) {
    next(error);
  }
});

// Rent aging: unpaid months per active tenant
router.get("/aging", async (_req, res, next) => {
  try {
    const now = new Date();
    const [activeTenants, paidRents] = await Promise.all([
      Tenant.find({ status: "ACTIVE" }).populate("roomId", "roomNo").sort({ name: 1 }),
      Rent.find({ status: "PAID" })
    ]);

    const paidSet = new Set(paidRents.map((r) => `${String(r.tenantId)}_${r.month}_${r.year}`));

    const rows = activeTenants.map((tenant) => {
      const joinDate = new Date(tenant.joiningDate);
      const overdueMonths = [];

      // Walk from joining month up to (but not including) current month
      let y = joinDate.getFullYear();
      let m = joinDate.getMonth(); // 0-indexed
      while (y < now.getFullYear() || (y === now.getFullYear() && m < now.getMonth())) {
        const monthName = MONTHS[m];
        if (!paidSet.has(`${String(tenant._id)}_${monthName}_${y}`)) {
          overdueMonths.push({ month: monthName, year: y, amount: tenant.monthlyRent });
        }
        m++;
        if (m > 11) { m = 0; y++; }
      }

      return {
        tenantId: tenant._id,
        name: tenant.name,
        phone: tenant.phone,
        room: tenant.roomId?.roomNo ?? "",
        monthlyRent: tenant.monthlyRent,
        overdueMonths,
        totalOverdue: overdueMonths.reduce((s, mo) => s + mo.amount, 0)
      };
    }).filter((r) => r.overdueMonths.length > 0);

    res.json(rows);
  } catch (error) {
    next(error);
  }
});

export default router;
