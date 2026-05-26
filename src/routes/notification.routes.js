import { Router } from "express";
import Setting from "../models/Setting.js";
import { protect } from "../middleware/auth.js";
import { getMonthlyDues } from "../utils/monthlyDues.js";

const router = Router();
router.use(protect);

function brevoReady() {
  return Boolean(process.env.BREVO_API_KEY);
}

async function sendBrevoEmail({ to, subject, text }) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.BREVO_API_KEY
    },
    body: JSON.stringify({
      sender: { name: "Hostel Management", email: process.env.SMTP_FROM || process.env.BREVO_SENDER },
      to: [{ email: to }],
      subject,
      textContent: text
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo API error: ${res.status} ${err}`);
  }
  return res.json();
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

    if (!brevoReady()) {
      return res.status(501).json({
        message: "BREVO_API_KEY is not configured. Add it in Render Environment Variables."
      });
    }

    const subject = `Monthly rent dues - ${monthlyDues.month} ${monthlyDues.year}`;
    const text = monthlyDues.dues.length
      ? monthlyDues.dues.map(dueText).join("\n")
      : "No pending rent dues for this month.";

    const sent = [];
    if (adminEmail) {
      await sendBrevoEmail({ to: adminEmail, subject, text });
      sent.push(adminEmail);
    }

    for (const due of monthlyDues.dues) {
      if (!due.tenant.email) continue;
      await sendBrevoEmail({
        to: due.tenant.email,
        subject: `Rent due reminder - ${monthlyDues.month} ${monthlyDues.year}`,
        text: `Hello ${due.tenant.name},\n\nYour rent due for ${monthlyDues.month} ${monthlyDues.year} is Rs.${due.amount}.\n\nPlease contact the hostel admin if this was already paid.`
      });
      sent.push(due.tenant.email);
    }

    res.json({ message: "Due emails sent", sent, monthlyDues });
  } catch (error) {
    console.error("Email error:", error?.message);
    res.status(500).json({ message: error?.message || "Email failed" });
  }
});

export default router;
