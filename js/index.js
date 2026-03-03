document.addEventListener("DOMContentLoaded", async () => {
  const userProfileBtn = document.getElementById("userProfile");
  const ctaButton = document.getElementById("ctaButton");
  const auth = window.AuthManager;

  async function initAuth() {
    if (!auth?.hasValidSession()) {
      updateUI(null);
      return null;
    }

    const userData = await auth.verifySession();
    updateUI(userData);
    return userData;
  }

  function updateUI(user) {
    if (user) {
      if (userProfileBtn) userProfileBtn.classList.remove("d-none");
      if (ctaButton) {
        ctaButton.innerText = "View Your Profile";
        ctaButton.href = "settings.html";
      }
    } else {
      if (userProfileBtn) userProfileBtn.classList.add("d-none");
      if (ctaButton) {
        ctaButton.innerText = "Get Started";
        ctaButton.href = "login.html";
      }
    }
  }

  await initAuth();
});
