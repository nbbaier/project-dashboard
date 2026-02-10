// src/client/main.ts
document.addEventListener("click", (e) => {
  const target = e.target;
  const accordionTrigger = target.closest("[data-accordion-trigger]");
  if (accordionTrigger) {
    const content = accordionTrigger.closest("[data-accordion]")?.querySelector("[data-accordion-content]");
    if (content) {
      content.classList.toggle("hidden");
      const icon = accordionTrigger.querySelector("[data-accordion-icon]");
      if (icon) {
        icon.classList.toggle("rotate-180");
      }
    }
  }
});
document.addEventListener("click", (e) => {
  const target = e.target;
  const row = target.closest("[data-href]");
  if (row && !target.closest("a, button, form")) {
    const href = row.dataset.href;
    if (href) {
      window.location.href = href;
    }
  }
});
document.addEventListener("click", (e) => {
  const target = e.target;
  const copyBtn = target.closest("[data-copy]");
  if (copyBtn) {
    const text = copyBtn.dataset.copy;
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = "Copied!";
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 2000);
      });
    }
  }
});
window.addEventListener("popstate", () => {
  location.reload();
});
