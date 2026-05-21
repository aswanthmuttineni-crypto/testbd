import { Router } from "express";
import Expense from "../models/Expense.js";
import { protect } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = Router();
router.use(protect);

function fileMeta(file) {
  if (!file) return undefined;
  return { filename: file.originalname, path: `/uploads/${file.filename}`, mimetype: file.mimetype };
}

router.get("/", async (_req, res, next) => {
  try {
    res.json(await Expense.find().sort({ date: -1 }));
  } catch (error) {
    next(error);
  }
});

router.post("/", upload.single("bill"), async (req, res, next) => {
  try {
    res.status(201).json(await Expense.create({ ...req.body, bill: fileMeta(req.file) }));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", upload.single("bill"), async (req, res, next) => {
  try {
    const patch = { ...req.body };
    if (req.file) patch.bill = fileMeta(req.file);
    const expense = await Expense.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true });
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    res.json(expense);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await Expense.findByIdAndDelete(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
