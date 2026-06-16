function emailReady() {
  return Boolean(process.env.BREVO_API_KEY);
}

function whatsAppReady() {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export function canSendWhatsApp() {
  return whatsAppReady();
}

function isProductionDelivery() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.REQUIRE_REAL_VERIFICATION === "true" ||
    Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID) ||
    Boolean((process.env.CLIENT_URL || "").includes("netlify.app"))
  );
}

export async function sendBrevoEmail({ to, subject, text, html, replyTo }) {
  const senderEmail = process.env.BREVO_SENDER || process.env.SMTP_FROM || "no-reply@brevosend.com";
  const senderName = process.env.SMTP_NAME || "Hostel Management";

  const buildToList = (t) => {
    if (Array.isArray(t)) return t.map((item) => (typeof item === "string" ? { email: item } : item));
    if (typeof t === "string") return [{ email: t }];
    if (t && typeof t === "object" && t.email) return [t];
    return [];
  };

  const toList = buildToList(to);
  const reply = replyTo
    ? (typeof replyTo === "string" ? { email: replyTo, name: senderName } : replyTo)
    : { email: process.env.SMTP_FROM || process.env.ADMIN_EMAIL || process.env.BREVO_REPLY_TO || "" , name: senderName };

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: toList,
    replyTo: reply,
    subject,
    htmlContent: html || text,
    textContent: text
  };

  // Log payload to help debug Brevo 'invalid_request' errors
  try {
    console.info("[Brevo] email payload:", JSON.stringify(payload, null, 2));
  } catch (err) {
    /* ignore logging errors */
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.BREVO_API_KEY
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo API error: ${res.status} ${err}`);
  }

  return res.json();
}

export async function sendWhatsAppText({ to, text }) {
  const version = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { preview_url: false, body: text }
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp API error: ${res.status} ${err}`);
  }

  return res.json();
}

export async function sendWhatsAppOtpTemplate({ to, code }) {
  const version = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME;
  const languageCode = process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE || "en_US";

  if (!templateName) {
    throw new Error("WHATSAPP_OTP_TEMPLATE_NAME is not configured");
  }

  const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: code }]
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: code }]
          }
        ]
      }
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp template API error: ${res.status} ${err}`);
  }

  return res.json();
}

export async function sendWhatsAppTemplate({ to, templateName, languageCode = "en_US", parameters = [] }) {
  const version = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components: parameters.length
          ? [
              {
                type: "body",
                parameters: parameters.map((value) => ({ type: "text", text: String(value) }))
              }
            ]
          : []
      }
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp template API error: ${res.status} ${err}`);
  }

  return res.json();
}

export async function sendVerificationCode({ email, phone, code }) {
  const subject = "Your admin registration verification code";
  const text = `Your Hostel Management admin registration code is ${code}. It expires in 10 minutes.`;
  const sent = [];
  const errors = [];

  if (emailReady()) {
    try {
      await sendBrevoEmail({ to: email, subject, text });
      sent.push("email");
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (phone && whatsAppReady()) {
    try {
      if (process.env.WHATSAPP_OTP_TEMPLATE_NAME) {
        await sendWhatsAppOtpTemplate({ to: phone, code });
      } else {
        await sendWhatsAppText({ to: phone, text });
      }
      sent.push("whatsapp");
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (!sent.length && isProductionDelivery()) {
    throw new Error(errors[0] || "No verification sender is configured");
  }

  if (!sent.length) {
    console.info("[Dev Verification] admin registration code:", code);
  }

  return {
    sent,
    errors,
    devCode: sent.length ? undefined : code
  };
}
