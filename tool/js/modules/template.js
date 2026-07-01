export const loadingBarImageUrl = new URL("../../images/loading-bar-book.gif", import.meta.url).href;

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function getPdfFlipbookTemplate(options = {}) {
  const pdfLinkUrl = escapeHtml(options.pdfLinkUrl || options.pdfUrl || "#");
  const instId = String(options.instanceId || options.id || "zoom-range").replace(/[^a-zA-Z0-9_-]/g, "_");

  return `
    <div class="book-frame">
      <div class="status-wrapper status-wrapper--top">
        <button type="button" class="fullscreen-btn icon-btn" aria-label="Toggle fullscreen view">
          <span>Full screen</span>
        </button>
        <span class="topbar-separator" aria-hidden="true">|</span>
        <a class="pdf-link icon-btn open-pdf-link" href="${pdfLinkUrl}" target="_blank" rel="noopener noreferrer" aria-label="Open the accessible PDF view in a new tab">
          <span>Open Accessible View</span>
        </a>
        <div class="zoom-group" role="group" aria-label="Zoom controls">
          <button type="button" class="zoom-btn zoom-btn--text reset-zoom-btn" aria-label="Reset zoom">Zoom</button>
          <label class="zoom-range-label" for="zoom-range-${instId}"></label>
          <input id="zoom-range-${instId}" class="zoom-range" type="range" min="1" max="5" step="0.1" value="1" aria-label="Zoom level" />
        </div>
      </div>
      <section class="book-shell" role="region" aria-label="PDF flipbook viewer">
        <div class="book-loading" aria-hidden="true">
          <img src="${loadingBarImageUrl}" alt="" />
        </div>
        <button type="button" class="book-nav-btn book-prev-btn left navigation-arrows__button navigation-arrows__button--left" aria-label="Previous page">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" aria-hidden="true" focusable="false"><path fill="currentColor" d="M41.36 46.12c.3.32.45.48.45.68 0 .2-.15.36-.45.68l-2.57 2.74c-.34.37-.51.55-.73.55-.21 0-.39-.18-.73-.55L24.64 36.68c-.3-.32-.45-.48-.45-.68 0-.2.15-.36.45-.68l12.7-13.54c.33-.37.5-.55.72-.55.22 0 .39.18.73.55l2.57 2.74c.3.32.45.48.45.68 0 .2-.15.36-.45.68L31.88 36l9.48 10.12Z"></path></svg>
        </button>
        <button type="button" class="book-nav-btn book-next-btn right navigation-arrows__button navigation-arrows__button--right" aria-label="Next page">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" aria-hidden="true" focusable="false"><path fill="currentColor" d="M41.36 46.12c.3.32.45.48.45.68 0 .2-.15.36-.45.68l-2.57 2.74c-.34.37-.51.55-.73.55-.21 0-.39-.18-.73-.55L24.64 36.68c-.3-.32-.45-.48-.45-.68 0-.2.15-.36.45-.68l12.7-13.54c.33-.37.5-.55.72-.55.22 0 .39.18.73.55l2.57 2.74c.3.32.45.48.45.68 0 .2-.15.36-.45.68L31.88 36l9.48 10.12Z"></path></svg>
        </button>
        <div class="cover-overlay" aria-hidden="true">
          <div class="cover-zone left"></div>
          <div class="cover-zone right"></div>
        </div>
        <p class="sr-only flipbook-help">Use the previous and next buttons or the left and right arrow keys to move through the book.</p>
        <div class="flipbook-viewport">
          <div class="flipbook" role="group" aria-label="Flipbook pages" tabindex="0"></div>
        </div>
      </section>
      <div class="status-wrapper status-wrapper--bottom" role="status" aria-live="polite" aria-atomic="true">
        <span class="status">Loading PDF...</span>
      </div>
    </div>
  `;
}
