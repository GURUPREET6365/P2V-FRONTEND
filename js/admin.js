document.addEventListener("DOMContentLoaded", async () => {
  const auth = window.AuthManager;
  const loadingState = document.getElementById("loadingState");
  const adminState = document.getElementById("adminState");
  const errorState = document.getElementById("errorState");
  const roleDisplay = document.getElementById("roleDisplay");
  const adminModelBody = document.getElementById("adminModelBody");

  function titleCase(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function getRole(user) {
    return String(user?.role || "").trim().toLowerCase();
  }

  function renderModelRows(role) {
    const commonRows = [
      {
        app: "Travel",
        model: "Places",
        desc: "Manage all places",
        href: "admin_places.html",
      },
    ];

    const adminOnlyRows = [
      {
        app: "Accounts",
        model: "Users",
        desc: "Manage all users",
        href: "admin_users.html",
      },
      {
        app: "Engagement",
        model: "Votes",
        desc: "Manage votes",
        href: "admin_votes.html",
      },
      {
        app: "Engagement",
        model: "Ratings",
        desc: "Manage ratings",
        href: "admin_ratings.html",
      },
    ];

    const rows = role === "admin" ? [...commonRows, ...adminOnlyRows] : commonRows;

    adminModelBody.innerHTML = rows
      .map(
        (row) => `
          <tr>
            <td>${row.app}</td>
            <td>
              <div class="fw-semibold">${row.model}</div>
              <div class="small settings-muted">${row.desc}</div>
            </td>
            <td>
              <a href="${row.href}" class="cta-primary admin-link-btn">Open</a>
            </td>
          </tr>
        `,
      )
      .join("");
  }

  const allowed = await auth?.requireAuth?.({
    redirectTo: "login.html?next=admin.html",
    verifyWithServer: true,
  });
  if (!allowed) return;

  const user = await auth.verifySession();
  const role = getRole(user);
  const isPrivileged = role === "staff" || role === "admin";

  if (!isPrivileged) {
    loadingState.classList.add("d-none");
    errorState.classList.remove("d-none");
    setTimeout(() => {
      window.location.replace("settings.html");
    }, 900);
    return;
  }

  roleDisplay.textContent = titleCase(role);
  renderModelRows(role);
  loadingState.classList.add("d-none");
  adminState.classList.remove("d-none");
});
