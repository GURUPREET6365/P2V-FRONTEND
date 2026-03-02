document.addEventListener("DOMContentLoaded", async () => {
  // 1. DOM Elements
  const userProfileBtn = document.getElementById("userProfile");
  const ctaButton = document.getElementById("ctaButton");
  const placesGrid = document.getElementById("placesGrid");
  const loadingState = document.getElementById("loadingState");
  const errorState = document.getElementById("errorState");

  // 2. Authentication Logic
  async function initAuth() {
    const token = localStorage.getItem("p2v_token");

    // If no token, UI is already in "logged out" state by default
    if (!token) {
      updateUI(null);
      return null;
    }

    try {
      // Note: Changed endpoint to /me as per your previous requirement
      const response = await fetch("http://127.0.0.1:8000/api/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        updateUI(userData);
        return userData;
      } else {
        // Token expired/invalid
        localStorage.removeItem("p2v_token");
        updateUI(null);
        return null;
      }
    } catch (error) {
      console.error("Auth verification failed:", error);
      updateUI(null);
      return null;
    }
  }

  function updateUI(user) {
    const userProfileBtn = document.getElementById("userProfile");
    const ctaButton = document.getElementById("ctaButton");

    if (user) {
      // User is LOGGED IN
      if (userProfileBtn) userProfileBtn.classList.remove("d-none");

      if (ctaButton) {
        // Option A: Hide the "Get Started" button entirely
        // ctaButton.classList.add('d-none');

        // Option B: Change it to something useful for a member
        ctaButton.innerText = "View Your Profile";
        ctaButton.href = "settings.html";
        ctaButton.classList.replace("btn-primary", "btn-outline-primary");
      }
    } else {
      // User is LOGGED OUT
      if (userProfileBtn) userProfileBtn.classList.add("d-none");

      if (ctaButton) {
        ctaButton.classList.remove("d-none");
        ctaButton.innerText = "Get Started";
        ctaButton.href = "login.html";
        ctaButton.classList.add("btn-primary");
      }
    }
  }

  // 3. Places Logic
  async function fetchPlaces(user) {
    const API_URL = "http://127.0.0.1:8000/api/all/place";

    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error("API Error");
      const data = await response.json();
      renderPlaces(data, !!user); // !!user converts object to boolean (true if logged in)
    } catch (error) {
      loadingState.classList.add("d-none");
      errorState.style.display = "block";
      console.error("Fetch error:", error);
    }
  }

  function renderPlaces(places, isLoggedIn) {
    loadingState.classList.add("d-none");
    placesGrid.style.display = "flex";

    placesGrid.innerHTML = places
      .map(
        (place) => `
        <div class="col-12 col-md-6 col-xl-4">
            <div class="place-card">

                <div class="place-card-top">
                    <span class="place-pin">#${place.pincode}</span>
                    <span class="place-date">
                        ${new Date(place.created_at).toLocaleDateString()}
                    </span>
                </div>

                <h5 class="place-title">${place.place_name}</h5>

                ${
                  isLoggedIn
                    ? `
                    <p class="place-description">
                        ${place.about_place}
                    </p>

                    <div class="place-address">
                        <i class="fa-solid fa-location-dot"></i>
                        <span>${place.place_address}</span>
                    </div>
                `
                    : `
                    <div class="place-locked">
                        <i class="fa-solid fa-lock"></i>
                        <span>Login to view location & details</span>
                    </div>
                `
                }

            </div>
        </div>
    `,
      )
      .join("");
  }

  // 4. EXECUTION FLOW
  // First verify user, then fetch places with that knowledge
  const user = await initAuth();
  fetchPlaces(user);
});
