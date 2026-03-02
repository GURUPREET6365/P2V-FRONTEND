document.addEventListener("DOMContentLoaded", () => {
  const navRoot = document.getElementById("appNav");
  const footerRoot = document.getElementById("appFooter");
  const page = document.body.dataset.page || "";

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
                <a class="nav-link ${page === "about" ? "active" : ""}" href="index.html#about">About</a>
              </li>
            </ul>

            <a href="settings.html" class="profile-icon d-none" id="userProfile">
              <i class="fa-regular fa-user"></i>
            </a>
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
                <li><a href="#">Help Center</a></li>
                <li><a href="#">Privacy</a></li>
                <li><a href="#">Terms</a></li>
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
              <a href="#" class="fa-brands fa-twitter" aria-label="Twitter"></a>
              <a href="#" class="fa-brands fa-linkedin" aria-label="LinkedIn"></a>
            </div>
          </div>
        </div>
      </footer>
    `;
  }
});
