// Базовый URL вашего backend API — поменяете, когда backend будет готов
const API_URL = "http://localhost:5000/api";

function showError(inputId, errorId, isValid) {
  const errorEl = document.getElementById(errorId);
  errorEl.style.display = isValid ? "none" : "block";
}

const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const passwordValid = password.length >= 6;

    showError("email", "emailError", emailValid);
    showError("password", "passwordError", passwordValid);

    if (!emailValid || !passwordValid) return;

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Не удалось войти");
        return;
      }

      // Сохраняем токен для последующих запросов
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);

      window.location.href = data.role === "admin" ? "admin.html" : "index.html";
    } catch (err) {
      alert("Backend пока недоступен. Проверьте, что сервер запущен.");
    }
  });
}

const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const role = document.getElementById("role").value;

    const nameValid = name.length > 0;
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const passwordValid = password.length >= 6;

    showError("name", "nameError", nameValid);
    showError("email", "emailError", emailValid);
    showError("password", "passwordError", passwordValid);

    if (!nameValid || !emailValid || !passwordValid) return;

    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Не удалось зарегистрироваться");
        return;
      }

      window.location.href = "login.html";
    } catch (err) {
      alert("Backend пока недоступен. Проверьте, что сервер запущен.");
    }
  });
}
