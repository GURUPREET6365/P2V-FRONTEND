document.addEventListener("DOMContentLoaded", () => {
  const navRoot = document.getElementById("appNav");
  const footerRoot = document.getElementById("appFooter");
  const page = document.body.dataset.page || "";
  const currentFile = (window.location.pathname.split("/").pop() || "").toLowerCase();
  const isAdminRoute = currentFile.startsWith("admin");

  if (navRoot) {
    navRoot.innerHTML = `
      <nav class="navbar navbar-expand-lg navbar-pro sticky-top">
        <div class="container">
          <a class="navbar-brand brand" href="index.html">P2V</a>

          <button
            class="navbar-toggler border-0 nav-toggle"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#mainNav"
            aria-controls="mainNav"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <i class="fa-solid fa-bars"></i>
          </button>

          <div class="collapse navbar-collapse nav-panel" id="mainNav">
            <ul class="navbar-nav nav-pro ms-auto">
              <li class="nav-item">
                <a class="nav-link ${page === "home" ? "active" : ""}" href="index.html">Home</a>
              </li>
              <li class="nav-item">
                <a class="nav-link ${page === "places" ? "active" : ""}" href="places.html">Places</a>
              </li>
              <li class="nav-item">
                <a class="nav-link ${page === "about" ? "active" : ""}" href="about.html">About</a>
              </li>
            </ul>

            <div class="nav-auth-wrap">
              <a href="login.html" class="cta-primary nav-login-btn d-none" id="navLoginBtn">
                Login
              </a>
              <a href="settings.html" class="profile-icon d-none" id="userProfile">
                <i class="fa-regular fa-user"></i>
              </a>
            </div>
          </div>
        </div>
      </nav>
    `;
  }

  if (footerRoot) {
    footerRoot.innerHTML = `
      <footer class="footer-pro">
        <div class="container">
          <div class="row g-4">
            <div class="col-md-4">
              <h6>P2V</h6>
              <p>
                A clean travel platform where curated places are shared with
                practical details and less noise.
              </p>
            </div>

            <div class="col-6 col-md-2">
              <h6>Explore</h6>
              <ul>
                <li><a href="index.html">Home</a></li>
                <li><a href="places.html">Places</a></li>
                <li><a href="settings.html">Settings</a></li>
              </ul>
            </div>

            <div class="col-6 col-md-2">
              <h6>Support</h6>
              <ul>
                <li><a href="about.html">About Us</a></li>
                <li><a href="about.html#privacy-policy">Privacy</a></li>
                <li><a href="about.html#terms-and-conditions">Terms</a></li>
                ${isAdminRoute ? "" : '<li><a href="about.html#feedback">Feedback</a></li>'}
              </ul>
            </div>

            <div class="col-md-4">
              <h6>Why P2V</h6>
              <p class="small-muted mb-2">Curated places, faster decisions.</p>
              <p class="small-muted mb-0">
                Updated weekly with practical location insights.
              </p>
            </div>
          </div>

          <hr />

          <div class="footer-bottom">
            <span>© 2026 P2V</span>
            <div class="socials">
              <a
                href="https://github.com/GURUPREET6365"
                target="_blank"
                rel="noopener noreferrer"
                class="fa-brands fa-github"
                aria-label="GitHub"
              ></a>
              <a href="https://www.youtube.com/@TheHacker-x3u" target="_blank" class="fa-brands fa-youtube" aria-label="YouTube"></a>
              <a href="https://www.linkedin.com/in/gurupreet-kumar-467ab4375/" target="_blank" class="fa-brands fa-linkedin" aria-label="LinkedIn"></a>
            </div>
          </div>
        </div>
      </footer>
    `;
  }

  if (!isAdminRoute) {
    const feedbackGateway = document.createElement("a");
    feedbackGateway.href = "about.html#feedback";
    feedbackGateway.className = "feedback-gateway";
    feedbackGateway.setAttribute("aria-label", "Open feedback form");
    feedbackGateway.innerHTML = '<i class="fa-regular fa-message"></i> Feedback';
    document.body.appendChild(feedbackGateway);
  }

  async function syncNavbarAuthState() {
    const loginBtn = document.getElementById("navLoginBtn");
    const profileBtn = document.getElementById("userProfile");
    if (!loginBtn || !profileBtn) return;

    const auth = window.AuthManager;
    if (!auth?.hasValidSession()) {
      loginBtn.classList.remove("d-none");
      profileBtn.classList.add("d-none");
      return;
    }

    const user = await auth.verifySession();
    if (!user) {
      loginBtn.classList.remove("d-none");
      profileBtn.classList.add("d-none");
      return;
    }

    loginBtn.classList.add("d-none");
    profileBtn.classList.remove("d-none");
  }

  syncNavbarAuthState();
  window.addEventListener("p2v:auth-changed", syncNavbarAuthState);
});
