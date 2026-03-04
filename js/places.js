document.addEventListener("DOMContentLoaded", async () => {
  const userProfileBtn = document.getElementById("userProfile");
  const placesGrid = document.getElementById("placesGrid");
  const loadingState = document.getElementById("loadingState");
  const errorState = document.getElementById("errorState");
  const emptyState = document.getElementById("emptyState");
  const ratingModalEl = document.getElementById("ratingModal");
  const ratingModalForm = document.getElementById("ratingModalForm");
  const ratingModalBody = document.getElementById("ratingModalBody");
  const ratingModalLabel = document.getElementById("ratingModalLabel");
  const voteState = {};
  const voteCounts = {};
  const userRatingState = {};
  const placeAggregateState = {};
  const auth = window.AuthManager;
  const ratingFields = [
    { key: "overall", label: "Overall", example: "Example: overall experience, comfort, and satisfaction." },
    { key: "cleanliness", label: "Cleanliness", example: "Example: road cleanliness, litter, and public hygiene." },
    { key: "safety", label: "Safety", example: "Example: personal safety, theft risk, and unsafe zones." },
    { key: "crowd_behavior", label: "Crowd Behaviour", example: "Example: helpfulness, harassment-free environment, and discipline." },
    { key: "lightning", label: "Lighting (Night Street Light)", example: "Example: street light coverage, brightness, and dark spots at night." },
    { key: "transport_access", label: "Transport Access", example: "Example: bus/metro/taxi availability, roads, and last-mile access." },
    { key: "facility_quality", label: "Facility Quality", example: "Example: drinking water, washroom, seating, and basic amenities." },
  ];
  const ratingModal = ratingModalEl ? new bootstrap.Modal(ratingModalEl) : null;
  let activeRatingPlaceId = null;
  let activeRatingPlaceKey = null;
  let currentUserId = null;

  async function initAuth() {
    if (!auth?.hasValidSession()) {
      updateUI(null);
      return null;
    }

    try {
      const userData = await auth.verifySession();
      if (!userData) {
        updateUI(null);
        return null;
      }
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

  function extractPlacesArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.places)) return payload.places;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
  }

  async function requestPlacesFromApi() {
    const endpoints = [
      "http://127.0.0.1:8000/api/all/place",
      "http://127.0.0.1:8000/api/place",
    ];

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

  async function fetchPlaces() {
    try {
      const places = await requestPlacesFromApi();
      if (!Array.isArray(places) || places.length === 0) {
        loadingState.classList.add("d-none");
        placesGrid.style.display = "none";
        errorState.style.display = "none";
        if (emptyState) emptyState.style.display = "block";
        return;
      }

      if (emptyState) emptyState.style.display = "none";
      renderPlaces(places);
    } catch (error) {
      loadingState.classList.add("d-none");
      placesGrid.style.display = "none";
      if (emptyState) emptyState.style.display = "none";
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

  function toFiniteNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function deriveOverallRating(place) {
    // Prefer explicit overall if present; otherwise average available category values.
    const explicitOverall = Number(place?.overall);
    if (Number.isFinite(explicitOverall) && explicitOverall > 0) {
      return explicitOverall;
    }

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

  function getOverallRating(place) {
    // Legacy fallback kept for compatibility if older API still sends it.
    const legacyOverall = Number(place?.overall_ratings_all_categories);
    if (Number.isFinite(legacyOverall) && legacyOverall > 0) return legacyOverall;
    return deriveOverallRating(place);
  }

  function getTotalUserRated(place) {
    return toFiniteNumber(place?.total_user_rated, 0);
  }

  function sortPlacesByRatingAndUsers(places) {
    return [...places].sort((a, b) => {
      const ratingDiff = getOverallRating(b) - getOverallRating(a);
      if (ratingDiff !== 0) return ratingDiff;

      const usersDiff = getTotalUserRated(b) - getTotalUserRated(a);
      if (usersDiff !== 0) return usersDiff;

      const likesDiff = toFiniteNumber(b?.num_likes, 0) - toFiniteNumber(a?.num_likes, 0);
      if (likesDiff !== 0) return likesDiff;

      const createdA = new Date(a?.created_at).getTime();
      const createdB = new Date(b?.created_at).getTime();
      return (Number.isFinite(createdB) ? createdB : 0) - (Number.isFinite(createdA) ? createdA : 0);
    });
  }

  function buildStarGroup(field) {
    const groupName = `rating-${field.key}`;
    const stars = [5, 4, 3, 2, 1]
      .map((score) => {
        const inputId = `${groupName}-${score}`;
        return `
          <input class="rating-star-input" type="radio" name="${escapeHtml(groupName)}" id="${escapeHtml(inputId)}" value="${score}" ${
            score === 1 ? "required" : ""
          } />
          <label class="rating-star-label" for="${escapeHtml(inputId)}" title="${score} star${score > 1 ? "s" : ""}">
            <i class="fa-solid fa-star"></i>
          </label>
        `;
      })
      .join("");

    return `
      <fieldset class="rating-row">
        <legend>${escapeHtml(field.label)} <span class="rating-required">*</span></legend>
        <p class="rating-example mb-2">${escapeHtml(field.example || "")}</p>
        <div class="rating-star-group" aria-label="${escapeHtml(field.label)} rating out of 5 stars">
          ${stars}
        </div>
      </fieldset>
    `;
  }

  function renderModalRatingFields() {
    if (!ratingModalBody) return;
    ratingModalBody.innerHTML = `
      <div class="rating-form">
        ${ratingFields.map((field) => buildStarGroup(field)).join("")}
      </div>
    `;
  }

  function openRatingModal(placeId, placeName) {
    if (!ratingModal || !ratingModalForm || !ratingModalLabel) return;
    activeRatingPlaceId = placeId;
    activeRatingPlaceKey = null;
    ratingModalForm.reset();
    setRatingFeedback("","error");
    ratingModalLabel.textContent = `Rate: ${placeName || "Place"}`;
    renderModalRatingFields();
    ratingModal.show();
  }

  function openRatingModalWithState(placeId, placeName, placeKey) {
    openRatingModal(placeId, placeName);
    activeRatingPlaceKey = placeKey || null;
    prefillRatingForm(ratingModalForm, userRatingState[placeKey]?.ratings);
  }

  function renderPlaces(places) {
    const sortedPlaces = sortPlacesByRatingAndUsers(places);
    loadingState.classList.add("d-none");
    errorState.style.display = "none";
    if (emptyState) emptyState.style.display = "none";
    placesGrid.style.display = "flex";
    voteStateResetFromApi(sortedPlaces);

    placesGrid.innerHTML = sortedPlaces
      .map((place) => {
        const placeId = getPlaceId(place);
        const placeKey = getPlaceKey(place);
        const currentVote = voteState[placeKey] ?? voteStateFromVoted(place.voted);
        const counts = voteCounts[placeKey] || { likes: 0, dislikes: 0 };
        const aggregate = placeAggregateState[placeKey] || {
          overall: getOverallRating(place),
          total: getTotalUserRated(place),
        };
        const overallRating = toFiniteNumber(aggregate.overall, 0);
        const totalUserRated = Math.max(0, toFiniteNumber(aggregate.total, 0));
        const hasRatings = totalUserRated > 0;
        const canOpenDetails =
          Boolean(currentUserId) &&
          placeId !== null &&
          placeId !== undefined &&
          placeId !== "";
        const cardClass = canOpenDetails
          ? "place-card reel-card place-card-clickable"
          : "place-card reel-card";
        const cardAttributes = canOpenDetails
          ? `data-place-id="${escapeHtml(placeId)}" role="link" tabindex="0" aria-label="View details for ${escapeHtml(
              place.place_name || "place",
            )}"`
          : "";

        return `
          <div class="col-12 col-md-6 col-xl-4">
            <article class="${cardClass}" ${cardAttributes}>
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

                <div class="place-rating-summary">
                  <span class="rating-badge">
                    <i class="fa-solid fa-star"></i>
                    <span data-overall-rating>${hasRatings ? escapeHtml(overallRating.toFixed(1)) : "N/A"}</span>
                  </span>
                  <span class="rating-users" data-total-rated>
                    ${escapeHtml(totalUserRated)} user${totalUserRated === 1 ? "" : "s"} rated
                  </span>
                </div>

                <p class="place-desc">${escapeHtml(place.about_place)}</p>

                <div class="place-footer">
                  <i class="fa-solid fa-location-dot"></i>
                  <span>${escapeHtml(place.place_address)}</span>
                </div>

                ${
                  canOpenDetails
                    ? `
                      <div class="place-open-hint">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        Open full details
                      </div>
                    `
                    : ""
                }

                ${
                  currentUserId
                    ? `
                      <div class="place-actions">
                        <button class="vote-btn like ${
                          currentVote === "like" ? "active" : ""
                        }" data-vote-type="like" data-place-id="${escapeHtml(placeId)}" data-place-key="${escapeHtml(placeKey)}">
                          <i class="fa-regular fa-thumbs-up"></i> Like
                          <span class="vote-count" data-count-like>${escapeHtml(counts.likes)}</span>
                        </button>
                        <button class="vote-btn dislike ${
                          currentVote === "dislike" ? "active" : ""
                        }" data-vote-type="dislike" data-place-id="${escapeHtml(placeId)}" data-place-key="${escapeHtml(placeKey)}">
                          <i class="fa-regular fa-thumbs-down"></i> Dislike
                          <span class="vote-count" data-count-dislike>${escapeHtml(counts.dislikes)}</span>
                        </button>
                        <button class="place-rate-btn ${
                          userRatingState[placeKey]?.isRated ? "rated" : ""
                        }" type="button" data-rate-place-id="${escapeHtml(placeId)}" data-rate-place-name="${escapeHtml(place.place_name || "Place")}" data-rate-place-key="${escapeHtml(placeKey)}">
                          <i class="${userRatingState[placeKey]?.isRated ? "fa-solid" : "fa-regular"} fa-star"></i> Rate
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
    Object.keys(voteCounts).forEach((key) => delete voteCounts[key]);
    Object.keys(userRatingState).forEach((key) => delete userRatingState[key]);
    Object.keys(placeAggregateState).forEach((key) => delete placeAggregateState[key]);
    places.forEach((place) => {
      const placeKey = getPlaceKey(place);
      if (!getPlaceId(place)) {
        console.warn(
          "Missing place id in /api/all/place response for:",
          place?.place_name ?? place,
        );
      }
      const mappedState = voteStateFromVoted(place.voted);
      if (mappedState) {
        voteState[placeKey] = mappedState;
      }
      voteCounts[placeKey] = {
        likes: Math.max(0, toFiniteNumber(place?.num_likes, 0)),
        dislikes: Math.max(0, toFiniteNumber(place?.num_dislikes, 0)),
      };
      placeAggregateState[placeKey] = {
        overall: Math.max(0, getOverallRating(place)),
        total: Math.max(0, toFiniteNumber(place?.total_user_rated, 0)),
      };
      const isRated = place?.is_user_rated === true;
      // all-place response does not always include per-category user rating fields
      const ratings = userRatingState[placeKey]?.ratings || {};
      userRatingState[placeKey] = { isRated, ratings };
    });
  }

  function applyVoteCountDelta(counts, oldState, newState) {
    const next = {
      likes: Math.max(0, toFiniteNumber(counts?.likes, 0)),
      dislikes: Math.max(0, toFiniteNumber(counts?.dislikes, 0)),
    };
    if (oldState === "like") next.likes = Math.max(0, next.likes - 1);
    if (oldState === "dislike") next.dislikes = Math.max(0, next.dislikes - 1);
    if (newState === "like") next.likes += 1;
    if (newState === "dislike") next.dislikes += 1;
    return next;
  }

  function syncVoteCountsInActions(actionWrap, counts) {
    if (!actionWrap) return;
    const likeCount = actionWrap.querySelector("[data-count-like]");
    const dislikeCount = actionWrap.querySelector("[data-count-dislike]");
    if (likeCount) likeCount.textContent = String(toFiniteNumber(counts?.likes, 0));
    if (dislikeCount) dislikeCount.textContent = String(toFiniteNumber(counts?.dislikes, 0));
  }

  async function submitVote(placeId, vote) {
    const token = auth?.getToken?.();
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
      if (response.status === 401 || response.status === 403) {
        auth?.clearSession?.();
      }
      throw new Error(`Vote request failed (${response.status})`);
    }
  }

  async function submitRating(placeId, payload) {
    const token = auth?.getToken?.();
    if (!token) {
      throw new Error("Missing auth token. Please login again.");
    }
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    const endpoint = `${auth?.API_BASE_URL || "http://127.0.0.1:8000"}/api/place/rating/${encodeURIComponent(placeId)}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (response.status === 401 || response.status === 403) {
      auth?.clearSession?.();
      throw new Error("Session expired. Please login again.");
    }
    if (!response.ok) {
      throw new Error(`Rating request failed (${response.status})`);
    }
    return true;
  }

  function collectRatingPayload(rootEl) {
    const missing = [];
    const ratings = {};

    ratingFields.forEach((field) => {
      const selected = rootEl.querySelector(`input[name="rating-${field.key}"]:checked`);
      if (!selected) {
        missing.push(field.label);
        return;
      }
      ratings[field.key] = Number(selected.value);
    });

    return { missing, ratings };
  }

  function prefillRatingForm(rootEl, ratings = {}) {
    if (!rootEl || !ratings || typeof ratings !== "object") return;
    ratingFields.forEach((field) => {
      const val = Number(ratings[field.key]);
      if (!Number.isFinite(val) || val < 1 || val > 5) return;
      const input = rootEl.querySelector(
        `input[name="rating-${field.key}"][value="${val}"]`,
      );
      if (input) input.checked = true;
    });
  }

  function extractUserRatingsFromPayload(payload) {
    if (!payload || typeof payload !== "object") return {};
    const extracted = {};
    ratingFields.forEach((field) => {
      const value = toFiniteNumber(payload?.[field.key], 0);
      if (value >= 1 && value <= 5) {
        extracted[field.key] = value;
      }
    });
    return extracted;
  }

  async function fetchExistingUserRating(placeId) {
    const token = auth?.getToken?.();
    if (!token) return null;

    const headers = { Authorization: `Bearer ${token}` };
    const base = auth?.API_BASE_URL || "http://127.0.0.1:8000";
    const endpoints = [
      `${base}/api/place/rating/${encodeURIComponent(placeId)}`,
      `${base}/api/place/${encodeURIComponent(placeId)}`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, { method: "GET", headers });
        if (!response.ok) continue;
        const payload = await response.json();
        const ratings = extractUserRatingsFromPayload(payload);
        if (Object.keys(ratings).length) return ratings;
      } catch (error) {
        // ignore and try next fallback endpoint
      }
    }
    return null;
  }

  function calcUserRatingAverage(ratings) {
    const values = ratingFields
      .map((field) => toFiniteNumber(ratings?.[field.key], 0))
      .filter((value) => value >= 1 && value <= 5);
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function updateAggregateAfterRating(placeKey, newRatings) {
    if (!placeKey) return;
    const currentAggregate = placeAggregateState[placeKey] || { overall: 0, total: 0 };
    const currentOverall = toFiniteNumber(currentAggregate.overall, 0);
    const currentTotal = Math.max(0, toFiniteNumber(currentAggregate.total, 0));

    const previousRatings = userRatingState[placeKey]?.ratings || null;
    const previousUserAvg = calcUserRatingAverage(previousRatings);
    const newUserAvg = calcUserRatingAverage(newRatings);
    if (!Number.isFinite(newUserAvg)) return;

    let nextTotal = currentTotal;
    let nextOverall = currentOverall;

    if (Number.isFinite(previousUserAvg) && currentTotal > 0) {
      nextOverall = ((currentOverall * currentTotal) - previousUserAvg + newUserAvg) / currentTotal;
    } else if (currentTotal > 0) {
      nextTotal = currentTotal + 1;
      nextOverall = ((currentOverall * currentTotal) + newUserAvg) / nextTotal;
    } else {
      nextTotal = 1;
      nextOverall = newUserAvg;
    }

    placeAggregateState[placeKey] = {
      overall: Math.max(0, Number(nextOverall.toFixed(2))),
      total: Math.max(0, nextTotal),
    };
  }

  function syncRatingSummaryInCard(placeKey) {
    const rateBtn = Array.from(
      placesGrid.querySelectorAll(".place-rate-btn[data-rate-place-key]"),
    ).find((btn) => btn.dataset.ratePlaceKey === placeKey);
    if (!rateBtn) return;

    const card = rateBtn.closest(".place-content");
    if (!card) return;

    const overallEl = card.querySelector("[data-overall-rating]");
    const totalEl = card.querySelector("[data-total-rated]");
    const aggregate = placeAggregateState[placeKey] || { overall: 0, total: 0 };
    const total = Math.max(0, toFiniteNumber(aggregate.total, 0));
    const overall = toFiniteNumber(aggregate.overall, 0);

    if (overallEl) {
      overallEl.textContent = total > 0 ? overall.toFixed(1) : "N/A";
    }
    if (totalEl) {
      totalEl.textContent = `${total} user${total === 1 ? "" : "s"} rated`;
    }
  }

  function setRatingFeedback(message, tone = "error") {
    const feedback = document.getElementById("ratingModalFeedback");
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.remove("is-error", "is-success");
    feedback.classList.add(tone === "success" ? "is-success" : "is-error");
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
    const voteTarget = event.target.closest(".vote-btn");
    if (voteTarget && currentUserId) {
      const placeId = voteTarget.dataset.placeId;
      const placeKey = voteTarget.dataset.placeKey;
      const clickedType = voteTarget.dataset.voteType;
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

      const actionWrap = voteTarget.closest(".place-actions");
      const actionButtons = actionWrap
        ? Array.from(actionWrap.querySelectorAll(".vote-btn"))
        : [voteTarget];

      actionButtons.forEach((btn) => {
        btn.disabled = true;
      });

      try {
        await submitVote(placeId, payloadVote);
        const oldState = currentState;
        voteState[placeKey] = newState;
        voteCounts[placeKey] = applyVoteCountDelta(voteCounts[placeKey], oldState, newState);

        if (actionWrap) {
          actionButtons.forEach((btn) => btn.classList.remove("active"));
          if (newState) {
            const selectedBtn = actionWrap.querySelector(
              `.vote-btn[data-vote-type="${newState}"]`,
            );
            if (selectedBtn) selectedBtn.classList.add("active");
          }
          syncVoteCountsInActions(actionWrap, voteCounts[placeKey]);
        }
      } catch (error) {
        console.error("Vote error:", error);
      } finally {
        actionButtons.forEach((btn) => {
          btn.disabled = false;
        });
      }
      return;
    }

    const rateToggle = event.target.closest(".place-rate-btn[data-rate-place-id]");
    if (rateToggle && currentUserId) {
      const placeId = rateToggle.dataset.ratePlaceId;
      const placeKey = rateToggle.dataset.ratePlaceKey;
      if (!placeId || placeId === "null" || placeId === "undefined") return;
      openRatingModalWithState(
        placeId,
        rateToggle.dataset.ratePlaceName || "Place",
        placeKey || null,
      );
      if (placeKey && userRatingState[placeKey]?.isRated && !Object.keys(userRatingState[placeKey]?.ratings || {}).length) {
        const fetched = await fetchExistingUserRating(placeId);
        if (fetched && Object.keys(fetched).length) {
          userRatingState[placeKey].ratings = fetched;
          prefillRatingForm(ratingModalForm, fetched);
        }
      }
      return;
    }

    if (!currentUserId) return;
    if (event.target.closest(".place-actions")) return;

    const card = event.target.closest(".place-card-clickable[data-place-id]");
    if (!card) return;

    const placeId = card.dataset.placeId;
    if (!placeId) return;
    window.location.href = `place_details.html?id=${encodeURIComponent(placeId)}`;
  });

  ratingModalForm?.addEventListener("submit", async (event) => {
    if (!currentUserId) return;
    event.preventDefault();

    const placeId = activeRatingPlaceId;
    if (!placeId || placeId === "null" || placeId === "undefined") {
      setRatingFeedback("Invalid place id. Unable to submit rating.");
      return;
    }
    const { missing, ratings } = collectRatingPayload(ratingModalForm);
    if (missing.length) {
      setRatingFeedback("Rate all required categories before submitting.");
      return;
    }

    const submitBtn = ratingModalForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    setRatingFeedback("");

    try {
      await submitRating(placeId, ratings);
      setRatingFeedback("Rating submitted successfully.", "success");
      if (activeRatingPlaceKey) {
        updateAggregateAfterRating(activeRatingPlaceKey, ratings);
        userRatingState[activeRatingPlaceKey] = { isRated: true, ratings: { ...ratings } };
        const rateBtn = Array.from(
          placesGrid.querySelectorAll(".place-rate-btn[data-rate-place-key]"),
        ).find((btn) => btn.dataset.ratePlaceKey === activeRatingPlaceKey);
        if (rateBtn) {
          rateBtn.classList.add("rated");
          const rateIcon = rateBtn.querySelector("i.fa-star");
          if (rateIcon) {
            rateIcon.classList.remove("fa-regular");
            rateIcon.classList.add("fa-solid");
          }
        }
        syncRatingSummaryInCard(activeRatingPlaceKey);
      }
      ratingModalForm.reset();
      setTimeout(() => ratingModal?.hide(), 400);
    } catch (error) {
      console.error("Rating submit error:", error);
      setRatingFeedback(error?.message || "Could not submit rating. Please try again.");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  placesGrid.addEventListener("keydown", (event) => {
    if (!currentUserId) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    const card = event.target.closest(".place-card-clickable[data-place-id]");
    if (!card) return;

    event.preventDefault();
    const placeId = card.dataset.placeId;
    if (placeId) {
      window.location.href = `place_details.html?id=${encodeURIComponent(placeId)}`;
    }
  });

  await initAuth();
  fetchPlaces();
});
