import { Router } from "express";
import Rent from "../models/Rent.js";
import Tenant from "../models/Tenant.js";
import { protect, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(protect);

router.get("/me", async (req, res, next) => {
  try {
    const tenant = await Tenant.findOne({ email: req.user.email }).select("_id");
    if (!tenant) return res.status(404).json({ message: "Tenant profile not found" });
    res.json(await Rent.find({ tenantId: tenant._id }).sort({ year: -1, createdAt: -1 }));
  } catch (error) { next(error); }
});

router.get("/", requireAdmin, async (_req, res, next) => {
  try {
    res.json(await Rent.find().populate("tenantId", "name phone monthlyRent").sort({ createdAt: -1 }));
  } catch (error) { next(error); }
});

function sanitizeRent(body) {
  const data = { ...body };
  if (!data.paymentDate || data.paymentDate === 'undefined' || data.paymentDate === '') {
    delete data.paymentDate;
  }
  return data;
}

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    res.status(201).json(await Rent.create(sanitizeRent(req.body)));
  } catch (error) { next(error); }
});

router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const rent = await Rent.findByIdAndUpdate(req.params.id, sanitizeRent(req.body), { new: true, runValidators: false });
    if (!rent) return res.status(404).json({ message: "Rent payment not found" });
    res.json(rent);
  } catch (error) { next(error); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    await Rent.findByIdAndDelete(req.params.id);
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
