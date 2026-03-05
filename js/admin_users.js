document.addEventListener("DOMContentLoaded", async () => {
  const auth = window.AuthManager;
  const loadingState = document.getElementById("loadingState");
  const errorState = document.getElementById("errorState");
  const errorText = document.getElementById("errorText");
  const dataState = document.getElementById("dataState");
  const emptyState = document.getElementById("emptyState");
  const usersWrap = document.getElementById("usersWrap");
  const usersList = document.getElementById("usersList");
  const userCount = document.getElementById("userCount");
  const emptyStateTitle = emptyState?.querySelector("h6");
  const adminUserSearchInput = document.getElementById("adminUserSearchInput");
  const adminUserSearchClear = document.getElementById("adminUserSearchClear");
  const adminUserSearchMeta = document.getElementById("adminUserSearchMeta");
  const adminUserSearchWrap = adminUserSearchInput?.closest(".places-search-wrap");
  const addUserForm = document.getElementById("addUserForm");
  const editUserForm = document.getElementById("editUserForm");
  const addUserModalEl = document.getElementById("addUserModal");
  const addUserModal = addUserModalEl
    ? window.bootstrap.Modal.getOrCreateInstance(addUserModalEl)
    : null;
  const editUserModalEl = document.getElementById("editUserModal");
  const editUserModal = editUserModalEl
    ? window.bootstrap.Modal.getOrCreateInstance(editUserModalEl)
    : null;

  let currentUsers = [];
  let editingRowIndex = null;
  let latestUsersRequestId = 0;
  let searchDebounceTimer = null;

  function getRole(user) {
    return String(user?.role || "").trim().toLowerCase();
  }

  function serializeValue(value) {
    if (value === null || value === undefined) return "-";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  function halfMaskPassword(rawValue) {
    const value = serializeValue(rawValue);
    if (value === "-") return "-";
    const visibleCount = Math.max(1, Math.ceil(value.length / 2));
    const visiblePart = value.slice(0, visibleCount);
    const maskedPart = "*".repeat(Math.max(0, value.length - visibleCount));
    return `${visiblePart}${maskedPart}`;
  }

  function formatDateTime(value) {
    const text = serializeValue(value);
    if (text === "-") return "-";
    const dt = new Date(text);
    if (Number.isNaN(dt.getTime())) return text;
    return dt.toLocaleString();
  }

  function getUserFieldLabel(key) {
    const labels = {
      first_name: "First Name",
      last_name: "Last Name",
      email: "Email",
      role: "Role",
      provider: "Provider",
      google_sub: "Google Sub",
      profile_url: "Profile URL",
      password: "Password",
      created_at: "Created At",
    };
    return labels[key] || key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function extractArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.results)) return payload.results;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.users)) return payload.users;
    if (payload && typeof payload === "object" && payload.email) return [payload];
    return [];
  }

  function sortUsersByIdAsc(users) {
    return [...users].sort((a, b) => Number(a?.id ?? 0) - Number(b?.id ?? 0));
  }

  function setSearchMeta(searchTerm, count) {
    if (!adminUserSearchMeta) return;
    const normalizedSearch = String(searchTerm || "").trim();
    const normalizedCount = Math.max(0, Number(count) || 0);
    if (!normalizedSearch) {
      adminUserSearchMeta.textContent = "";
      adminUserSearchMeta.classList.remove("is-visible");
      return;
    }
    adminUserSearchMeta.textContent = `${normalizedCount} result${
      normalizedCount === 1 ? "" : "s"
    } for "${normalizedSearch}"`;
    adminUserSearchMeta.classList.add("is-visible");
  }

  function syncSearchControls(value = "") {
    const hasValue = String(value || "").trim().length > 0;
    if (adminUserSearchClear) {
      adminUserSearchClear.disabled = !hasValue;
    }
    if (adminUserSearchWrap) {
      adminUserSearchWrap.classList.toggle("has-value", hasValue);
    }
  }

  function setEmptyStateForSearch(searchTerm = "") {
    const normalizedSearch = String(searchTerm || "").trim();
    if (!emptyStateTitle) return;
    emptyStateTitle.textContent = normalizedSearch
      ? "No matching users found"
      : "No users found";
  }

  async function fetchUsers(searchTerm = "") {
    const normalizedSearch = String(searchTerm || "").trim();
    const endpoint = normalizedSearch
      ? `${auth.API_BASE_URL}/api/admin/user/search?search=${encodeURIComponent(normalizedSearch)}`
      : `${auth.API_BASE_URL}/api/admin/user`;
    const response = await fetch(endpoint, {
      headers: auth.getAuthHeaders(),
    });
    if (!response.ok) throw new Error(`Failed to fetch users (${response.status})`);
    const payload = await response.json();
    return extractArray(payload);
  }

  async function requestCreateUser(payload) {
    const endpoints = [`${auth.API_BASE_URL}/api/create/user`];

    let lastError = "Unknown create-user error";
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...auth.getAuthHeaders(),
          },
          body: JSON.stringify(payload),
        });
        if (response.ok) return { ok: true, message: "" };
        const raw = await response.text();
        lastError = `POST ${endpoint} -> ${response.status}: ${raw || "No response body"}`;
      } catch (error) {
        lastError = `POST ${endpoint} failed: ${error?.message || "Network error"}`;
      }
    }

    return { ok: false, message: lastError };
  }

  async function requestUpdateUser(userId, payload) {
    const endpoints = [
      `${auth.API_BASE_URL}/api/user/update/${encodeURIComponent(userId)}`,
      `${auth.API_BASE_URL}/api/admin/user/update/${encodeURIComponent(userId)}`,
      `${auth.API_BASE_URL}/api/admin/user/${encodeURIComponent(userId)}`,
    ];

    for (const endpoint of endpoints) {
      for (const method of ["PUT", "POST", "PATCH"]) {
        try {
          const response = await fetch(endpoint, {
            method,
            headers: {
              "Content-Type": "application/json",
              ...auth.getAuthHeaders(),
            },
            body: JSON.stringify(payload),
          });
          if (response.ok) return true;
        } catch (_error) {
          // Try next method/endpoint
        }
      }
    }

    return false;
  }

  async function requestDeleteUser(userId) {
    const endpoint = `${auth.API_BASE_URL}/api/user/delete/${encodeURIComponent(userId)}`;

    for (const method of ["DELETE"]) {
      try {
        const response = await fetch(endpoint, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...auth.getAuthHeaders(),
          },
        });
        if (response.ok) return true;
      } catch (_error) {
        // Try next method.
      }
    }

    return false;
  }

  function renderUserCards(records) {
    if (userCount) userCount.textContent = String(records.length);

    if (!records.length) {
      emptyState.classList.remove("d-none");
      usersWrap.classList.add("d-none");
      return;
    }

    emptyState.classList.add("d-none");
    usersWrap.classList.remove("d-none");

        const orderedKeys = [
      "first_name",
      "last_name",
      "email",
      "role",
      "provider",
      "google_sub",
      "profile_url",
      "password",
      "created_at",
    ];

    usersList.innerHTML = records
      .map((record, rowIndex) => {
        const idDisplay = serializeValue(record?.id);
        const keySet = new Set(Object.keys(record || {}).filter((key) => key !== "id"));
        const detailKeys = [
          ...orderedKeys.filter((key) => keySet.has(key)),
          ...[...keySet].filter((key) => !orderedKeys.includes(key)),
        ];
        const detailBlocks = detailKeys
          .map((key) => {
            const rawValue = record?.[key];
            const value =
              key === "password"
                ? halfMaskPassword(rawValue)
                : key === "created_at"
                  ? formatDateTime(rawValue)
                  : serializeValue(rawValue);
            return `
              <div class="admin-place-field">
                <div class="admin-place-label">${escapeHtml(getUserFieldLabel(key))}:</div>
                <div class="admin-place-value">${escapeHtml(value)}</div>
              </div>
            `;
          })
          .join("");

        return `
          <article class="admin-place-card">
            <div class="admin-card-actions">
              <button type="button" class="admin-place-edit-btn" data-row-index="${rowIndex}" aria-label="Edit user ${escapeHtml(idDisplay)}" title="Edit user">
                <i class="fa-solid fa-pen-to-square me-1"></i>
                Edit
              </button>
              <button type="button" class="admin-delete-btn" data-row-index="${rowIndex}" data-user-id="${escapeHtml(idDisplay)}" aria-label="Delete user ${escapeHtml(idDisplay)}" title="Delete user">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
            <div class="admin-place-id"><strong>id:</strong> ${escapeHtml(idDisplay)}</div>
            <div class="admin-place-details">
              <div class="admin-place-title"><strong>User Details:</strong></div>
              ${detailBlocks}
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function loadAndRenderUsers(searchTerm = "") {
    const requestId = ++latestUsersRequestId;
    const normalizedSearch = String(searchTerm || "").trim();

    try {
      const users = await fetchUsers(normalizedSearch);
      if (requestId !== latestUsersRequestId) return;
      currentUsers = sortUsersByIdAsc(users);
      setSearchMeta(normalizedSearch, currentUsers.length);
      setEmptyStateForSearch(normalizedSearch);
      loadingState.classList.add("d-none");
      errorState.classList.add("d-none");
      dataState.classList.remove("d-none");
      renderUserCards(currentUsers);
    } catch (error) {
      if (requestId !== latestUsersRequestId) return;
      loadingState.classList.add("d-none");
      dataState.classList.add("d-none");
      errorState.classList.remove("d-none");
      errorText.textContent = error.message;
    }
  }

  const allowed = await auth?.requireAuth?.({
    redirectTo: "login.html?next=admin_users.html",
    verifyWithServer: true,
  });
  if (!allowed) return;

  const sessionUser = await auth.verifySession();
  if (getRole(sessionUser) !== "admin") {
    window.location.replace("admin.html");
    return;
  }

  usersList.addEventListener("click", (event) => {
    const editBtn = event.target.closest(".admin-place-edit-btn");
    if (editBtn) {
      const rowIndex = Number(editBtn.dataset.rowIndex);
      if (Number.isNaN(rowIndex) || !currentUsers[rowIndex]) return;

      editingRowIndex = rowIndex;
      const user = currentUsers[rowIndex];
      document.getElementById("editUserFirstName").value = user?.first_name ?? "";
      document.getElementById("editUserLastName").value = user?.last_name ?? "";
      document.getElementById("editUserEmail").value = user?.email ?? "";
      document.getElementById("editUserPassword").value = user?.password ?? "";
      editUserModal?.show();
      return;
    }

    const deleteBtn = event.target.closest(".admin-delete-btn");
    if (!deleteBtn) return;

    const rowIndex = Number(deleteBtn.dataset.rowIndex);
    const userId = Number(deleteBtn.dataset.userId);
    if (Number.isNaN(rowIndex) || !Number.isFinite(userId)) return;

    const shouldDelete = window.confirm("Delete this user?");
    if (!shouldDelete) return;

    deleteBtn.disabled = true;
    requestDeleteUser(userId)
      .then((ok) => {
        if (!ok) {
          window.alert("Delete user endpoint failed.");
          return;
        }

        currentUsers = currentUsers.filter((_row, idx) => idx !== rowIndex);
        renderUserCards(currentUsers);
      })
      .finally(() => {
        deleteBtn.disabled = false;
      });
  });

  if (addUserForm) {
    addUserForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const payload = {
        first_name: document.getElementById("addUserFirstName")?.value?.trim() || "",
        last_name: document.getElementById("addUserLastName")?.value?.trim() || "",
        email: document.getElementById("addUserEmail")?.value?.trim() || "",
        password: document.getElementById("addUserPassword")?.value || "",
      };

      if (!payload.first_name || !payload.last_name || !payload.email || !payload.password) {
        window.alert("Please fill all fields.");
        return;
      }

      const result = await requestCreateUser(payload);
      if (!result.ok) {
        window.alert(`Create user failed.\n${result.message}`);
        return;
      }

      addUserForm.reset();
      addUserModal?.hide();
      await loadAndRenderUsers(adminUserSearchInput?.value || "");
    });
  }

  if (editUserForm) {
    editUserForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (editingRowIndex === null || !currentUsers[editingRowIndex]) return;

      const user = currentUsers[editingRowIndex];
      const userId = user?.id;
      if (!userId) {
        window.alert("Cannot update user: missing id.");
        return;
      }

      const payload = {
        first_name: document.getElementById("editUserFirstName")?.value?.trim() || "",
        last_name: document.getElementById("editUserLastName")?.value?.trim() || "",
        email: document.getElementById("editUserEmail")?.value?.trim() || "",
        password: document.getElementById("editUserPassword")?.value || "",
      };

      if (!payload.first_name || !payload.last_name || !payload.email || !payload.password) {
        window.alert("Please fill all fields.");
        return;
      }

      const ok = await requestUpdateUser(userId, payload);
      if (!ok) {
        window.alert("Update user endpoint failed.");
        return;
      }

      editUserModal?.hide();
      editingRowIndex = null;
      await loadAndRenderUsers(adminUserSearchInput?.value || "");
    });
  }

  adminUserSearchInput?.addEventListener("input", () => {
    syncSearchControls(adminUserSearchInput.value || "");
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    searchDebounceTimer = setTimeout(() => {
      loadAndRenderUsers(adminUserSearchInput.value || "");
    }, 300);
  });

  adminUserSearchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
    loadAndRenderUsers(adminUserSearchInput.value || "");
  });

  adminUserSearchClear?.addEventListener("click", () => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
    if (adminUserSearchInput) {
      adminUserSearchInput.value = "";
      adminUserSearchInput.focus();
    }
    syncSearchControls("");
    loadAndRenderUsers("");
  });

  syncSearchControls(adminUserSearchInput?.value || "");
  await loadAndRenderUsers();
});

