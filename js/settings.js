document.addEventListener("DOMContentLoaded", async () => {
  const auth = window.AuthManager;
  const loadingState = document.getElementById("loadingState");
  const authState = document.getElementById("authenticatedState");
  const errorState = document.getElementById("errorState");
  const sessionExpiryEl = document.getElementById("sessionExpiry");
  const userCreatedAtEl = document.getElementById("userCreatedAt");
  const userRoleRow = document.getElementById("userRoleRow");
  const userRoleValue = document.getElementById("userRoleValue");
  const adminPanelBtn = document.getElementById("adminPanelBtn");

  function pickFirst(obj, keys) {
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
        return obj[key];
      }
    }
    return null;
  }

  function formatDateTime(value) {
    if (!value) return "Unavailable";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return String(value);
    return dt.toLocaleString();
  }

  if (!auth?.hasValidSession()) {
    window.location.replace("login.html");
    return;
  }

  try {
    const userData = await auth.verifySession();
    if (!userData) {
      throw new Error("Session invalid");
    }

    const fullName =
      `${userData.first_name || ""} ${userData.last_name || ""}`.trim() ||
      "PlaceExplorer User";

    document.getElementById("userName").innerText = fullName;
    document.getElementById("userEmail").innerText = userData.email || "N/A";

    const profileIcon = document.querySelector(".bg-primary i");
    if (userData.profile_url && profileIcon) {
      const avatarContainer = profileIcon.parentElement;
      avatarContainer.innerHTML = `<img src="${userData.profile_url}" class="rounded-circle w-100 h-100" style="object-fit: cover;" alt="Profile">`;
    }

    if (sessionExpiryEl) {
      const sessionInfo = auth.getSessionInfo();
      const expiryText = sessionInfo
        ? new Date(sessionInfo.expiresAt).toLocaleString()
        : "Unavailable";
      sessionExpiryEl.textContent = expiryText;
    }

    if (userCreatedAtEl) {
      const createdAtRaw = pickFirst(userData, [
        "created_at",
        "createdAt",
        "date_joined",
        "joined_at",
        "joinedAt",
      ]);
      userCreatedAtEl.textContent = formatDateTime(createdAtRaw);
    }

    const role = String(userData?.role || "").trim().toLowerCase();
    const isPrivilegedRole = role === "staff" || role === "admin";

    if (adminPanelBtn) {
      adminPanelBtn.classList.toggle("d-none", !isPrivilegedRole);
    }

    if (userRoleRow && userRoleValue) {
      userRoleRow.classList.toggle("d-none", !isPrivilegedRole);
      if (isPrivilegedRole) {
        userRoleValue.textContent = role.charAt(0).toUpperCase() + role.slice(1);
      }
    }

    loadingState.style.display = "none";
    authState.style.display = "block";
  } catch (error) {
    console.error("Settings auth error:", error);
    loadingState.style.display = "none";
    errorState.style.display = "block";

    setTimeout(() => {
      if (!auth?.hasValidSession()) {
        window.location.replace("login.html");
      }
    }, 900);
  }
});

