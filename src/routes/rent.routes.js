import { Router } from "express";
import Rent from "../models/Rent.js";
import { protect } from "../middleware/auth.js";

const router = Router();
router.use(protect);

router.get("/", async (_req, res, next) => {
  try {
    res.json(await Rent.find().populate("tenantId", "name phone monthlyRent").sort({ createdAt: -1 }));
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    res.status(201).json(await Rent.create(req.body));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const rent = await Rent.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!rent) return res.status(404).json({ message: "Rent payment not found" });
    res.json(rent);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await Rent.findByIdAndDelete(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
