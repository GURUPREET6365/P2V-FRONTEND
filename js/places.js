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
      const token = localStorage.getItem("p2v_token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch("http://127.0.0.1:8000/api/all/place", {
        headers,
      });
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
    voteStateResetFromApi(places);

    placesGrid.innerHTML = places
      .map((place) => {
        const placeId = getPlaceId(place);
        const placeKey = getPlaceKey(place);
        const currentVote = voteState[placeKey] ?? voteStateFromVoted(place.voted);

        return `
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
                          currentVote === "like" ? "active" : ""
                        }" data-vote-type="like" data-place-id="${escapeHtml(placeId)}" data-place-key="${escapeHtml(placeKey)}">
                          <i class="fa-regular fa-thumbs-up"></i> Like
                        </button>
                        <button class="vote-btn dislike ${
                          currentVote === "dislike" ? "active" : ""
                        }" data-vote-type="dislike" data-place-id="${escapeHtml(placeId)}" data-place-key="${escapeHtml(placeKey)}">
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
        `;
      })
      .join("");
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

  function getPlaceKey(place) {
    const placeId = getPlaceId(place);
    if (placeId) return `id:${placeId}`;
    return `meta:${place?.place_name ?? ""}|${place?.place_address ?? ""}|${
      place?.pincode ?? ""
    }`;
  }

  function voteStateFromVoted(voted) {
    if (voted === true || voted === "true" || voted === 1 || voted === "1") {
      return "like";
    }
    if (
      voted === false ||
      voted === "false" ||
      voted === 0 ||
      voted === "0"
    ) {
      return "dislike";
    }
    return null;
  }

  function voteStateResetFromApi(places) {
    Object.keys(voteState).forEach((key) => delete voteState[key]);
    places.forEach((place) => {
      if (!getPlaceId(place)) {
        console.warn(
          "Missing place id in /api/all/place response for:",
          place?.place_name ?? place,
        );
      }
      const mappedState = voteStateFromVoted(place.voted);
      if (mappedState) {
        voteState[getPlaceKey(place)] = mappedState;
      }
    });
  }

  async function submitVote(placeId, vote) {
    const token = localStorage.getItem("p2v_token");
    if (!token) {
      throw new Error("Missing auth token");
    }

    const response = await fetch(
      `http://127.0.0.1:8000/api/vote/${encodeURIComponent(placeId)}`,
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
      throw new Error(`Vote request failed (${response.status})`);
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

    const placeId = target.dataset.placeId;
    const placeKey = target.dataset.placeKey;
    const clickedType = target.dataset.voteType;
    if (
      !placeId ||
      placeId === "null" ||
      placeId === "undefined" ||
      !placeKey ||
      !clickedType
    ) {
      console.warn(
        "Vote skipped: invalid place_id. Ensure /api/all/place returns id/place_id for each place.",
      );
      return;
    }

    const currentState = voteState[placeKey] ?? null;
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
      voteState[placeKey] = newState;

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
