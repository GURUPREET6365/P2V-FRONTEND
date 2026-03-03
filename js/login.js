const API_AUTH_URL = `${window.AuthManager?.API_BASE_URL || "http://127.0.0.1:8000"}/api/auth/google`;
let loginInFlight = false;

function getPostLoginRedirect() {
  const rawNext = new URLSearchParams(window.location.search).get("next");
  if (!rawNext) return "index.html";

  // Keep redirects local to this frontend.
  if (/^(?:[a-z]+:)?\/\//i.test(rawNext)) return "index.html";
  if (!/^[a-zA-Z0-9_.\-/?=&%#]+$/.test(rawNext)) return "index.html";
  return rawNext;
}

function showToast(message, type = "primary") {
  const toastEl = document.getElementById("statusToast");
  const toastMsg = document.getElementById("toastMessage");
  if (!toastEl || !toastMsg || !window.bootstrap?.Toast) return;

  toastEl.classList.remove("bg-primary", "bg-danger", "bg-success");
  toastEl.classList.add(type === "danger" ? "bg-danger" : type === "success" ? "bg-success" : "bg-primary");
  toastMsg.textContent = message;
  window.bootstrap.Toast.getOrCreateInstance(toastEl).show();
}

function setupPasswordToggle() {
  const togglePassword = document.getElementById("togglePassword");
  const passwordInput = document.getElementById("passwordInput");
  const eyeIcon = document.getElementById("eyeIcon");
  if (!togglePassword || !passwordInput || !eyeIcon) return;

  togglePassword.addEventListener("click", () => {
    const nextType = passwordInput.type === "password" ? "text" : "password";
    passwordInput.type = nextType;
    eyeIcon.classList.toggle("fa-eye");
    eyeIcon.classList.toggle("fa-eye-slash");
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  setupPasswordToggle();

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      showToast("Email login is disabled. Please use Google Sign-In.", "primary");
    });
  }

  if (!window.AuthManager) return;

  const user = await window.AuthManager.verifySession();
  if (user) {
    window.location.replace(getPostLoginRedirect());
  }
});

window.handleCredentialResponse = async function handleCredentialResponse(response) {
  if (loginInFlight) return;
  if (!response?.credential) {
    showToast("Google sign-in failed. Please try again.", "danger");
    return;
  }

  loginInFlight = true;
  showToast("Signing you in...", "primary");

  try {
    const backendResponse = await fetch(API_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: response.credential }),
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error("Backend auth failed:", errorText);
      showToast("Unable to sign in right now. Please retry.", "danger");
      return;
    }

    const data = await backendResponse.json();
    if (!data?.access_token) {
      showToast("Login response is missing access token.", "danger");
      return;
    }

    window.AuthManager?.setSession(data.access_token);
    showToast("Login successful.", "success");
    window.location.replace(getPostLoginRedirect());
  } catch (error) {
    console.error("Login request failed:", error);
    showToast("Network issue during login. Please retry.", "danger");
  } finally {
    loginInFlight = false;
  }
};
