// Accordion toggle
document.addEventListener("click", (e: Event) => {
  const target = e.target as HTMLElement;
  const accordionTrigger = target.closest(
    "[data-accordion-trigger]"
  ) as HTMLElement | null;
  if (accordionTrigger) {
    const content = accordionTrigger
      .closest("[data-accordion]")
      ?.querySelector("[data-accordion-content]") as HTMLElement | null;
    if (content) {
      content.classList.toggle("hidden");
      const icon = accordionTrigger.querySelector("[data-accordion-icon]");
      if (icon) {
        icon.classList.toggle("rotate-180");
      }
    }
  }
});

// Clickable table rows
document.addEventListener("click", (e: Event) => {
  const target = e.target as HTMLElement;
  const row = target.closest("[data-href]") as HTMLElement | null;
  if (row && !target.closest("a, button, form")) {
    const href = row.dataset.href;
    if (href) {
      window.location.href = href;
    }
  }
});

// Copy to clipboard
document.addEventListener("click", (e: Event) => {
  const target = e.target as HTMLElement;
  const copyBtn = target.closest("[data-copy]") as HTMLElement | null;
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

// htmx history fix: reload on popstate
window.addEventListener("popstate", () => {
  location.reload();
});
