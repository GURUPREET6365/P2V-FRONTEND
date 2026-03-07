(() => {
  const API_BASE_URL = "https://place-2-visit-production.up.railway.app".replace(/\/+$/, "");
  const SESSION_KEY = "p2v_session";
  const LEGACY_TOKEN_KEY = "p2v_token";
  const SESSION_TTL_DAYS = 5;
  const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

  function notifyAuthChanged() {
    window.dispatchEvent(new CustomEvent("p2v:auth-changed"));
  }

  function parseSession(raw) {
    if (!raw) return null;

    try {
      const session = JSON.parse(raw);
      if (!session || typeof session !== "object") return null;
      if (!session.accessToken || typeof session.accessToken !== "string") {
        return null;
      }
      if (!Number.isFinite(session.expiresAt)) return null;
      return session;
    } catch (error) {
      return null;
    }
  }

  function clearSession(silent = false) {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    if (!silent) notifyAuthChanged();
  }

  function saveSession(accessToken, ttlMs = SESSION_TTL_MS) {
    const now = Date.now();
    const session = {
      accessToken,
      createdAt: now,
      expiresAt: now + ttlMs,
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(LEGACY_TOKEN_KEY, accessToken);
    notifyAuthChanged();
    return session;
  }

  function migrateLegacyTokenIfNeeded() {
    const existingSession = parseSession(localStorage.getItem(SESSION_KEY));
    if (existingSession) return existingSession;

    const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY);
    if (!legacyToken) return null;

    return saveSession(legacyToken);
  }

  function getSession() {
    const session =
      parseSession(localStorage.getItem(SESSION_KEY)) ||
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

  async function verifySession() {
    const token = getToken();
    if (!token) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/me`, {
        method: "GET",
        headers: getAuthHeaders(),
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
    clearSession();

    if (window.google?.accounts?.id?.disableAutoSelect) {
      window.google.accounts.id.disableAutoSelect();
    }

    if (redirectTo) {
      window.location.href = redirectTo;
    }
  }

  const AuthManager = {
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
    verifySession,
    requireAuth,
    logout,
  };

  window.AuthManager = AuthManager;
  window.verifySession = verifySession;
  window.logout = (redirectTo = "index.html") => logout({ redirectTo });
})();
