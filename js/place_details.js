document.addEventListener("DOMContentLoaded", async () => {
  const auth = window.AuthManager;
  const loadingState = document.getElementById("loadingState");
  const detailsState = document.getElementById("detailsState");
  const errorState = document.getElementById("errorState");
  const errorMessage = document.getElementById("errorMessage");
  const placeNameEl = document.getElementById("placeName");
  const placeNotesEl = document.getElementById("placeNotes");
  const likeBtn = document.getElementById("likeBtn");
  const dislikeBtn = document.getElementById("dislikeBtn");
  let currentVote = null;

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
      normalized === "voted"
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

  function nextVoteState(current, clickedType) {
    if (current === clickedType) return null;
    return clickedType;
  }

  function syncVoteButtons() {
    if (!likeBtn || !dislikeBtn) return;
    likeBtn.classList.remove("active");
    dislikeBtn.classList.remove("active");

    if (currentVote === "like") likeBtn.classList.add("active");
    if (currentVote === "dislike") dislikeBtn.classList.add("active");
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
        currentVote = nextState;
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

  function renderPlaceDetails(place) {
    placeNameEl.textContent = place.place_name || place.name || "Untitled Place";
    currentVote = voteStateFromVoted(place.voted);
    syncVoteButtons();

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

    loadingState.classList.add("d-none");
    detailsState.classList.remove("d-none");
  } catch (error) {
    console.error("Place details fetch error:", error);
    showError("Could not fetch place details from server.");
  }
});
