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

router.get("/summary", async (_req, res, next) => {
  try {
    const [rents, expenses, rooms, activeTenants, monthlyDues] = await Promise.all([
      Rent.find().populate("tenantId", "name"),
      Expense.find(),
      Room.find(),
      Tenant.find({ status: "ACTIVE" }),
      getMonthlyDues()
    ]);
    const totalIncome = rents.filter((rent) => rent.status === "PAID").reduce((sum, rent) => sum + rent.amount, 0);
    const pendingRent = rents.filter((rent) => rent.status === "PENDING").reduce((sum, rent) => sum + rent.amount, 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const occupiedRoomIds = new Set(activeTenants.map((tenant) => String(tenant.roomId)));
    res.json({
      totalIncome,
      totalExpenses,
      profit: totalIncome - totalExpenses,
      occupiedRooms: occupiedRoomIds.size,
      vacantRooms: Math.max(rooms.length - occupiedRoomIds.size, 0),
      pendingRent,
      currentMonthDues: monthlyDues.dues.reduce((sum, due) => sum + due.amount, 0),
      monthlyDues,
      rents,
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
