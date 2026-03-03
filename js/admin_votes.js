document.addEventListener("DOMContentLoaded", async () => {
  const auth = window.AuthManager;
  const loadingState = document.getElementById("loadingState");
  const errorState = document.getElementById("errorState");
  const errorText = document.getElementById("errorText");
  const dataState = document.getElementById("dataState");
  const emptyState = document.getElementById("emptyState");
  const votesWrap = document.getElementById("votesWrap");
  const votesList = document.getElementById("votesList");
  const voteCount = document.getElementById("voteCount");

  function getRole(user) {
    return String(user?.role || "").trim().toLowerCase();
  }

  function serializeValue(value) {
    if (value === null || value === undefined) return "-";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  function formatDateTime(value) {
    const text = serializeValue(value);
    if (text === "-") return "-";
    const dt = new Date(text);
    if (Number.isNaN(dt.getTime())) return text;
    return dt.toLocaleString();
  }

  function formatVoteValue(value) {
    if (value === true) return "Like";
    if (value === false) return "Dislike";
    return "None";
  }

  function getVoteFieldLabel(key) {
    const labels = {
      vote: "Vote",
      user_id: "User ID",
      place_id: "Place ID",
      voted_at: "Voted At",
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
    if (Array.isArray(payload?.votes)) return payload.votes;
    if (payload && typeof payload === "object" && "vote" in payload) return [payload];
    return [];
  }

  function sortVotesByIdAsc(votes) {
    return [...votes].sort((a, b) => Number(a?.id ?? 0) - Number(b?.id ?? 0));
  }

  async function fetchVotes() {
    const response = await fetch(`${auth.API_BASE_URL}/api/admin/votes`, {
      headers: auth.getAuthHeaders(),
    });
    if (!response.ok) throw new Error(`Failed to fetch votes (${response.status})`);
    const payload = await response.json();
    return extractArray(payload);
  }

  function renderVoteCards(records) {
    if (voteCount) voteCount.textContent = String(records.length);

    if (!records.length) {
      emptyState.classList.remove("d-none");
      votesWrap.classList.add("d-none");
      return;
    }

    emptyState.classList.add("d-none");
    votesWrap.classList.remove("d-none");

    const orderedKeys = ["vote", "user_id", "place_id", "voted_at"];

    votesList.innerHTML = records
      .map((record) => {
        const idDisplay = serializeValue(record?.id);
        const keySet = new Set(Object.keys(record || {}).filter((key) => key !== "id"));
        const detailKeys = [
          ...orderedKeys.filter((key) => keySet.has(key)),
          ...[...keySet].filter((key) => !orderedKeys.includes(key)),
        ];
        const detailBlocks = detailKeys
          .map((key) => {
            let value = record?.[key];
            if (key === "vote") value = formatVoteValue(value);
            else if (key === "voted_at") value = formatDateTime(value);
            else value = serializeValue(value);

            return `
              <div class="admin-place-field">
                <div class="admin-place-label">${escapeHtml(getVoteFieldLabel(key))}:</div>
                <div class="admin-place-value">${escapeHtml(value)}</div>
              </div>
            `;
          })
          .join("");

        return `
          <article class="admin-place-card">
            <div class="admin-place-id"><strong>id:</strong> ${escapeHtml(idDisplay)}</div>
            <div class="admin-place-details">
              <div class="admin-place-title"><strong>Vote Details:</strong></div>
              ${detailBlocks}
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function loadAndRenderVotes() {
    try {
      const votes = await fetchVotes();
      const normalized = sortVotesByIdAsc(votes);
      loadingState.classList.add("d-none");
      errorState.classList.add("d-none");
      dataState.classList.remove("d-none");
      renderVoteCards(normalized);
    } catch (error) {
      loadingState.classList.add("d-none");
      dataState.classList.add("d-none");
      errorState.classList.remove("d-none");
      errorText.textContent = error.message;
    }
  }

  const allowed = await auth?.requireAuth?.({
    redirectTo: "login.html?next=admin_votes.html",
    verifyWithServer: true,
  });
  if (!allowed) return;

  const sessionUser = await auth.verifySession();
  if (getRole(sessionUser) !== "admin") {
    window.location.replace("admin.html");
    return;
  }

  await loadAndRenderVotes();
});
