document.addEventListener("DOMContentLoaded", async () => {
  const auth = window.AuthManager;
  const loadingState = document.getElementById("loadingState");
  const errorState = document.getElementById("errorState");
  const errorText = document.getElementById("errorText");
  const dataState = document.getElementById("dataState");
  const emptyState = document.getElementById("emptyState");
  const ratingsWrap = document.getElementById("ratingsWrap");
  const ratingsList = document.getElementById("ratingsList");
  const ratingCount = document.getElementById("ratingCount");

  function getRole(user) {
    return String(user?.role || "").trim().toLowerCase();
  }

  function serializeValue(value) {
    if (value === null || value === undefined) return "-";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  function getRatingFieldLabel(key) {
    const labels = {
      user_id: "User ID",
      place_id: "Place ID",
      overall: "Overall",
      cleanliness: "Cleanliness",
      safety: "Safety",
      crowd_behavior: "Crowd Behavior",
      lightning: "Lightning",
      transport_access: "Transport Access",
      facility_quality: "Facility Quality",
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
    if (Array.isArray(payload?.ratings)) return payload.ratings;
    if (payload && typeof payload === "object" && "overall" in payload) return [payload];
    return [];
  }

  function sortRatingsByIdAsc(records) {
    return [...records].sort((a, b) => Number(a?.id ?? 0) - Number(b?.id ?? 0));
  }

  async function fetchRatings() {
    const response = await fetch(`${auth.API_BASE_URL}/api/admin/rating`, {
      headers: auth.getAuthHeaders(),
    });
    if (!response.ok) throw new Error(`Failed to fetch ratings (${response.status})`);
    const payload = await response.json();
    return extractArray(payload);
  }

  function renderRatingCards(records) {
    if (ratingCount) ratingCount.textContent = String(records.length);

    if (!records.length) {
      emptyState.classList.remove("d-none");
      ratingsWrap.classList.add("d-none");
      return;
    }

    emptyState.classList.add("d-none");
    ratingsWrap.classList.remove("d-none");

    const orderedKeys = [
      "user_id",
      "place_id",
      "overall",
      "cleanliness",
      "safety",
      "crowd_behavior",
      "lightning",
      "transport_access",
      "facility_quality",
    ];

    ratingsList.innerHTML = records
      .map((record) => {
        const idDisplay = serializeValue(record?.id);
        const keySet = new Set(Object.keys(record || {}).filter((key) => key !== "id"));
        const detailKeys = [
          ...orderedKeys.filter((key) => keySet.has(key)),
          ...[...keySet].filter((key) => !orderedKeys.includes(key)),
        ];

        const detailBlocks = detailKeys
          .map((key) => {
            const value = serializeValue(record?.[key]);
            return `
              <div class="admin-place-field">
                <div class="admin-place-label">${escapeHtml(getRatingFieldLabel(key))}:</div>
                <div class="admin-place-value">${escapeHtml(value)}</div>
              </div>
            `;
          })
          .join("");

        return `
          <article class="admin-place-card">
            <div class="admin-place-id"><strong>id:</strong> ${escapeHtml(idDisplay)}</div>
            <div class="admin-place-details">
              <div class="admin-place-title"><strong>Rating Details:</strong></div>
              ${detailBlocks}
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function loadAndRenderRatings() {
    try {
      const ratings = await fetchRatings();
      const normalized = sortRatingsByIdAsc(ratings);
      loadingState.classList.add("d-none");
      errorState.classList.add("d-none");
      dataState.classList.remove("d-none");
      renderRatingCards(normalized);
    } catch (error) {
      loadingState.classList.add("d-none");
      dataState.classList.add("d-none");
      errorState.classList.remove("d-none");
      errorText.textContent = error.message;
    }
  }

  const allowed = await auth?.requireAuth?.({
    redirectTo: "login.html?next=admin_ratings.html",
    verifyWithServer: true,
  });
  if (!allowed) return;

  const sessionUser = await auth.verifySession();
  if (getRole(sessionUser) !== "admin") {
    window.location.replace("admin.html");
    return;
  }

  await loadAndRenderRatings();
});
