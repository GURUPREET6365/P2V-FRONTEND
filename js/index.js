document.addEventListener("DOMContentLoaded", async () => {
  const userProfileBtn = document.getElementById("userProfile");
  const ctaButton = document.getElementById("ctaButton");

  async function initAuth() {
    const token = localStorage.getItem("p2v_token");
    if (!token) {
      updateUI(null);
      return null;
    }

    try {
      const response = await fetch("http://127.0.0.1:8000/api/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        updateUI(userData);
        return userData;
      } else {
        localStorage.removeItem("p2v_token");
        updateUI(null);
        return null;
      }
    } catch (error) {
      console.error("Auth verification failed:", error);
      updateUI(null);
      return null;
    }
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
