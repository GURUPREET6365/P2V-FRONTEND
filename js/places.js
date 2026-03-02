document.addEventListener("DOMContentLoaded", async () => {
  const userProfileBtn = document.getElementById("userProfile");
  const placesGrid = document.getElementById("placesGrid");
  const loadingState = document.getElementById("loadingState");
  const errorState = document.getElementById("errorState");

  async function initAuth() {
    const token = localStorage.getItem("p2v_token");
    if (!token) {
      updateUI(null);
      return null;
    }

    try {
      const response = await fetch("http://127.0.0.1:8000/api/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        localStorage.removeItem("p2v_token");
        updateUI(null);
        return null;
      }

      const userData = await response.json();
      updateUI(userData);
      return userData;
    } catch (error) {
      console.error("Auth verification failed:", error);
      updateUI(null);
      return null;
    }
  }

  function updateUI(user) {
    if (!userProfileBtn) return;
    if (user) userProfileBtn.classList.remove("d-none");
    else userProfileBtn.classList.add("d-none");
  }

  async function fetchPlaces() {
    try {
      const response = await fetch("http://127.0.0.1:8000/api/all/place");
      if (!response.ok) throw new Error("API Error");

      const data = await response.json();
      renderPlaces(data);
    } catch (error) {
      loadingState.classList.add("d-none");
      errorState.style.display = "block";
      console.error("Fetch error:", error);
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

  function formatCreatedAt(value) {
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "Unknown date";
    return dt.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function renderPlaces(places) {
    loadingState.classList.add("d-none");
    placesGrid.style.display = "flex";

    placesGrid.innerHTML = places
      .map(
        (place) => `
          <div class="col-12 col-md-6 col-xl-4">
            <article class="place-card reel-card">
              <div class="place-cover">
                <div class="place-cover-overlay">
                 
                </div>
              </div>

              <div class="place-content">
                <div class="place-meta">
                  <span><i class="fa-regular fa-calendar"></i> ${escapeHtml(
                    formatCreatedAt(place.created_at),
                  )}</span>
                </div>

                <h5 class="place-title">${escapeHtml(place.place_name)}</h5>

                <p class="place-desc">${escapeHtml(place.about_place)}</p>

                <div class="place-footer">
                  <i class="fa-solid fa-location-dot"></i>
                  <span>${escapeHtml(place.place_address)}</span>
                </div>

                <div class="place-idline">
                  <span><strong>ID:</strong> ${escapeHtml(place.id)}</span>
                  <span><strong>Pincode:</strong> ${escapeHtml(
                    place.pincode,
                  )}</span>
                </div>
              </div>
            </article>
          </div>
        `,
      )
      .join("");
  }

  await initAuth();
  fetchPlaces();
});
