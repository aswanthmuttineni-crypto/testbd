// Let's use global fetch which is natively available in Node.js 18+

const API_URL = "http://localhost:5000/api";

async function runTests() {
  console.log("=== STARTING FULL-STACK INTEGRATION SANITY CHECK ===");
  const results = [];

  // Helper to log test status
  const logTest = (name, passed, detail = "") => {
    results.push({ name, passed, detail });
    console.log(`${passed ? "✔" : "✘"} ${name}: ${detail}`);
  };

  let token = "";
  
  // 1. Health check
  try {
    const res = await fetch(`${API_URL.replace("/api", "")}/api/health`);
    if (res.ok) {
      const data = await res.json();
      logTest("Health Endpoint Check", data.status === "ok", `Status: ${data.status}`);
    } else {
      logTest("Health Endpoint Check", false, `HTTP Status: ${res.status}`);
    }
  } catch (err) {
    logTest("Health Endpoint Check", false, err.message);
  }

  // 2. Authentication Login
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@gmail.com", password: "admin123" })
    });
    if (res.ok) {
      const data = await res.json();
      token = data.token;
      logTest("Admin Login Check", true, `Logged in successfully. User: ${data.user.name} (${data.user.role})`);
    } else {
      const errData = await res.json().catch(() => ({}));
      logTest("Admin Login Check", false, `Status ${res.status}: ${errData.message || "Unknown error"}`);
    }
  } catch (err) {
    logTest("Admin Login Check", false, err.message);
  }

  if (!token) {
    console.error("Stopping integration tests early: Admin login failed. Seed database if necessary.");
    return;
  }

  const authHeaders = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  // 3. User Profile Check
  try {
    const res = await fetch(`${API_URL}/auth/profile`, { headers: authHeaders });
    if (res.ok) {
      const data = await res.json();
      logTest("User Profile Fetch Check", true, `Fetched profile for ${data.name} (${data.email})`);
    } else {
      logTest("User Profile Fetch Check", false, `Status ${res.status}`);
    }
  } catch (err) {
    logTest("User Profile Fetch Check", false, err.message);
  }

  // 4. Rooms List
  let rooms = [];
  try {
    const res = await fetch(`${API_URL}/rooms`, { headers: authHeaders });
    if (res.ok) {
      rooms = await res.json();
      logTest("Rooms Module Check", true, `Fetched ${rooms.length} rooms`);
    } else {
      logTest("Rooms Module Check", false, `Status ${res.status}`);
    }
  } catch (err) {
    logTest("Rooms Module Check", false, err.message);
  }

  // 5. Tenants List
  let tenants = [];
  try {
    const res = await fetch(`${API_URL}/tenants`, { headers: authHeaders });
    if (res.ok) {
      tenants = await res.json();
      logTest("Tenants Module Check", true, `Fetched ${tenants.length} tenants`);
    } else {
      logTest("Tenants Module Check", false, `Status ${res.status}`);
    }
  } catch (err) {
    logTest("Tenants Module Check", false, err.message);
  }

  // 6. Rents List
  let rents = [];
  try {
    const res = await fetch(`${API_URL}/rents`, { headers: authHeaders });
    if (res.ok) {
      rents = await res.json();
      logTest("Rents Module Check", true, `Fetched ${rents.length} rent records`);
    } else {
      logTest("Rents Module Check", false, `Status ${res.status}`);
    }
  } catch (err) {
    logTest("Rents Module Check", false, err.message);
  }

  // 7. Expenses List
  let expenses = [];
  try {
    const res = await fetch(`${API_URL}/expenses`, { headers: authHeaders });
    if (res.ok) {
      expenses = await res.json();
      logTest("Expenses Module Check", true, `Fetched ${expenses.length} expenses`);
    } else {
      logTest("Expenses Module Check", false, `Status ${res.status}`);
    }
  } catch (err) {
    logTest("Expenses Module Check", false, err.message);
  }

  // 8. Reports Summary Check
  try {
    const res = await fetch(`${API_URL}/reports/summary`, { headers: authHeaders });
    if (res.ok) {
      const data = await res.json();
      logTest("Reports Summary Check", true, `Profit: INR ${data.profit}, Active Dues Count: ${data.monthlyDues?.dues?.length || 0}`);
    } else {
      logTest("Reports Summary Check", false, `Status ${res.status}`);
    }
  } catch (err) {
    logTest("Reports Summary Check", false, err.message);
  }

  // 9. Settings Check
  try {
    const res = await fetch(`${API_URL}/settings`, { headers: authHeaders });
    if (res.ok) {
      const data = await res.json();
      logTest("Settings GET Check", true, `Hostel Name: ${data.hostelName || "Not configured"}`);
    } else {
      logTest("Settings GET Check", false, `Status ${res.status}`);
    }
  } catch (err) {
    logTest("Settings GET Check", false, err.message);
  }

  // 10. Public Sharing Page Check (No auth needed)
  try {
    const res = await fetch(`${API_URL}/settings/public`);
    if (res.ok) {
      const data = await res.json();
      logTest("Public Endpoint Check", true, `Server Time: ${data.serverTime}`);
    } else {
      logTest("Public Endpoint Check", false, `Status ${res.status}`);
    }
  } catch (err) {
    logTest("Public Endpoint Check", false, err.message);
  }

  // 11. Notifications / Monthly Dues list Check
  try {
    const res = await fetch(`${API_URL}/notifications/monthly-dues`, { headers: authHeaders });
    if (res.ok) {
      const data = await res.json();
      logTest("Notifications Monthly Dues Check", true, `Month: ${data.month} ${data.year}, Dues count: ${data.dues?.length || 0}`);
    } else {
      logTest("Notifications Monthly Dues Check", false, `Status ${res.status}`);
    }
  } catch (err) {
    logTest("Notifications Monthly Dues Check", false, err.message);
  }

  console.log("\n=== SUMMARY OF INTEGRATION CHECKS ===");
  const allPassed = results.every(r => r.passed);
  console.log(allPassed ? "🎉 ALL INTEGRATION CHECKS PASSED!" : "⚠️ SOME INTEGRATION CHECKS FAILED!");
  console.log(`Passed: ${results.filter(r => r.passed).length}/${results.length}`);
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
});
