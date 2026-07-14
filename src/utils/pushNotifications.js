// Free push notifications via Firebase Cloud Messaging (FCM).
//
// This module is intentionally defensive: `firebase-admin` is loaded lazily and
// wrapped in try/catch so the API keeps booting even before you have run
// `npm install firebase-admin` or filled in the Firebase env vars. Until it is
// configured, canSendPush() returns false and the push endpoints reply 501.
//
// Required environment variables (from your Firebase service account JSON —
// Firebase console → Project settings → Service accounts → Generate new private key):
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY   (paste the whole key; keep the \n escapes)

let adminModule = null;      // the imported firebase-admin module
let messagingClient = null;  // memoised admin.messaging() instance
let initTried = false;

function hasConfig() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );
}

async function getMessaging() {
  if (messagingClient) return messagingClient;
  if (initTried) return messagingClient; // don't retry a known-bad setup on every request
  initTried = true;

  if (!hasConfig()) {
    console.info("[FCM] Firebase env vars are not set — push notifications are disabled.");
    return null;
  }

  try {
    adminModule = (await import("firebase-admin")).default;
  } catch (error) {
    console.warn("[FCM] firebase-admin is not installed. Run `npm install firebase-admin` to enable push.");
    return null;
  }

  try {
    if (!adminModule.apps.length) {
      adminModule.initializeApp({
        credential: adminModule.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // Render/Netlify store the key with literal "\n"; convert back to real newlines.
          privateKey: String(process.env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, "\n")
        })
      });
    }
    messagingClient = adminModule.messaging();
  } catch (error) {
    console.error("[FCM] Failed to initialise firebase-admin:", error?.message);
    messagingClient = null;
  }

  return messagingClient;
}

// Synchronous "is it worth trying" check for route guards.
export function canSendPush() {
  return hasConfig();
}

/**
 * Send one notification to many device tokens.
 * Returns { successCount, failureCount, invalidTokens } where invalidTokens are
 * tokens the caller should delete from the DB (unregistered / no longer valid).
 */
export async function sendPushToTokens({ tokens = [], title, body, data = {} }) {
  const messaging = await getMessaging();
  if (!messaging) {
    throw new Error("Push notifications are not configured on the server.");
  }

  const uniqueTokens = [...new Set(tokens.filter(Boolean))];
  if (!uniqueTokens.length) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  // Stringify data — FCM data payload values must be strings.
  const stringData = {};
  for (const [key, value] of Object.entries(data)) {
    stringData[key] = String(value);
  }

  const response = await messaging.sendEachForMulticast({
    tokens: uniqueTokens,
    notification: { title, body },
    data: stringData,
    webpush: {
      notification: { title, body, icon: "/favicon.ico" },
      fcmOptions: data.link ? { link: String(data.link) } : undefined
    }
  });

  const invalidTokens = [];
  response.responses.forEach((result, index) => {
    if (!result.success) {
      const code = result.error?.code || "";
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token" ||
        code === "messaging/invalid-argument"
      ) {
        invalidTokens.push(uniqueTokens[index]);
      }
    }
  });

  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
    invalidTokens
  };
}
