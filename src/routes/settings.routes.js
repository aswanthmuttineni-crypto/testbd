import { Router } from "express";
import Setting from "../models/Setting.js";
import Expense from "../models/Expense.js";
import { protect } from "../middleware/auth.js";

const router = Router();

async function getSettings() {
  let settings = await Setting.findOne();
  if (!settings) settings = await Setting.create({});
  return settings;
}

router.get("/public", async (_req, res, next) => {
  try {
    const settings = await getSettings();
    const bills = await Expense.find({ category: { $in: ["Electricity", "Water"] } }).sort({ date: -1 }).limit(12);
    res.json({ settings, bills, serverTime: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

router.get("/", protect, async (_req, res, next) => {
  try {
    res.json(await getSettings());
  } catch (error) {
    next(error);
  }
});

router.put("/", protect, async (req, res, next) => {
  try {
    const settings = await getSettings();
    Object.assign(settings, req.body);
    await settings.save();
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

export default router;
