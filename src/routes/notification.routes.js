import { Router } from "express";
import Setting from "../models/Setting.js";
import { protect } from "../middleware/auth.js";
import { getMonthlyDues } from "../utils/monthlyDues.js";

const router = Router();
router.use(protect);

function smtpReady() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function getMailer() {
  const nodemailer = await import("nodemailer");
  return nodemailer.default.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function roomNo(tenant) {
  return typeof tenant.roomId === "string" ? tenant.roomId : tenant.roomId?.roomNo || "";
}

function dueText(due) {
  return `${due.tenant.name} - Room ${roomNo(due.tenant)}, Bed ${due.tenant.bedNo}, Amount Rs.${due.amount}`;
}

router.get("/monthly-dues", async (_req, res, next) => {
  try {
    const monthlyDues = await getMonthlyDues();
    res.json(monthlyDues);
  } catch (error) {
    next(error);
  }
});

router.post("/monthly-dues/email", async (req, res, next) => {
  try {
    const monthlyDues = await getMonthlyDues();
    const settings = await Setting.findOne();
    const adminEmail = req.body?.adminEmail || settings?.notificationEmail || settings?.adminEmail;

    if (!smtpReady()) {
      return res.status(501).json({
        message: "SMTP is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM in Render or local .env.",
        monthlyDues
      });
    }

    const mailer = await getMailer();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const subject = `Monthly rent dues - ${monthlyDues.month} ${monthlyDues.year}`;
    const text = monthlyDues.dues.length
      ? monthlyDues.dues.map(dueText).join("\n")
      : "No pending rent dues for this month.";

    const sent = [];
    if (adminEmail) {
      await mailer.sendMail({ from, to: adminEmail, subject, text });
      sent.push(adminEmail);
    }

    for (const due of monthlyDues.dues) {
      if (!due.tenant.email) continue;
      await mailer.sendMail({
        from,
        to: due.tenant.email,
        subject: `Rent due reminder - ${monthlyDues.month} ${monthlyDues.year}`,
        text: `Hello ${due.tenant.name},\n\nYour rent due for ${monthlyDues.month} ${monthlyDues.year} is Rs.${due.amount}.\n\nPlease contact the hostel admin if this was already paid.`
      });
      sent.push(due.tenant.email);
    }

    res.json({ message: "Due emails sent", sent, monthlyDues });
  } catch (error) {
    next(error);
  }
});

export default router;
