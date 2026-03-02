document.addEventListener("DOMContentLoaded", () => {
  const tabIds = ["about-us", "privacy-policy", "terms-and-conditions"];

  function showTabFromHash() {
    const hash = (window.location.hash || "").replace("#", "");
    if (!hash || !tabIds.includes(hash)) return;

    const tabBtn = document.getElementById(`${hash}-tab`);
    if (!tabBtn) return;

    const tab = bootstrap.Tab.getOrCreateInstance(tabBtn);
    tab.show();
  }

  showTabFromHash();
  window.addEventListener("hashchange", showTabFromHash);
});
