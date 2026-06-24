import { Router } from "express";
import Setting from "../models/Setting.js";
import { protect, requireAdmin } from "../middleware/auth.js";
import { getMonthlyDues } from "../utils/monthlyDues.js";
import { canSendWhatsApp, sendBrevoEmail, sendWhatsAppTemplate, sendWhatsAppText } from "../utils/messageDelivery.js";

const router = Router();
router.use(protect);

function brevoReady() {
  return Boolean(process.env.BREVO_API_KEY);
}

function roomNo(tenant) {
  return typeof tenant.roomId === "string" ? tenant.roomId : tenant.roomId?.roomNo || "";
}

function dueText(due) {
  return `${due.tenant.name} - Room ${roomNo(due.tenant)}, Bed ${due.tenant.bedNo}, Amount Rs.${due.amount}`;
}

function cleanPhone(phone = "") {
  return String(phone).replace(/[^\d]/g, "");
}

function dueWhatsAppText(due, monthlyDues) {
  return [
    "Auto-Generated",
    "",
    `${monthlyDues.month} ${monthlyDues.year} - Pending Dues`,
    "",
    `Hello ${due.tenant.name}, your hostel rent due is Rs.${due.amount}.`,
    `Room ${roomNo(due.tenant)}, Bed ${due.tenant.bedNo}.`,
    "Please pay soon or contact the hostel admin if already paid."
  ].join("\n");
}

router.get("/monthly-dues", requireAdmin, async (_req, res, next) => {
  try {
    const monthlyDues = await getMonthlyDues();
    res.json(monthlyDues);
  } catch (error) {
    next(error);
  }
});

router.post("/monthly-dues/email", requireAdmin, async (req, res, next) => {
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
    const adminPhone = settings?.adminPhone || process.env.ADMIN_PHONE || '9381097099';
    const adminContactEmail = settings?.notificationEmail || settings?.adminEmail || process.env.ADMIN_EMAIL || 'muthineniaswanth@gmail.com';

    const sent = [];
    const skipped = [];
    const errors = [];
    if (adminEmail) {
      try {
        const result = await sendBrevoEmail({ to: adminEmail, subject, text });
        sent.push({ to: adminEmail, type: "admin", messageId: result?.messageId });
      } catch (error) {
        errors.push({ to: adminEmail, type: "admin", message: error.message });
      }
    }

      for (const due of monthlyDues.dues) {
      if (!due.tenant.email) {
        skipped.push({ tenant: due.tenant.name, reason: "No tenant email" });
        continue;
      }

      try {
        const dueDate = (() => {
          const m = new Date(`${monthlyDues.month} 1, ${monthlyDues.year}`);
          return new Date(monthlyDues.year, m.getMonth() + 1, 0).toLocaleDateString('en-IN');
        })();

        const plainText = [
          `Hello ${due.tenant.name},`,
          '',
          'We hope you are doing well.',
          '',
          `This is a friendly reminder that your hostel rent for ${monthlyDues.month} ${monthlyDues.year} is currently due.`,
          '',
          '━━━━━━━━━━━━━━━━━━━━━━',
          '📌 Rent Details',
          '━━━━━━━━━━━━━━━━━━━━━━',
          `Room Number: ${roomNo(due.tenant)}`,
          `Bed Number: ${due.tenant.bedNo}`,
          `Monthly Rent: ₹${due.amount}`,
          `Due Date: ${dueDate}`,
          '',
          `⚠️ Outstanding Amount: ₹${due.amount}`,
          '',
          'Kindly make the payment at your earliest convenience to avoid any late fees or inconvenience.',
          '',
          'If you have already completed the payment, please ignore this message.',
          '',
          'For any questions or assistance, feel free to contact the hostel administration.',
          '',
          'Thank you for staying with us.',
          '',
          'Best regards,',
          '',
          'Ajs WomanS PG',
          `📞 ${adminPhone}`,
          `📧 ${adminContactEmail}`
        ].join('\n');

        const iconPin = 'https://fonts.gstatic.com/s/e/notoemoji/17.0/1f4cc/32.png';
        const iconWarn = 'https://fonts.gstatic.com/s/e/notoemoji/17.0/26a0_fe0f/32.png';
        const iconPhone = 'https://fonts.gstatic.com/s/e/notoemoji/17.0/1f4de/32.png';
        const iconMail = 'https://fonts.gstatic.com/s/e/notoemoji/17.0/1f4e7/32.png';

        const htmlText = `
          <p>Hello ${due.tenant.name},</p>
          <p>We hope you are doing well.</p>
          <p>This is a friendly reminder that your hostel rent for <strong>${monthlyDues.month} ${monthlyDues.year}</strong> is currently due.</p>
          <p>━━━━━━━━━━━━━━━━━━━━━━<br/>
          <img src="${iconPin}" alt="📌" width="20" style="vertical-align:middle;"/> <strong> Rent Details</strong><br/>
          ━━━━━━━━━━━━━━━━━━━━━━</p>
          <p>Room Number: ${roomNo(due.tenant)}<br/>
          Bed Number: ${due.tenant.bedNo}<br/>
          Monthly Rent: ₹${due.amount}<br/>
          Due Date: ${dueDate}</p>
          <p><img src="${iconWarn}" alt="⚠️" width="20" style="vertical-align:middle;"/> <strong>Outstanding Amount: ₹${due.amount}</strong></p>
          <p>Kindly make the payment at your earliest convenience to avoid any late fees or inconvenience.</p>
          <p>If you have already completed the payment, please ignore this message.</p>
          <p>For any questions or assistance, feel free to contact the hostel administration.</p>
          <p>Thank you for staying with us.</p>
          <p>Best regards,</p>
          <p><strong>Ajs WomanS PG</strong><br/>
          <img src="${iconPhone}" alt="📞" width="20" style="vertical-align:middle;"/> ${adminPhone}<br/>
          <img src="${iconMail}" alt="📧" width="20" style="vertical-align:middle;"/> <a href="mailto:${adminContactEmail}">${adminContactEmail}</a></p>
        `;

        const result = await sendBrevoEmail({
          to: due.tenant.email,
          subject: `Rent due reminder - ${monthlyDues.month} ${monthlyDues.year}`,
          text: plainText,
          html: htmlText
        });
        sent.push({ to: due.tenant.email, tenant: due.tenant.name, messageId: result?.messageId });
      } catch (error) {
        errors.push({ to: due.tenant.email, tenant: due.tenant.name, message: error.message });
      }
    }

    res.json({
      message: errors.length ? "Due emails processed with errors" : "Due emails processed",
      sent,
      skipped,
      errors,
      monthlyDues
    });
  } catch (error) {
    console.error("Email error:", error?.message);
    res.status(500).json({ message: error?.message || "Email failed" });
  }
});

router.post("/monthly-dues/whatsapp-single", requireAdmin, async (req, res) => {
  try {
    if (!canSendWhatsApp()) {
      return res.status(501).json({ message: "WhatsApp API is not configured." });
    }
    const { tenantId } = req.body;
    if (!tenantId) return res.status(400).json({ message: "tenantId required" });

    const monthlyDues = await getMonthlyDues();
    const due = monthlyDues.dues.find((d) => String(d.tenant._id) === String(tenantId));
    if (!due) return res.status(404).json({ message: "No pending due found for this tenant" });

    const phone = cleanPhone(due.tenant.phone);
    if (!phone) return res.status(400).json({ message: "Tenant has no phone number" });

    const templateName = process.env.WHATSAPP_DUE_TEMPLATE_NAME;
    const languageCode = process.env.WHATSAPP_DUE_TEMPLATE_LANGUAGE || "en_US";

    if (templateName) {
      await sendWhatsAppTemplate({
        to: phone, templateName, languageCode,
        parameters: [due.tenant.name, `${monthlyDues.month} ${monthlyDues.year}`, due.amount, roomNo(due.tenant), due.tenant.bedNo]
      });
    } else {
      await sendWhatsAppText({ to: phone, text: dueWhatsAppText(due, monthlyDues) });
    }

    res.json({ message: `WhatsApp sent to ${due.tenant.name} (${phone})` });
  } catch (error) {
    res.status(500).json({ message: error?.message || "WhatsApp send failed" });
  }
});

router.post("/monthly-dues/whatsapp", requireAdmin, async (_req, res) => {
  try {
    if (!canSendWhatsApp()) {
      return res.status(501).json({
        message: "WhatsApp API is not configured. Add WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in Render Environment Variables."
      });
    }

    const monthlyDues = await getMonthlyDues();
    const sent = [];
    const skipped = [];
    const errors = [];
    const templateName = process.env.WHATSAPP_DUE_TEMPLATE_NAME;
    const languageCode = process.env.WHATSAPP_DUE_TEMPLATE_LANGUAGE || "en_US";

    for (const due of monthlyDues.dues) {
      const phone = cleanPhone(due.tenant.phone);
      if (!phone) {
        skipped.push({ tenant: due.tenant.name, reason: "No phone number" });
        continue;
      }

      try {
        if (templateName) {
          await sendWhatsAppTemplate({
            to: phone,
            templateName,
            languageCode,
            parameters: [
              due.tenant.name,
              `${monthlyDues.month} ${monthlyDues.year}`,
              due.amount,
              roomNo(due.tenant),
              due.tenant.bedNo
            ]
          });
        } else {
          await sendWhatsAppText({ to: phone, text: dueWhatsAppText(due, monthlyDues) });
        }
        sent.push(phone);
      } catch (error) {
        errors.push({ tenant: due.tenant.name, phone, message: error.message });
      }
    }

    res.json({
      message: "Due WhatsApp messages processed",
      sent,
      skipped,
      errors,
      monthlyDues
    });
  } catch (error) {
    console.error("WhatsApp due reminder error:", error?.message);
    res.status(500).json({ message: error?.message || "WhatsApp due reminder failed" });
  }
});

router.post("/monthly-dues/reminders", requireAdmin, async (req, res) => {
  try {
    const monthlyDues = await getMonthlyDues();
    const settings = await Setting.findOne();
    const adminEmail = req.body?.adminEmail || settings?.notificationEmail || settings?.adminEmail;
    const sent = { email: [], whatsapp: [] };
    const skipped = [];
    const errors = [];

    if (brevoReady()) {
      const subject = `Monthly rent dues - ${monthlyDues.month} ${monthlyDues.year}`;
      const text = monthlyDues.dues.length
        ? monthlyDues.dues.map(dueText).join("\n")
        : "No pending rent dues for this month.";

      if (adminEmail) {
        try {
          await sendBrevoEmail({ to: adminEmail, subject, text });
          sent.email.push(adminEmail);
        } catch (error) {
          errors.push({ channel: "email", to: adminEmail, message: error.message });
        }
      }

      for (const due of monthlyDues.dues) {
        if (!due.tenant.email) continue;
        try {
          const dueDate = (() => {
            const m = new Date(`${monthlyDues.month} 1, ${monthlyDues.year}`);
            return new Date(monthlyDues.year, m.getMonth() + 1, 0).toLocaleDateString('en-IN');
          })();

          const plainText = [
            `Hello ${due.tenant.name},`,
            '',
            'We hope you are doing well.',
            '',
            `This is a friendly reminder that your hostel rent for ${monthlyDues.month} ${monthlyDues.year} is currently due.`,
            '',
            '━━━━━━━━━━━━━━━━━━━━━━',
            '📌 Rent Details',
            '━━━━━━━━━━━━━━━━━━━━━━',
            `Room Number: ${roomNo(due.tenant)}`,
            `Bed Number: ${due.tenant.bedNo}`,
            `Monthly Rent: ₹${due.amount}`,
            `Due Date: ${dueDate}`,
            '',
            `⚠️ Outstanding Amount: ₹${due.amount}`,
            '',
            'Kindly make the payment at your earliest convenience to avoid any late fees or inconvenience.',
            '',
            'If you have already completed the payment, please ignore this message.',
            '',
            'For any questions or assistance, feel free to contact the hostel administration.',
            '',
            'Thank you for staying with us.',
            '',
            'Best regards,',
            '',
            'Ajs WomanS PG',
            `📞 ${adminPhone}`,
            `📧 ${adminContactEmail}`
          ].join('\n');

          const iconPin = 'https://fonts.gstatic.com/s/e/notoemoji/17.0/1f4cc/32.png';
          const iconWarn = 'https://fonts.gstatic.com/s/e/notoemoji/17.0/26a0_fe0f/32.png';
          const iconPhone = 'https://fonts.gstatic.com/s/e/notoemoji/17.0/1f4de/32.png';
          const iconMail = 'https://fonts.gstatic.com/s/e/notoemoji/17.0/1f4e7/32.png';

          const htmlText = `
            <p>Hello ${due.tenant.name},</p>
            <p>We hope you are doing well.</p>
            <p>This is a friendly reminder that your hostel rent for <strong>${monthlyDues.month} ${monthlyDues.year}</strong> is currently due.</p>
            <p>━━━━━━━━━━━━━━━━━━━━━━<br/>
            <img src="${iconPin}" alt="📌" width="20" style="vertical-align:middle;"/> <strong> Rent Details</strong><br/>
            ━━━━━━━━━━━━━━━━━━━━━━</p>
            <p>Room Number: ${roomNo(due.tenant)}<br/>
            Bed Number: ${due.tenant.bedNo}<br/>
            Monthly Rent: ₹${due.amount}<br/>
            Due Date: ${dueDate}</p>
            <p><img src="${iconWarn}" alt="⚠️" width="20" style="vertical-align:middle;"/> <strong>Outstanding Amount: ₹${due.amount}</strong></p>
            <p>Kindly make the payment at your earliest convenience to avoid any late fees or inconvenience.</p>
            <p>If you have already completed the payment, please ignore this message.</p>
            <p>For any questions or assistance, feel free to contact the hostel administration.</p>
            <p>Thank you for staying with us.</p>
            <p>Best regards,</p>
            <p><strong>Ajs WomanS PG</strong><br/>
            <img src="${iconPhone}" alt="📞" width="20" style="vertical-align:middle;"/> ${adminPhone}<br/>
            <img src="${iconMail}" alt="📧" width="20" style="vertical-align:middle;"/> <a href="mailto:${adminContactEmail}">${adminContactEmail}</a></p>
          `;

          await sendBrevoEmail({
            to: due.tenant.email,
            subject: `Rent due reminder - ${monthlyDues.month} ${monthlyDues.year}`,
            text: plainText,
            html: htmlText
          });
          sent.email.push(due.tenant.email);
        } catch (error) {
          errors.push({ channel: "email", to: due.tenant.email, message: error.message });
        }
      }
    }

    if (canSendWhatsApp()) {
      const templateName = process.env.WHATSAPP_DUE_TEMPLATE_NAME;
      const languageCode = process.env.WHATSAPP_DUE_TEMPLATE_LANGUAGE || "en_US";

      for (const due of monthlyDues.dues) {
        const phone = cleanPhone(due.tenant.phone);
        if (!phone) {
          skipped.push({ tenant: due.tenant.name, channel: "whatsapp", reason: "No phone number" });
          continue;
        }

        try {
          if (templateName) {
            await sendWhatsAppTemplate({
              to: phone,
              templateName,
              languageCode,
              parameters: [
                due.tenant.name,
                `${monthlyDues.month} ${monthlyDues.year}`,
                due.amount,
                roomNo(due.tenant),
                due.tenant.bedNo
              ]
            });
          } else {
            await sendWhatsAppText({ to: phone, text: dueWhatsAppText(due, monthlyDues) });
          }
          sent.whatsapp.push(phone);
        } catch (error) {
          errors.push({ channel: "whatsapp", to: phone, tenant: due.tenant.name, message: error.message });
        }
      }
    }

    if (!brevoReady() && !canSendWhatsApp()) {
      return res.status(501).json({
        message: "No notification sender is configured. Add Brevo and/or WhatsApp API environment variables."
      });
    }

    res.json({
      message: "Due reminders processed",
      sent,
      skipped,
      errors,
      monthlyDues
    });
  } catch (error) {
    console.error("Due reminder error:", error?.message);
    res.status(500).json({ message: error?.message || "Due reminder failed" });
  }
});

export default router;
