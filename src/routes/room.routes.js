import { Router } from "express";
import Room from "../models/Room.js";
import Tenant from "../models/Tenant.js";
import { protect } from "../middleware/auth.js";

const router = Router();
router.use(protect);

async function withOccupancy(query = {}) {
  const rooms = await Room.find(query).sort({ floor: 1, roomNo: 1 }).lean();
  const tenants = await Tenant.find({ status: "ACTIVE" }).select("roomId bedNo name").lean();
  return rooms.map((room) => {
    const beds = tenants.filter((tenant) => String(tenant.roomId) === String(room._id));
    return {
      ...room,
      occupiedBeds: beds.length,
      status: beds.length > 0 ? "OCCUPIED" : "VACANT",
      beds
    };
  });
}

router.get("/", async (_req, res, next) => {
  try {
    res.json(await withOccupancy());
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const room = await Room.create(req.body);
    res.status(201).json(room);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.json(room);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const hasTenants = await Tenant.exists({ roomId: req.params.id, status: "ACTIVE" });
    if (hasTenants) return res.status(400).json({ message: "Move tenants before deleting this room" });
    await Room.findByIdAndDelete(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
