document.addEventListener("DOMContentLoaded", async () => {
  const auth = window.AuthManager;
  const loadingState = document.getElementById("loadingState");
  const errorState = document.getElementById("errorState");
  const errorText = document.getElementById("errorText");
  const emptyState = document.getElementById("emptyState");
  const dataState = document.getElementById("dataState");
  const pageTitle = document.getElementById("pageTitle");
  const pageDescription = document.getElementById("pageDescription");
  const tableHeadRow = document.getElementById("tableHeadRow");
  const tableBody = document.getElementById("tableBody");

  const config = {
    places: {
      title: "Places",
      description: "All place records available in the database.",
      endpoints: ["/api/all/place", "/api/place"],
      allowedRoles: ["staff", "admin"],
    },
    users: {
      title: "Users",
      description: "All user records available in the database.",
      endpoints: ["/api/all/user", "/api/users", "/api/user"],
      allowedRoles: ["admin"],
    },
    votes: {
      title: "Votes",
      description: "All vote records available in the database.",
      endpoints: ["/api/all/vote", "/api/votes", "/api/vote"],
      allowedRoles: ["admin"],
    },
  };

  function getRole(user) {
    return String(user?.role || "").trim().toLowerCase();
  }

  function serializeValue(value) {
    if (value === null || value === undefined) return "-";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  function extractArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.results)) return payload.results;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.places)) return payload.places;
    if (Array.isArray(payload?.users)) return payload.users;
    if (Array.isArray(payload?.votes)) return payload.votes;
    return [];
  }

  async function requestRecords(endpoints) {
    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${auth.API_BASE_URL}${endpoint}`, {
          headers: auth.getAuthHeaders(),
        });
        if (!response.ok) {
          lastError = new Error(`${response.status} from ${endpoint}`);
          continue;
        }
        const payload = await response.json();
        return extractArray(payload);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("Unable to fetch records");
  }

  function renderTable(records) {
    const preferredKeys = [
      "id",
      "user_id",
      "email",
      "role",
      "place_name",
      "place_address",
      "vote",
      "created_at",
      "updated_at",
    ];

    const keySet = new Set();
    records.forEach((record) => {
      Object.keys(record || {}).forEach((key) => keySet.add(key));
    });

    const keys = [
      ...preferredKeys.filter((key) => keySet.has(key)),
      ...[...keySet].filter((key) => !preferredKeys.includes(key)),
    ].slice(0, 10);

    tableHeadRow.innerHTML = keys
      .map((key) => `<th scope="col">${key}</th>`)
      .join("");

    tableBody.innerHTML = records
      .map((record) => {
        const cells = keys
          .map((key) => `<td>${serializeValue(record?.[key])}</td>`)
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");
  }

  const resource = new URLSearchParams(window.location.search)
    .get("resource")
    ?.trim()
    .toLowerCase();
  const resourceConfig = config[resource];

  if (!resourceConfig) {
    loadingState.classList.add("d-none");
    errorState.classList.remove("d-none");
    errorText.textContent = "Invalid resource requested.";
    return;
  }

  pageTitle.textContent = resourceConfig.title;
  pageDescription.textContent = resourceConfig.description;

  const allowed = await auth?.requireAuth?.({
    redirectTo: `login.html?next=${encodeURIComponent(`admin_data.html?resource=${resource}`)}`,
    verifyWithServer: true,
  });
  if (!allowed) return;

  const user = await auth.verifySession();
  const role = getRole(user);
  if (!resourceConfig.allowedRoles.includes(role)) {
    loadingState.classList.add("d-none");
    errorState.classList.remove("d-none");
    errorText.textContent = "You do not have access to this resource.";
    return;
  }

  try {
    const records = await requestRecords(resourceConfig.endpoints);

    loadingState.classList.add("d-none");
    if (!records.length) {
      emptyState.classList.remove("d-none");
      return;
    }

    renderTable(records);
    dataState.classList.remove("d-none");
  } catch (error) {
    console.error("Admin data fetch failed:", error);
    loadingState.classList.add("d-none");
    errorState.classList.remove("d-none");
    errorText.textContent = `API request failed: ${error.message}`;
  }
});
