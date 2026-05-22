import { Router } from "express";
import Rent from "../models/Rent.js";
import Expense from "../models/Expense.js";
import Room from "../models/Room.js";
import Tenant from "../models/Tenant.js";
import { protect } from "../middleware/auth.js";
import { getMonthlyDues } from "../utils/monthlyDues.js";

const router = Router();
router.use(protect);

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

export default router;
