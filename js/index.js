document.addEventListener("DOMContentLoaded", async () => {
  const userProfileBtn = document.getElementById("userProfile");
  const ctaButton = document.getElementById("ctaButton");
  const homeTopPlacesLoading = document.getElementById("homeTopPlacesLoading");
  const homeTopPlacesError = document.getElementById("homeTopPlacesError");
  const homeTopPlacesEmpty = document.getElementById("homeTopPlacesEmpty");
  const homeTopPlacesGrid = document.getElementById("homeTopPlacesGrid");
  const auth = window.AuthManager;
  let isAuthenticated = false;

  async function initAuth() {
    if (!auth?.hasValidSession()) {
      isAuthenticated = false;
      updateUI(null);
      return null;
    }

    const userData = await auth.verifySession();
    isAuthenticated = Boolean(userData);
    updateUI(userData);
    return userData;
  }

  function updateUI(user) {
    if (user) {
      if (userProfileBtn) userProfileBtn.classList.remove("d-none");
      if (ctaButton) {
        ctaButton.innerText = "View Your Profile";
        ctaButton.href = "settings.html";
      }
    } else {
      if (userProfileBtn) userProfileBtn.classList.add("d-none");
      if (ctaButton) {
        ctaButton.innerText = "Get Started";
        ctaButton.href = "login.html";
      }
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function toFiniteNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function extractPlacesArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.places)) return payload.places;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
  }

  function getOverallRating(place) {
    const explicitOverall = Number(place?.overall);
    if (Number.isFinite(explicitOverall) && explicitOverall > 0) return explicitOverall;
    const legacyOverall = Number(place?.overall_ratings_all_categories);
    if (Number.isFinite(legacyOverall) && legacyOverall > 0) return legacyOverall;

    const categoryKeys = [
      "cleanliness",
      "safety",
      "crowd_behavior",
      "lightning",
      "transport_access",
      "facility_quality",
    ];
    const values = categoryKeys
      .map((key) => Number(place?.[key]))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function getTotalRated(place) {
    return Math.max(0, toFiniteNumber(place?.total_user_rated, 0));
  }

  function getPlaceId(place) {
    return (
      place?.id ??
      place?.place_id ??
      place?.placeId ??
      place?.pk ??
      place?._id ??
      null
    );
  }

  function sortTopPlaces(places) {
    return [...places].sort((a, b) => {
      const byRating = getOverallRating(b) - getOverallRating(a);
      if (byRating !== 0) return byRating;

      const byRatedUsers = getTotalRated(b) - getTotalRated(a);
      if (byRatedUsers !== 0) return byRatedUsers;

      const byLikes = toFiniteNumber(b?.num_likes, 0) - toFiniteNumber(a?.num_likes, 0);
      if (byLikes !== 0) return byLikes;

      return 0;
    });
  }

  async function requestPlacesFromApi() {
    const base = auth?.API_BASE_URL;
    const endpoints = [`${base}/api/all/place`, `${base}/api/place`];
    let lastError = null;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          headers: auth?.getAuthHeaders?.() || {},
        });
        if (!response.ok) {
          lastError = new Error(`API Error ${response.status} from ${endpoint}`);
          continue;
        }
        const payload = await response.json();
        return extractPlacesArray(payload);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("Unable to fetch places");
  }

  function renderTopPlaces(places) {
    if (!homeTopPlacesGrid) return;
    homeTopPlacesGrid.innerHTML = places
      .map((place) => {
        const overall = getOverallRating(place);
        const totalUserRated = getTotalRated(place);
        const placeId = getPlaceId(place);
        const targetHref =
          isAuthenticated && placeId !== null && placeId !== undefined && placeId !== ""
            ? `place_details.html?id=${encodeURIComponent(placeId)}`
            : "places.html";
        return `
          <div class="col-12 col-md-6 col-xl-4">
            <article
              class="place-card reel-card place-card-clickable"
              data-target-href="${escapeHtml(targetHref)}"
              role="link"
              tabindex="0"
            >
              <div class="place-cover">
                <div class="place-cover-overlay">
                  <span class="place-chip">#${escapeHtml(place?.pincode ?? "-")}</span>
                </div>
              </div>
              <div class="place-content">
                <h5 class="place-title">${escapeHtml(place?.place_name || "Untitled Place")}</h5>
                <div class="place-rating-summary">
                  <span class="rating-badge">
                    <i class="fa-solid fa-star"></i>
                    ${overall > 0 ? escapeHtml(overall.toFixed(1)) : "N/A"}
                  </span>
                  <span class="rating-users">${escapeHtml(totalUserRated)} user${totalUserRated === 1 ? "" : "s"} rated</span>
                </div>
                <p class="place-desc">${escapeHtml(place?.about_place || "No description available.")}</p>
                <div class="place-footer">
                  <i class="fa-solid fa-location-dot"></i>
                  <span>${escapeHtml(place?.place_address || "Address unavailable")}</span>
                </div>
              </div>
            </article>
          </div>
        `;
      })
      .join("");
  }

  function navigateFromCard(card) {
    if (!card) return;
    const targetHref = card.dataset.targetHref;
    if (!targetHref) return;
    window.location.href = targetHref;
  }

  async function loadTopPlaces() {
    if (!homeTopPlacesLoading || !homeTopPlacesError || !homeTopPlacesEmpty || !homeTopPlacesGrid) return;
    try {
      const places = await requestPlacesFromApi();
      const topPlaces = sortTopPlaces(places).slice(0, 5);

      homeTopPlacesLoading.classList.add("d-none");
      if (!topPlaces.length) {
        homeTopPlacesEmpty.classList.remove("d-none");
        homeTopPlacesError.classList.add("d-none");
        homeTopPlacesGrid.classList.add("d-none");
        return;
      }

      homeTopPlacesError.classList.add("d-none");
      homeTopPlacesEmpty.classList.add("d-none");
      renderTopPlaces(topPlaces);
      homeTopPlacesGrid.classList.remove("d-none");
    } catch (error) {
      homeTopPlacesLoading.classList.add("d-none");
      homeTopPlacesGrid.classList.add("d-none");
      homeTopPlacesEmpty.classList.add("d-none");
      homeTopPlacesError.classList.remove("d-none");
    }
  }

  homeTopPlacesGrid?.addEventListener("click", (event) => {
    const card = event.target.closest(".place-card-clickable[data-target-href]");
    if (!card) return;
    navigateFromCard(card);
  });

  homeTopPlacesGrid?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest(".place-card-clickable[data-target-href]");
    if (!card) return;
    event.preventDefault();
    navigateFromCard(card);
  });

  await initAuth();
  await loadTopPlaces();
});
