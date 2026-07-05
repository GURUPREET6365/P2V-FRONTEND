(() => {
  const API_BASE_URL = "https://unvigilantly-unvacillating-candance.ngrok-free.dev".replace(/\/+$/, "");

  // Global fetch wrapper to handle credentials and ngrok browser warnings automatically
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    init = init || {};
    const url = typeof input === "string" ? input : (input.url || "");
    if (url.startsWith(API_BASE_URL)) {
      init.credentials = init.credentials || "include";
      init.headers = init.headers || {};
      if (init.headers instanceof Headers) {
        if (!init.headers.has("ngrok-skip-browser-warning")) {
          init.headers.append("ngrok-skip-browser-warning", "true");
        }
      } else if (Array.isArray(init.headers)) {
        const hasHeader = init.headers.some(([key]) => key.toLowerCase() === "ngrok-skip-browser-warning");
        if (!hasHeader) {
          init.headers.push(["ngrok-skip-browser-warning", "true"]);
        }
      } else {
        init.headers["ngrok-skip-browser-warning"] = "true";
      }
    }
    return originalFetch(input, init);
  };

  const SESSION_COOKIE = "p2v_session";
  const LEGACY_TOKEN_KEY = "p2v_token";
  const LEGACY_SESSION_KEY = "p2v_session";
  const SESSION_TTL_DAYS = 5;
  const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

  function notifyAuthChanged() {
    window.dispatchEvent(new CustomEvent("p2v:auth-changed"));
  }

  function cookieSecureFlag() {
    return window.location.protocol === "https:" ? "; Secure" : "";
  }

  function writeCookie(name, value, expiresAt) {
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${new Date(expiresAt).toUTCString()}; path=/; SameSite=Lax${cookieSecureFlag()}`;
  }

  function deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax${cookieSecureFlag()}`;
  }

  function readCookie(name) {
    return document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${name}=`))
      ?.split("=")
      .slice(1)
      .join("=") || null;
  }

  function parseSession(raw) {
    if (!raw) return null;

    try {
      const session = JSON.parse(decodeURIComponent(raw));
      if (!session || typeof session !== "object") return null;
      if (!session.accessToken || typeof session.accessToken !== "string") return null;
      if (!Number.isFinite(session.expiresAt)) return null;
      return session;
    } catch (error) {
      return null;
    }
  }

  function clearLegacyStorage() {
    try {
      localStorage.removeItem(LEGACY_SESSION_KEY);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    } catch (error) {
      // Some browsers can block storage; cookies still keep the active session.
    }
  }

  function clearSession(silent = false) {
    deleteCookie(SESSION_COOKIE);
    clearLegacyStorage();
    if (!silent) notifyAuthChanged();
  }

  function saveSession(accessToken, ttlMs = SESSION_TTL_MS) {
    const now = Date.now();
    const session = {
      accessToken,
      createdAt: now,
      expiresAt: now + ttlMs,
    };

    writeCookie(SESSION_COOKIE, JSON.stringify(session), session.expiresAt);
    clearLegacyStorage();
    notifyAuthChanged();
    return session;
  }

  function migrateLegacyTokenIfNeeded() {
    try {
      const oldSession = parseSession(localStorage.getItem(LEGACY_SESSION_KEY));
      if (oldSession) {
        saveSession(oldSession.accessToken, Math.max(0, oldSession.expiresAt - Date.now()));
        return oldSession;
      }

      const oldToken = localStorage.getItem(LEGACY_TOKEN_KEY);
      if (oldToken) return saveSession(oldToken);
    } catch (error) {
      return null;
    }

    return null;
  }

  function getSession() {
    const session =
      parseSession(readCookie(SESSION_COOKIE)) ||
      migrateLegacyTokenIfNeeded();

    if (!session) return null;

    if (Date.now() >= session.expiresAt) {
      clearSession();
      return null;
    }

    return session;
  }

  function getToken() {
    return getSession()?.accessToken ?? null;
  }

  function hasValidSession() {
    return Boolean(getToken());
  }

  function getSessionInfo() {
    const session = getSession();
    if (!session) return null;

    return {
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      remainingMs: Math.max(0, session.expiresAt - Date.now()),
    };
  }

  function getAuthHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function getApiHeaders(extraHeaders = {}) {
    return {
      Accept: "application/json",
      "ngrok-skip-browser-warning": "true",
      ...getAuthHeaders(),
      ...extraHeaders,
    };
  }

  async function verifySession() {
    const token = getToken();
    if (!token) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/me`, {
        method: "GET",
        headers: getApiHeaders(),
      });

      if (response.ok) {
        return await response.json();
      }

      if (response.status === 401 || response.status === 403) {
        clearSession();
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async function requireAuth(options = {}) {
    const redirectTo = options.redirectTo || "login.html";
    const verifyWithServer = options.verifyWithServer === true;

    if (!hasValidSession()) {
      window.location.href = redirectTo;
      return false;
    }

    if (verifyWithServer) {
      const user = await verifySession();
      if (!user) {
        window.location.href = redirectTo;
        return false;
      }
    }

    return true;
  }

  function logout(options = {}) {
    const redirectTo = options.redirectTo || "index.html";

    // Clear backend cookies (ignore errors if logout endpoint not fully integrated yet)
    fetch(`${API_BASE_URL}/api/logout`, { method: "POST" }).catch(() => { });

    clearSession();

    if (window.google?.accounts?.id?.disableAutoSelect) {
      window.google.accounts.id.disableAutoSelect();
    }

    if (redirectTo) {
      window.location.href = redirectTo;
    }
  }

  window.AuthManager = {
    API_BASE_URL,
    SESSION_TTL_DAYS,
    SESSION_TTL_MS,
    setSession: saveSession,
    clearSession,
    getSession,
    getSessionInfo,
    getToken,
    hasValidSession,
    getAuthHeaders,
    getApiHeaders,
    verifySession,
    requireAuth,
    logout,
  };
  window.verifySession = verifySession;
  window.logout = (redirectTo = "index.html") => logout({ redirectTo });
})();

document.addEventListener("DOMContentLoaded", () => {
  const navRoot = document.getElementById("appNav");
  const footerRoot = document.getElementById("appFooter");
  const page = document.body.dataset.page || "";
  const currentFile = (window.location.pathname.split("/").pop() || "").toLowerCase();
  const isAdminRoute = currentFile.startsWith("admin");

  if (navRoot) {
    navRoot.innerHTML = `
      <nav class="navbar navbar-expand-lg navbar-pro sticky-top">
        <div class="container">
          <a class="navbar-brand brand" href="index.html">Place2Visit</a>

          <button
            class="navbar-toggler border-0 nav-toggle"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#mainNav"
            aria-controls="mainNav"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <i class="fa-solid fa-bars"></i>
          </button>

          <div class="collapse navbar-collapse nav-panel" id="mainNav">
            <ul class="navbar-nav nav-pro ms-auto">
              <li class="nav-item">
                <a class="nav-link ${page === "home" ? "active" : ""}" href="index.html">Home</a>
              </li>
              <li class="nav-item">
                <a class="nav-link ${page === "places" ? "active" : ""}" href="places.html">Places</a>
              </li>
              <li class="nav-item">
                <a class="nav-link ${page === "about" ? "active" : ""}" href="about.html">About</a>
              </li>
            </ul>

            <div class="nav-auth-wrap">
              <a href="login.html" class="cta-primary nav-login-btn d-none" id="navLoginBtn">
                Login
              </a>
              <a href="settings.html" class="profile-icon d-none" id="userProfile">
                <i class="fa-regular fa-user"></i>
              </a>
            </div>
          </div>
        </div>
      </nav>
    `;
  }

  if (footerRoot) {
    footerRoot.innerHTML = `
      <footer class="footer-pro">
        <div class="container">
          <div class="row g-4">
            <div class="col-md-4">
              <h6>Place2Visit</h6>
              <p>
                A clean travel platform where curated places are shared with
                practical details and less noise.
              </p>
            </div>

            <div class="col-6 col-md-2">
              <h6>Explore</h6>
              <ul>
                <li><a href="index.html">Home</a></li>
                <li><a href="places.html">Places</a></li>
                <li><a href="settings.html">Settings</a></li>
              </ul>
            </div>

            <div class="col-6 col-md-2">
              <h6>Support</h6>
              <ul>
                <li><a href="about.html">About Us</a></li>
                <li><a href="about.html#privacy-policy">Privacy</a></li>
                <li><a href="about.html#terms-and-conditions">Terms</a></li>
                ${isAdminRoute ? "" : '<li><a href="about.html#feedback">Feedback</a></li>'}
              </ul>
            </div>

            <div class="col-md-4">
              <h6>Why Place2Visit</h6>
              <p class="small-muted mb-2">Curated places, faster decisions.</p>
              <p class="small-muted mb-0">
                Updated weekly with practical location insights.
              </p>
            </div>
          </div>

          <hr />

          <div class="footer-bottom">
            <span>© 2026 Place2Visit</span>
            <div class="socials">
              <a
                href="https://github.com/GURUPREET6365"
                target="_blank"
                rel="noopener noreferrer"
                class="fa-brands fa-github"
                aria-label="GitHub"
              ></a>
              <a href="https://www.youtube.com/@TheHacker-x3u" target="_blank" class="fa-brands fa-youtube" aria-label="YouTube"></a>
              <a href="https://www.linkedin.com/in/gurupreet-kumar-467ab4375/" target="_blank" class="fa-brands fa-linkedin" aria-label="LinkedIn"></a>
            </div>
          </div>
        </div>
      </footer>
    `;
  }

  if (!isAdminRoute) {
    const feedbackGateway = document.createElement("a");
    feedbackGateway.href = "about.html#feedback";
    feedbackGateway.className = "feedback-gateway";
    feedbackGateway.setAttribute("aria-label", "Open feedback form");
    feedbackGateway.innerHTML = '<i class="fa-regular fa-message"></i> Feedback';
    document.body.appendChild(feedbackGateway);
  }

  async function syncNavbarAuthState() {
    const loginBtn = document.getElementById("navLoginBtn");
    const profileBtn = document.getElementById("userProfile");
    if (!loginBtn || !profileBtn) return;

    const auth = window.AuthManager;
    if (!auth?.hasValidSession()) {
      loginBtn.classList.remove("d-none");
      profileBtn.classList.add("d-none");
      return;
    }

    const user = await auth.verifySession();
    if (!user) {
      loginBtn.classList.remove("d-none");
      profileBtn.classList.add("d-none");
      return;
    }

    loginBtn.classList.add("d-none");
    profileBtn.classList.remove("d-none");
  }

  syncNavbarAuthState();
  window.addEventListener("p2v:auth-changed", syncNavbarAuthState);
});

