/* =========================================
   Auth Page Logic
   ========================================= */

// Redirect if already logged in
if (getToken()) {
  window.location.href = "/dashboard.html";
}

// Tab switching
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".auth-form").forEach((f) => f.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`${tab}-form`).classList.add("active");
  });
});

// Login
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;
  const errEl = document.getElementById("login-error");
  errEl.classList.add("hidden");

  try {
    const data = await api.login(username, password);
    setToken(data.access_token);
    setUsername(data.username);
    window.location.href = "/dashboard.html";
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
  }
});

// Register
document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("reg-username").value.trim();
  const email = document.getElementById("reg-email").value.trim() || null;
  const password = document.getElementById("reg-password").value;
  const errEl = document.getElementById("register-error");
  const successEl = document.getElementById("register-success");
  errEl.classList.add("hidden");
  successEl.classList.add("hidden");

  try {
    await api.register({ username, email, password });
    successEl.textContent = "Account created! You can now log in.";
    successEl.classList.remove("hidden");
    // Switch to login tab
    setTimeout(() => {
      document.querySelector('[data-tab="login"]').click();
      document.getElementById("login-username").value = username;
    }, 1200);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
  }
});
