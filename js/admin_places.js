document.addEventListener("DOMContentLoaded", async () => {
  const auth = window.AuthManager;
  const loadingState = document.getElementById("loadingState");
  const errorState = document.getElementById("errorState");
  const errorText = document.getElementById("errorText");
  const dataState = document.getElementById("dataState");
  const emptyState = document.getElementById("emptyState");
  const placesWrap = document.getElementById("placesWrap");
  const placesList = document.getElementById("placesList");
  const placeCount = document.getElementById("placeCount");
  const emptyStateTitle = emptyState?.querySelector("h6");
  const adminPlaceSearchInput = document.getElementById("adminPlaceSearchInput");
  const adminPlaceSearchClear = document.getElementById("adminPlaceSearchClear");
  const adminPlaceSearchMeta = document.getElementById("adminPlaceSearchMeta");
  const adminPlaceSearchWrap = adminPlaceSearchInput?.closest(".places-search-wrap");
  const addPlaceForm = document.getElementById("addPlaceForm");
  const editPlaceForm = document.getElementById("editPlaceForm");
  const addPlaceModalEl = document.getElementById("addPlaceModal");
  const addPlaceModal = addPlaceModalEl
    ? window.bootstrap.Modal.getOrCreateInstance(addPlaceModalEl)
    : null;
  const editPlaceModalEl = document.getElementById("editPlaceModal");
  const editPlaceModal = editPlaceModalEl
    ? window.bootstrap.Modal.getOrCreateInstance(editPlaceModalEl)
    : null;

  let currentPlaces = [];
  let currentRole = "";
  let currentUser = null;
  let editingRowIndex = null;
  let latestPlacesRequestId = 0;
  let searchDebounceTimer = null;

  function getRole(user) {
    return String(user?.role || "").trim().toLowerCase();
  }

  function getPlaceId(place) {
    return place?.id ?? place?.place_id ?? place?.placeId ?? null;
  }

  function sortPlacesByIdAsc(places) {
    return [...places].sort((a, b) => {
      const aId = Number(getPlaceId(a));
      const bId = Number(getPlaceId(b));
      const aValid = Number.isFinite(aId);
      const bValid = Number.isFinite(bId);
      if (aValid && bValid) return aId - bId;
      if (aValid) return -1;
      if (bValid) return 1;
      return 0;
    });
  }

  function serializeValue(value) {
    if (value === null || value === undefined) return "-";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
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
    if (payload && typeof payload === "object" && payload.place_name) return [payload];
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.results)) return payload.results;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.places)) return payload.places;
    return [];
  }

  function setSearchMeta(searchTerm, count) {
    if (!adminPlaceSearchMeta) return;
    const normalizedSearch = String(searchTerm || "").trim();
    const normalizedCount = Math.max(0, Number(count) || 0);
    if (!normalizedSearch) {
      adminPlaceSearchMeta.textContent = "";
      adminPlaceSearchMeta.classList.remove("is-visible");
      return;
    }
    adminPlaceSearchMeta.textContent = `${normalizedCount} result${
      normalizedCount === 1 ? "" : "s"
    } for "${normalizedSearch}"`;
    adminPlaceSearchMeta.classList.add("is-visible");
  }

  function syncSearchControls(value = "") {
    const hasValue = String(value || "").trim().length > 0;
    if (adminPlaceSearchClear) {
      adminPlaceSearchClear.disabled = !hasValue;
    }
    if (adminPlaceSearchWrap) {
      adminPlaceSearchWrap.classList.toggle("has-value", hasValue);
    }
  }

  function setEmptyStateForSearch(searchTerm = "") {
    const normalizedSearch = String(searchTerm || "").trim();
    if (!emptyStateTitle) return;
    emptyStateTitle.textContent = normalizedSearch
      ? "No matching places found"
      : "No places found";
  }

  async function fetchPlaces(searchTerm = "") {
    const normalizedSearch = String(searchTerm || "").trim();
    const endpoint = normalizedSearch
      ? `${auth.API_BASE_URL}/api/admin/place/search?search=${encodeURIComponent(normalizedSearch)}`
      : `${auth.API_BASE_URL}/api/admin/place`;
    const response = await fetch(endpoint, {
      headers: auth.getAuthHeaders(),
    });
    if (!response.ok) throw new Error(`Failed to fetch places (${response.status})`);
    const payload = await response.json();
    return extractArray(payload);
  }

  async function requestUpdatePlace(placeId, patchBody) {
    const endpoint = `${auth.API_BASE_URL}/api/place/update/${encodeURIComponent(placeId)}`;
    const payload = {
      place_name: patchBody.place_name,
      place_address: patchBody.place_address,
      about_place: patchBody.about_place,
      pincode: patchBody.pincode,
    };

    for (const method of ["PUT", "POST"]) {
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
        // Try next method.
      }
    }

    return false;
  }

  async function requestCreatePlace(payload) {
    const endpoints = [`${auth.API_BASE_URL}/api/add/place`];

    let lastError = "Unknown create-place error";
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

        if (response.ok) {
          return { ok: true, message: "" };
        }

        const raw = await response.text();
        lastError = `POST ${endpoint} -> ${response.status}: ${raw || "No response body"}`;
      } catch (_error) {
        lastError = `POST ${endpoint} failed: ${_error?.message || "Network error"}`;
      }
    }

    return { ok: false, message: lastError };
  }

  async function requestDeletePlace(placeId) {
    const endpoints = [
      `${auth.API_BASE_URL}/api/place/delete/${encodeURIComponent(placeId)}`,
      `${auth.API_BASE_URL}/place/delete/${encodeURIComponent(placeId)}`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...auth.getAuthHeaders(),
          },
        });
        if (response.ok) return true;
      } catch (_error) {
        // Try next endpoint.
      }
    }

    return false;
  }

  function renderPlaceCards(records) {
    if (placeCount) placeCount.textContent = String(records.length);

    if (!records.length) {
      emptyState.classList.remove("d-none");
      placesWrap.classList.add("d-none");
      return;
    }

    emptyState.classList.add("d-none");
    placesWrap.classList.remove("d-none");

    placesList.innerHTML = records
      .map((record, rowIndex) => {
        const placeId = getPlaceId(record);
        const idDisplay = serializeValue(record?.id);
        const detailKeys = Object.keys(record || {}).filter((key) => {
          const normalized = String(key).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
          return normalized !== "id";
        });
        const detailBlocks = detailKeys
          .map((key) => {
            const value = serializeValue(record?.[key]);
            return `
              <div class="admin-place-field">
                <div class="admin-place-label">${escapeHtml(key)}:</div>
                <div class="admin-place-value">${escapeHtml(value)}</div>
              </div>
            `;
          })
          .join("");

        const deleteControl =
          currentRole === "admin"
            ? `
              <button type="button" class="admin-delete-btn" data-row-index="${rowIndex}" data-place-id="${escapeHtml(placeId)}" aria-label="Delete place ${escapeHtml(idDisplay)}" title="Delete place">
                <i class="fa-solid fa-trash"></i>
              </button>
            `
            : "";

        return `
          <article class="admin-place-card">
            <div class="admin-card-actions">
              <button type="button" class="admin-place-edit-btn" data-row-index="${rowIndex}" aria-label="Edit place ${escapeHtml(idDisplay)}" title="Edit place">
                <i class="fa-solid fa-pen-to-square me-1"></i>
                Edit
              </button>
              ${deleteControl}
            </div>
            <div class="admin-place-id"><strong>id:</strong> ${escapeHtml(idDisplay)}</div>
            <div class="admin-place-details">
              <div class="admin-place-title"><strong>Place Details:</strong></div>
              ${detailBlocks}
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function loadAndRenderPlaces(searchTerm = "") {
    const requestId = ++latestPlacesRequestId;
    const normalizedSearch = String(searchTerm || "").trim();

    try {
      const places = await fetchPlaces(normalizedSearch);
      if (requestId !== latestPlacesRequestId) return;
      currentPlaces = sortPlacesByIdAsc(
        places.map((place) => ({
        ...place,
        id: place?.id ?? place?.place_id ?? place?.placeId ?? null,
        })),
      );
      setSearchMeta(normalizedSearch, currentPlaces.length);
      setEmptyStateForSearch(normalizedSearch);
      loadingState.classList.add("d-none");
      errorState.classList.add("d-none");
      dataState.classList.remove("d-none");
      renderPlaceCards(currentPlaces);
    } catch (error) {
      if (requestId !== latestPlacesRequestId) return;
      loadingState.classList.add("d-none");
      dataState.classList.add("d-none");
      errorState.classList.remove("d-none");
      errorText.textContent = error.message;
    }
  }

  const allowed = await auth?.requireAuth?.({
    redirectTo: "login.html?next=admin_places.html",
    verifyWithServer: true,
  });
  if (!allowed) return;

  const user = await auth.verifySession();
  currentUser = user;
  const role = getRole(user);
  currentRole = role;
  if (role !== "staff" && role !== "admin") {
    window.location.replace("settings.html");
    return;
  }

  placesList.addEventListener("click", async (event) => {
    const editPlaceBtn = event.target.closest(".admin-place-edit-btn");
    if (editPlaceBtn) {
      const rowIndex = Number(editPlaceBtn.dataset.rowIndex);
      if (Number.isNaN(rowIndex) || !currentPlaces[rowIndex]) return;

      editingRowIndex = rowIndex;
      const place = currentPlaces[rowIndex];
      document.getElementById("editPlaceName").value = place?.place_name ?? "";
      document.getElementById("editPlaceAddress").value = place?.place_address ?? "";
      document.getElementById("editPlacePincode").value = String(place?.pincode ?? "");
      document.getElementById("editPlaceAbout").value = place?.about_place ?? "";
      editPlaceModal?.show();
      return;
    }

    const deleteBtn = event.target.closest(".admin-delete-btn");
    if (deleteBtn) {
      if (currentRole !== "admin") return;
      const rowIndex = Number(deleteBtn.dataset.rowIndex);
      const placeId = deleteBtn.dataset.placeId;
      if (Number.isNaN(rowIndex) || !placeId) return;

      const shouldDelete = window.confirm("Delete this place?");
      if (!shouldDelete) return;

      deleteBtn.disabled = true;
      const ok = await requestDeletePlace(placeId);
      deleteBtn.disabled = false;

      if (!ok) {
        window.alert("Delete endpoint failed for this place.");
        return;
      }

      currentPlaces = currentPlaces.filter((_row, idx) => idx !== rowIndex);
      renderPlaceCards(currentPlaces);
      return;
    }
  });

  if (addPlaceForm) {
    addPlaceForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const payload = {
        place_name: document.getElementById("addPlaceName")?.value?.trim() || "",
        place_address: document.getElementById("addPlaceAddress")?.value?.trim() || "",
        about_place: document.getElementById("addPlaceAbout")?.value?.trim() || "",
        pincode: Number(document.getElementById("addPlacePincode")?.value || ""),
        user_id: Number(currentUser?.id ?? currentUser?.user_id ?? NaN),
      };

      if (
        !payload.place_name ||
        !payload.place_address ||
        !payload.about_place ||
        !Number.isInteger(payload.pincode) ||
        !Number.isInteger(payload.user_id)
      ) {
        window.alert("Please fill all fields with valid values (pincode and user_id must be integers).");
        return;
      }

      const createResult = await requestCreatePlace(payload);
      if (!createResult.ok) {
        console.error("Create place failed:", createResult.message);
        window.alert(`Create place failed.\n${createResult.message}`);
        return;
      }

      addPlaceForm.reset();
      addPlaceModal?.hide();
      await loadAndRenderPlaces(adminPlaceSearchInput?.value || "");
    });
  }

  if (editPlaceForm) {
    editPlaceForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (editingRowIndex === null || !currentPlaces[editingRowIndex]) return;

      const place = currentPlaces[editingRowIndex];
      const placeId = getPlaceId(place);
      if (!placeId) {
        window.alert("Cannot update place: missing place id.");
        return;
      }

      const payload = {
        place_name: document.getElementById("editPlaceName")?.value?.trim() || "",
        place_address: document.getElementById("editPlaceAddress")?.value?.trim() || "",
        about_place: document.getElementById("editPlaceAbout")?.value?.trim() || "",
        pincode: Number(document.getElementById("editPlacePincode")?.value || ""),
      };

      if (
        !payload.place_name ||
        !payload.place_address ||
        !payload.about_place ||
        !Number.isInteger(payload.pincode)
      ) {
        window.alert("Please fill all fields with valid values.");
        return;
      }

      const ok = await requestUpdatePlace(placeId, payload);
      if (!ok) {
        window.alert("Update place endpoint failed.");
        return;
      }

      editPlaceModal?.hide();
      editingRowIndex = null;
      await loadAndRenderPlaces(adminPlaceSearchInput?.value || "");
    });
  }

  adminPlaceSearchInput?.addEventListener("input", () => {
    syncSearchControls(adminPlaceSearchInput.value || "");
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    searchDebounceTimer = setTimeout(() => {
      loadAndRenderPlaces(adminPlaceSearchInput.value || "");
    }, 300);
  });

  adminPlaceSearchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
    loadAndRenderPlaces(adminPlaceSearchInput.value || "");
  });

  adminPlaceSearchClear?.addEventListener("click", () => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
    if (adminPlaceSearchInput) {
      adminPlaceSearchInput.value = "";
      adminPlaceSearchInput.focus();
    }
    syncSearchControls("");
    loadAndRenderPlaces("");
  });

  syncSearchControls(adminPlaceSearchInput?.value || "");
  await loadAndRenderPlaces();
});

