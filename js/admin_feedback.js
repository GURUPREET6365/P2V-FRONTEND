document.addEventListener("DOMContentLoaded", async () => {
  const auth = window.AuthManager;
  const loadingState = document.getElementById("loadingState");
  const errorState = document.getElementById("errorState");
  const errorText = document.getElementById("errorText");
  const dataState = document.getElementById("dataState");
  const emptyState = document.getElementById("emptyState");
  const feedbackWrap = document.getElementById("feedbackWrap");
  const feedbackList = document.getElementById("feedbackList");
  const feedbackCount = document.getElementById("feedbackCount");

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

  function formatBool(value) {
    if (value === true) return "Yes";
    if (value === false) return "No";
    return "No";
  }

  function getFeedbackFieldLabel(key) {
    const labels = {
      name: "Name",
      email: "Email",
      found_place: "Found Place",
      message: "Message",
      created_at: "Created At",
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
    if (Array.isArray(payload?.feedback)) return payload.feedback;
    if (payload && typeof payload === "object" && "message" in payload) return [payload];
    return [];
  }

  async function fetchFeedback() {
    const response = await fetch(`${auth.API_BASE_URL}/api/admin/feedback`, {
      headers: auth.getAuthHeaders(),
    });
    if (!response.ok) throw new Error(`Failed to fetch feedback (${response.status})`);
    const payload = await response.json();
    return extractArray(payload);
  }

  function renderFeedbackCards(records) {
    if (feedbackCount) feedbackCount.textContent = String(records.length);

    if (!records.length) {
      emptyState.classList.remove("d-none");
      feedbackWrap.classList.add("d-none");
      return;
    }

    emptyState.classList.add("d-none");
    feedbackWrap.classList.remove("d-none");

    const orderedKeys = ["name", "email", "found_place", "message", "created_at"];

    feedbackList.innerHTML = records
      .map((record, rowIndex) => {
        const idDisplay = serializeValue(record?.id ?? rowIndex + 1);
        const keySet = new Set(Object.keys(record || {}).filter((key) => key !== "id"));
        const detailKeys = [
          ...orderedKeys.filter((key) => keySet.has(key)),
          ...[...keySet].filter((key) => !orderedKeys.includes(key)),
        ];
        const detailBlocks = detailKeys
          .map((key) => {
            let value = record?.[key];
            if (key === "found_place") value = formatBool(value);
            else if (/_at$/i.test(key)) value = formatDateTime(value);
            else value = serializeValue(value);

            return `
              <div class="admin-place-field">
                <div class="admin-place-label">${escapeHtml(getFeedbackFieldLabel(key))}:</div>
                <div class="admin-place-value">${escapeHtml(value)}</div>
              </div>
            `;
          })
          .join("");

        return `
          <article class="admin-place-card">
            <div class="admin-place-id"><strong>id:</strong> ${escapeHtml(idDisplay)}</div>
            <div class="admin-place-details">
              <div class="admin-place-title"><strong>Feedback Details:</strong></div>
              ${detailBlocks}
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function loadAndRenderFeedback() {
    try {
      const records = await fetchFeedback();
      loadingState.classList.add("d-none");
      errorState.classList.add("d-none");
      dataState.classList.remove("d-none");
      renderFeedbackCards(records);
    } catch (error) {
      loadingState.classList.add("d-none");
      dataState.classList.add("d-none");
      errorState.classList.remove("d-none");
      errorText.textContent = error.message;
    }
  }

  const allowed = await auth?.requireAuth?.({
    redirectTo: "login.html?next=admin_feedback.html",
    verifyWithServer: true,
  });
  if (!allowed) return;

  const sessionUser = await auth.verifySession();
  const role = getRole(sessionUser);
  if (role !== "staff" && role !== "admin") {
    window.location.replace("admin.html");
    return;
  }

  await loadAndRenderFeedback();
});
