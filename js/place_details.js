document.addEventListener("DOMContentLoaded", async () => {
  const auth = window.AuthManager;
  const loadingState = document.getElementById("loadingState");
  const detailsState = document.getElementById("detailsState");
  const errorState = document.getElementById("errorState");
  const errorMessage = document.getElementById("errorMessage");
  const placeNameEl = document.getElementById("placeName");
  const placeNotesEl = document.getElementById("placeNotes");
  const categoryRatingsEl = document.getElementById("categoryRatings");
  const likeBtn = document.getElementById("likeBtn");
  const dislikeBtn = document.getElementById("dislikeBtn");
  const rateBtn = document.getElementById("rateBtn");
  const ratingModalEl = document.getElementById("ratingModal");
  const ratingModalForm = document.getElementById("ratingModalForm");
  const ratingModalBody = document.getElementById("ratingModalBody");
  const ratingModalLabel = document.getElementById("ratingModalLabel");
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
  let currentVote = null;
  let voteCounts = { likes: 0, dislikes: 0 };
  let detailUserRatingState = { isRated: false, ratings: {} };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showError(message) {
    loadingState.classList.add("d-none");
    detailsState.classList.add("d-none");
    errorState.classList.remove("d-none");
    errorMessage.textContent = message;
  }

  function toFiniteNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function formatDate(value) {
    if (!value) return "-";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return String(value);
    return dt.toLocaleString();
  }

  function flattenEntries(value, path = "", rows = []) {
    if (value === null || value === undefined) {
      rows.push([path || "(root)", "null"]);
      return rows;
    }

    if (Array.isArray(value)) {
      if (!value.length) {
        rows.push([path, "[]"]);
        return rows;
      }
      value.forEach((item, index) => {
        flattenEntries(item, `${path}[${index}]`, rows);
      });
      return rows;
    }

    if (typeof value === "object") {
      const entries = Object.entries(value);
      if (!entries.length) {
        rows.push([path || "(root)", "{}"]);
        return rows;
      }
      entries.forEach(([key, nested]) => {
        const nextPath = path ? `${path}.${key}` : key;
        flattenEntries(nested, nextPath, rows);
      });
      return rows;
    }

    rows.push([path, String(value)]);
    return rows;
  }

  function formatFieldLabel(path) {
    return path
      .replace(/\[(\d+)\]/g, " $1 ")
      .replace(/[._]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }

  function shouldSkipField(path) {
    if (!path) return false;

    const lastSegment = path.split(".").pop() || path;
    const normalized = lastSegment
      .replace(/\[\d+\]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();

    return (
      normalized === "id" ||
      normalized === "placeid" ||
      normalized === "pk" ||
      normalized === "voted" ||
      normalized === "numlikes" ||
      normalized === "numdislikes" ||
      normalized === "isuserrated" ||
      normalized === "overallratingsallcategories" ||
      normalized === "totaluserrated" ||
      normalized === "overall" ||
      normalized === "cleanliness" ||
      normalized === "safety" ||
      normalized === "crowdbehavior" ||
      normalized === "lightning" ||
      normalized === "transportaccess" ||
      normalized === "facilityquality"
    );
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

  function votePayloadFromState(state) {
    if (state === "like") return true;
    if (state === "dislike") return false;
    return null;
  }

  function buildStarGroup(field) {
    const groupName = `rating-${field.key}`;
    const stars = [5, 4, 3, 2, 1]
      .map((score) => {
        const id = `${groupName}-${score}`;
        return `
          <input class="rating-star-input" type="radio" name="${escapeHtml(groupName)}" id="${escapeHtml(id)}" value="${score}" ${
            score === 1 ? "required" : ""
          } />
          <label class="rating-star-label" for="${escapeHtml(id)}" title="${score} star${score > 1 ? "s" : ""}">
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
    ratingModalForm.reset();
    setRatingFeedback("", "error");
    ratingModalLabel.textContent = `Rate: ${placeName || "Place"}`;
    renderModalRatingFields();
    prefillRatingForm(ratingModalForm, detailUserRatingState.ratings);
    ratingModal.show();
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
      const val = toFiniteNumber(ratings[field.key], 0);
      if (val < 1 || val > 5) return;
      const input = rootEl.querySelector(`input[name="rating-${field.key}"][value="${val}"]`);
      if (input) input.checked = true;
    });
  }

  function extractRatingsFromPlace(place) {
    const ratings = {};
    ratingFields.forEach((field) => {
      const value = toFiniteNumber(place?.[field.key], 0);
      if (value >= 1 && value <= 5) ratings[field.key] = value;
    });
    return ratings;
  }

  function syncRateButtonAppearance() {
    if (!rateBtn) return;
    rateBtn.classList.toggle("rated", detailUserRatingState.isRated === true);
    const icon = rateBtn.querySelector("i.fa-star");
    if (!icon) return;
    icon.classList.toggle("fa-solid", detailUserRatingState.isRated === true);
    icon.classList.toggle("fa-regular", detailUserRatingState.isRated !== true);
  }

  function renderCategoryRatings(ratings = {}) {
    if (!categoryRatingsEl) return;
    categoryRatingsEl.innerHTML = ratingFields
      .map((field) => {
        const value = toFiniteNumber(ratings[field.key], 0);
        const isValid = value >= 1 && value <= 5;
        const stars = isValid
          ? `<span class="category-rating-stars">${"★".repeat(value)}${"☆".repeat(5 - value)}</span> (${value}/5)`
          : "Not rated";
        return `
          <article class="category-rating-item">
            <span class="category-rating-label">${escapeHtml(field.label)}</span>
            <span class="category-rating-value">${stars}</span>
          </article>
        `;
      })
      .join("");
  }

  function setRatingFeedback(message, tone = "error") {
    const feedback = document.getElementById("ratingModalFeedback");
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.remove("is-error", "is-success");
    feedback.classList.add(tone === "success" ? "is-success" : "is-error");
  }

  async function submitRating(placeId, payload) {
    const token = auth?.getToken?.();
    if (!token) {
      throw new Error("Missing auth token. Please login again.");
    }
    const endpoint = `${auth.API_BASE_URL}/api/place/rating/${encodeURIComponent(placeId)}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (response.status === 401 || response.status === 403) {
      auth.clearSession();
      const nextTarget = `place_details.html?id=${encodeURIComponent(placeId)}`;
      window.location.replace(`login.html?next=${encodeURIComponent(nextTarget)}`);
      return false;
    }
    if (!response.ok) {
      throw new Error(`Rating request failed (${response.status})`);
    }
    return true;
  }

  function nextVoteState(current, clickedType) {
    if (current === clickedType) return null;
    return clickedType;
  }

  function syncVoteButtons() {
    if (!likeBtn || !dislikeBtn) return;
    likeBtn.classList.remove("active");
    dislikeBtn.classList.remove("active");

    likeBtn.innerHTML = `<i class="fa-regular fa-thumbs-up"></i> Like <span class="vote-count">${voteCounts.likes}</span>`;
    dislikeBtn.innerHTML = `<i class="fa-regular fa-thumbs-down"></i> Dislike <span class="vote-count">${voteCounts.dislikes}</span>`;

    if (currentVote === "like") likeBtn.classList.add("active");
    if (currentVote === "dislike") dislikeBtn.classList.add("active");
  }

  function applyVoteCountDelta(counts, oldState, newState) {
    const next = {
      likes: Math.max(0, Number(counts?.likes) || 0),
      dislikes: Math.max(0, Number(counts?.dislikes) || 0),
    };
    if (oldState === "like") next.likes = Math.max(0, next.likes - 1);
    if (oldState === "dislike") next.dislikes = Math.max(0, next.dislikes - 1);
    if (newState === "like") next.likes += 1;
    if (newState === "dislike") next.dislikes += 1;
    return next;
  }

  async function submitVote(placeId, vote) {
    const response = await fetch(
      `${auth.API_BASE_URL}/api/vote/${encodeURIComponent(placeId)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...auth.getAuthHeaders(),
        },
        body: JSON.stringify({ vote }),
      },
    );

    if (response.status === 401 || response.status === 403) {
      auth.clearSession();
      const nextTarget = `place_details.html?id=${encodeURIComponent(placeId)}`;
      window.location.replace(`login.html?next=${encodeURIComponent(nextTarget)}`);
      return false;
    }

    if (!response.ok) {
      throw new Error(`Vote request failed (${response.status})`);
    }

    return true;
  }

  function bindVoteHandlers(placeId) {
    if (!likeBtn || !dislikeBtn) return;

    const buttons = [likeBtn, dislikeBtn];
    const onVoteClick = async (clickedType) => {
      const nextState = nextVoteState(currentVote, clickedType);
      const payloadVote = votePayloadFromState(nextState);

      buttons.forEach((btn) => {
        btn.disabled = true;
      });

      try {
        const ok = await submitVote(placeId, payloadVote);
        if (!ok) return;
        const oldState = currentVote;
        currentVote = nextState;
        voteCounts = applyVoteCountDelta(voteCounts, oldState, nextState);
        syncVoteButtons();
      } catch (error) {
        console.error("Vote request failed:", error);
      } finally {
        buttons.forEach((btn) => {
          btn.disabled = false;
        });
      }
    };

    likeBtn.addEventListener("click", () => onVoteClick("like"));
    dislikeBtn.addEventListener("click", () => onVoteClick("dislike"));
  }

  function bindRatingHandlers(placeId) {
    if (!rateBtn || !ratingModalForm) return;

    rateBtn.addEventListener("click", () => {
      openRatingModal(placeId, placeNameEl?.textContent || "Place");
    });

    ratingModalForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!activeRatingPlaceId) {
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
        const ok = await submitRating(activeRatingPlaceId, ratings);
        if (!ok) return;
        detailUserRatingState = { isRated: true, ratings: { ...ratings } };
        syncRateButtonAppearance();
        renderCategoryRatings(detailUserRatingState.ratings);
        setRatingFeedback("Rating submitted successfully.", "success");
        ratingModalForm.reset();
        setTimeout(() => ratingModal?.hide(), 400);
      } catch (error) {
        console.error("Rating request failed:", error);
        setRatingFeedback(error?.message || "Could not submit rating. Please try again.");
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  function renderPlaceDetails(place) {
    placeNameEl.textContent = place.place_name || place.name || "Untitled Place";
    currentVote = voteStateFromVoted(place.voted);
    voteCounts = {
      likes: Math.max(0, Number(place?.num_likes) || 0),
      dislikes: Math.max(0, Number(place?.num_dislikes) || 0),
    };
    detailUserRatingState = {
      isRated: place?.is_user_rated === true,
      ratings: extractRatingsFromPlace(place),
    };
    syncVoteButtons();
    syncRateButtonAppearance();
    renderCategoryRatings(detailUserRatingState.ratings);

    const rows = flattenEntries(place).filter(([field]) => !shouldSkipField(field));
    placeNotesEl.innerHTML = rows
      .map(
        ([field, val]) => `
          <article class="note-item">
            <span class="note-label">${escapeHtml(formatFieldLabel(field))}:</span>
            <span class="note-value">${escapeHtml(
              /_at$/i.test(field) ? formatDate(val) : val,
            )}</span>
          </article>
        `,
      )
      .join("");

    if (!rows.length) {
      placeNotesEl.innerHTML = `
        <article class="note-item">
          <span class="note-value">No readable fields were returned by the API.</span>
        </article>
      `;
    }
  }

  const placeId = new URLSearchParams(window.location.search).get("id");
  if (!auth) {
    showError("Authentication layer not loaded. Please refresh the page.");
    return;
  }

  if (!placeId) {
    showError("Missing place id. Open this page from the Places list.");
    return;
  }

  const nextTarget = `place_details.html?id=${encodeURIComponent(placeId)}`;
  const isAllowed = await auth?.requireAuth?.({
    redirectTo: `login.html?next=${encodeURIComponent(nextTarget)}`,
    verifyWithServer: true,
  });
  if (!isAllowed) return;

  try {
    const response = await fetch(
      `${auth.API_BASE_URL}/api/place/${encodeURIComponent(placeId)}`,
      {
        method: "GET",
        headers: auth.getAuthHeaders(),
      },
    );

    if (response.status === 401 || response.status === 403) {
      auth.clearSession();
      window.location.replace(`login.html?next=${encodeURIComponent(nextTarget)}`);
      return;
    }

    if (!response.ok) {
      throw new Error(`API request failed (${response.status})`);
    }

    const place = await response.json();
    renderPlaceDetails(place);
    bindVoteHandlers(placeId);
    bindRatingHandlers(placeId);

    loadingState.classList.add("d-none");
    detailsState.classList.remove("d-none");
  } catch (error) {
    console.error("Place details fetch error:", error);
    showError("Could not fetch place details from server.");
  }
});
