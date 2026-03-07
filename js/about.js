document.addEventListener("DOMContentLoaded", () => {
  const tabIds = ["about-us", "privacy-policy", "terms-and-conditions"];
  const feedbackForm = document.getElementById("feedbackForm");
  const feedbackName = document.getElementById("feedbackName");
  const feedbackEmail = document.getElementById("feedbackEmail");
  const feedbackFoundPlace = document.getElementById("feedbackFoundPlace");
  const feedbackMessage = document.getElementById("feedbackMessage");
  const feedbackSubmitBtn = document.getElementById("feedbackSubmitBtn");
  const feedbackFormMessage = document.getElementById("feedbackFormMessage");
  const auth = window.AuthManager;

  function showTabFromHash() {
    const hash = (window.location.hash || "").replace("#", "");
    if (!hash || !tabIds.includes(hash)) return;

    const tabBtn = document.getElementById(`${hash}-tab`);
    if (!tabBtn) return;

    const tab = bootstrap.Tab.getOrCreateInstance(tabBtn);
    tab.show();
  }

  function setFeedbackMessage(message, tone = "error") {
    if (!feedbackFormMessage) return;
    feedbackFormMessage.textContent = message;
    feedbackFormMessage.classList.remove("is-success", "is-error");
    feedbackFormMessage.classList.add(tone === "success" ? "is-success" : "is-error");
  }

  async function prefillFeedbackForm() {
    if (!auth?.hasValidSession?.()) return;
    try {
      const user = await auth.verifySession();
      if (!user) return;
      if (feedbackName && !feedbackName.value) {
        const fullName = `${user?.first_name || ""} ${user?.last_name || ""}`.trim();
        feedbackName.value = fullName || "";
      }
      if (feedbackEmail && !feedbackEmail.value) {
        feedbackEmail.value = user?.email || "";
      }
    } catch (_error) {
      // Prefill is optional.
    }
  }

  async function submitFeedback(payload) {
    const base = auth?.API_BASE_URL;
    const response = await fetch(`${base}/api/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Feedback submission failed (${response.status})`);
    }
    return true;
  }

  feedbackForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      name: feedbackName?.value?.trim() || "",
      email: feedbackEmail?.value?.trim() || "",
      found_place: feedbackFoundPlace?.checked === true,
      message: feedbackMessage?.value?.trim() || "",
    };

    if (!payload.name || !payload.email || !payload.message) {
      setFeedbackMessage("Please fill name, email, and message.");
      return;
    }

    if (feedbackSubmitBtn) feedbackSubmitBtn.disabled = true;
    setFeedbackMessage("");

    try {
      await submitFeedback(payload);
      setFeedbackMessage("Thanks. Your feedback has been submitted.", "success");
      feedbackForm.reset();
      await prefillFeedbackForm();
    } catch (error) {
      setFeedbackMessage(error?.message || "Unable to submit feedback right now.");
    } finally {
      if (feedbackSubmitBtn) feedbackSubmitBtn.disabled = false;
    }
  });

  showTabFromHash();
  window.addEventListener("hashchange", showTabFromHash);
  prefillFeedbackForm();
});
