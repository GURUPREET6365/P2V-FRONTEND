document.addEventListener("DOMContentLoaded", async () => {
  const userProfileBtn = document.getElementById("userProfile");
  const placesGrid = document.getElementById("placesGrid");
  const loadingState = document.getElementById("loadingState");
  const errorState = document.getElementById("errorState");
  const voteState = {};
  let currentUserId = null;

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
      currentUserId = userData.id ?? userData.user_id ?? null;
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
                  <span class="place-chip">#${escapeHtml(place.pincode)}</span>
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

                ${
                  currentUserId
                    ? `
                      <div class="place-actions">
                        <button class="vote-btn like ${
                          voteState[place.id] === "like" ? "active" : ""
                        }" data-vote-type="like" data-place-id="${escapeHtml(place.id)}">
                          <i class="fa-regular fa-thumbs-up"></i> Like
                        </button>
                        <button class="vote-btn dislike ${
                          voteState[place.id] === "dislike" ? "active" : ""
                        }" data-vote-type="dislike" data-place-id="${escapeHtml(place.id)}">
                          <i class="fa-regular fa-thumbs-down"></i> Dislike
                        </button>
                      </div>
                    `
                    : `
                      <div class="place-actions-note">
                        Login to like or dislike this place.
                      </div>
                    `
                }
              </div>
            </article>
          </div>
        `,
      )
      .join("");
  }

  async function submitVote(placeId, vote) {
    if (!currentUserId) return;
    const token = localStorage.getItem("p2v_token");
    if (!token) return;

    const response = await fetch(
      `http://127.0.0.1:8000/api/vote/${currentUserId}/${placeId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ vote }),
      },
    );

    if (!response.ok) {
      throw new Error("Vote request failed");
    }
  }

  function nextVoteState(current, clickedType) {
    if (current === clickedType) return null;
    return clickedType;
  }

  function votePayloadFromState(state) {
    if (state === "like") return true;
    if (state === "dislike") return false;
    return null;
  }

  placesGrid.addEventListener("click", async (event) => {
    const target = event.target.closest(".vote-btn");
    if (!target || !currentUserId) return;

    const placeId = Number(target.dataset.placeId);
    const clickedType = target.dataset.voteType;
    if (!placeId || !clickedType) return;

    const currentState = voteState[placeId] ?? null;
    const newState = nextVoteState(currentState, clickedType);
    const payloadVote = votePayloadFromState(newState);

    const actionWrap = target.closest(".place-actions");
    const actionButtons = actionWrap
      ? Array.from(actionWrap.querySelectorAll(".vote-btn"))
      : [target];

    actionButtons.forEach((btn) => {
      btn.disabled = true;
    });

    try {
      await submitVote(placeId, payloadVote);
      voteState[placeId] = newState;

      if (actionWrap) {
        actionButtons.forEach((btn) => btn.classList.remove("active"));
        if (newState) {
          const selectedBtn = actionWrap.querySelector(
            `.vote-btn[data-vote-type="${newState}"]`,
          );
          if (selectedBtn) selectedBtn.classList.add("active");
        }
      }
    } catch (error) {
      console.error("Vote error:", error);
    } finally {
      actionButtons.forEach((btn) => {
        btn.disabled = false;
      });
    }
  });

  await initAuth();
  fetchPlaces();
});
