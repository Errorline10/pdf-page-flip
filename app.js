const pdfjsLib = await import(new URL("./pdfjs-dist/pdf.min.mjs", import.meta.url));

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("./pdfjs-dist/pdf.worker.min.mjs", import.meta.url).href;

// Add more instances here, or set data-pdf-url on each .pdf-flipbook mount.
const pdfUrl = "./Annual_Report_Concept_Windows_v3_spreads 1.pdf";
const flipbookConfigs = [
  {
    root: ".pdf-flipbook",
    pdfUrl
  }
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getPdfFlipbookTemplate(options = {}) {
  const pdfLinkUrl = escapeHtml(options.pdfLinkUrl || options.pdfUrl || "#");
  const instId = String(options.instanceId || options.id || "zoom-range").replace(/[^a-zA-Z0-9_-]/g, "_");

  return `
    <div class="book-frame">
      <div class="status-wrapper status-wrapper--top">
        <button type="button" class="fullscreen-btn icon-btn" aria-label="Toggle fullscreen view">
          <img src="images/icon-full-screen.svg" alt="" aria-hidden="true" />
          <span>Full screen</span>
        </button>
        <span class="topbar-separator" aria-hidden="true">|</span>
        <a class="pdf-link icon-btn open-pdf-link" href="${pdfLinkUrl}" target="_blank" rel="noopener noreferrer" aria-label="Open the accessible PDF view in a new tab">
          <img src="images/icon-open.svg" alt="" aria-hidden="true" />
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
          <img src="images/loading-bar-book.gif" alt="" />
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

class PdfFlipbook {
  static instanceCount = 0;

  constructor(root, options = {}) {
    this.root = root;
    this.pdfUrl = options.pdfUrl || root.dataset.pdfUrl;
    this.pdfLinkUrl = options.pdfLinkUrl || root.dataset.pdfLinkUrl || this.pdfUrl;
    this.instanceId = `pdf-flipbook-${++PdfFlipbook.instanceCount}`;

    this.renderTemplate();

    this.viewportEl = root.querySelector(".flipbook-viewport");
    this.flipbookEl = root.querySelector(".flipbook");
    this.statusEl = root.querySelector(".status");
    this.prevBtn = root.querySelector(".prev-btn");
    this.nextBtn = root.querySelector(".next-btn");
    this.bookPrevBtn = root.querySelector(".book-prev-btn");
    this.bookNextBtn = root.querySelector(".book-next-btn");
    this.zoomOutBtn = root.querySelector(".zoom-out-btn");
    this.resetZoomBtn = root.querySelector(".reset-zoom-btn");
    this.zoomRange = root.querySelector('.zoom-range');
    this.fullscreenBtn = root.querySelector(".fullscreen-btn");
    this.bookShell = root.querySelector(".book-shell");
    this.coverZones = root.querySelectorAll(".cover-zone");
    this.bookLoadingEl = root.querySelector(".book-loading");
    this.helpEl = root.querySelector(".flipbook-help");

    this.pageFlip = null;
    this.zoomLevel = 1;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragOriginX = 0;
    this.dragOriginY = 0;
    this.activeTouchPointers = new Map();
    this.pinchStartDistance = 0;
    this.pinchStartZoom = 1;
    this.minZoom = 1;
    this.maxZoom = 5;
    this.zoomStep = 0.1;
    this.defaultPageAspectRatio = 420 / 594;
    this.maxPageAspectRatio = this.defaultPageAspectRatio;

    this.bindInstanceAttributes();
    this.bindEvents();
    this.setZoom(1);
    this.updateNavigationButtons();
  }

  renderTemplate() {
    this.root.innerHTML = getPdfFlipbookTemplate({
      pdfUrl: this.pdfUrl,
      pdfLinkUrl: this.pdfLinkUrl,
      instanceId: this.instanceId
    });
  }

  bindInstanceAttributes() {
    const helpId = `${this.instanceId}-help`;

    if (this.helpEl) {
      this.helpEl.id = helpId;
    }

    if (this.bookShell) {
      this.bookShell.setAttribute("aria-describedby", helpId);
    }

    if (this.flipbookEl) {
      this.flipbookEl.id = `${this.instanceId}-pages`;
    }

    [this.prevBtn, this.nextBtn, this.fullscreenBtn].forEach((control) => {
      if (control && this.flipbookEl) {
        control.setAttribute("aria-controls", this.flipbookEl.id);
      }
    });
  }

  bindEvents() {
    this.prevBtn?.addEventListener("click", () => this.flipPage("prev"));
    this.bookPrevBtn?.addEventListener("click", () => {
      this.setZoom(1);
      this.flipPage("prev");
    });
    this.nextBtn?.addEventListener("click", () => this.flipPage("next"));
    this.bookNextBtn?.addEventListener("click", () => {
      this.setZoom(1);
      this.flipPage("next");
    });
    this.resetZoomBtn?.addEventListener("click", () => this.setZoom(1));
    this.zoomRange?.addEventListener('input', (event) => {
      const v = parseFloat(event.target.value);
      if (!Number.isNaN(v)) this.setZoom(v);
    });
    this.fullscreenBtn?.addEventListener("click", () => this.toggleFullscreen());

    // Wheel zoom and activation via click/focus removed per request
    this.bookShell?.addEventListener("pointerdown", (event) => this.handleTouchPointerDown(event));
    this.bookShell?.addEventListener("pointerdown", (event) => this.handlePanStart(event));
    this.root.addEventListener("keydown", (event) => this.handleKeydown(event));

    document.addEventListener("pointermove", (event) => this.handleTouchPointerMove(event));
    document.addEventListener("pointerup", (event) => this.handleTouchPointerEnd(event));
    document.addEventListener("pointercancel", (event) => this.handleTouchPointerEnd(event));
    document.addEventListener("pointermove", (event) => this.handlePanMove(event));
    document.addEventListener("pointerup", () => this.handlePanEnd());
    document.addEventListener("pointercancel", () => this.handlePanEnd());

    this.coverZones.forEach((zone) => {
      const handleZoneInteraction = () => {
        this.flipPage(zone.classList.contains("right") ? "next" : "prev");
      };

      zone.addEventListener("click", handleZoneInteraction);
      zone.addEventListener("dblclick", handleZoneInteraction);
      zone.addEventListener("touchend", handleZoneInteraction);
    });
  }

  async render() {
    if (!this.pdfUrl) {
      this.showError("No PDF URL was provided.");
      return;
    }

    try {
      this.bookLoadingEl?.classList.remove("is-hidden");
      const loadingTask = pdfjsLib.getDocument(this.pdfUrl);
      const pdf = await loadingTask.promise;

      this.statusEl.textContent = `Rendering ${pdf.numPages} pages...`;

      const pages = [];
      this.maxPageAspectRatio = this.defaultPageAspectRatio;

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);

        // Scale controls render sharpness. Higher values are sharper but heavier.
        const viewport = page.getViewport({ scale: 2 });
        const currentPageAspectRatio = viewport.width / viewport.height;

        if (currentPageAspectRatio > this.maxPageAspectRatio) {
          this.maxPageAspectRatio = currentPageAspectRatio;
        }

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { alpha: false });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.setAttribute("aria-label", `PDF page ${pageNumber}`);

        await page.render({
          canvasContext: context,
          viewport
        }).promise;

        const annotations = await page.getAnnotations({ intent: "display" });
        const linkOverlay = document.createElement("div");
        linkOverlay.className = "pdf-link-overlays";

        annotations.forEach((annotation) => {
          if (annotation.subtype !== "Link") {
            return;
          }

          const url = annotation.url || annotation.unsafeUrl;
          if (!url) {
            return;
          }

          const rect = viewport.convertToViewportRectangle(annotation.rect);
          const [x1, y1, x2, y2] = rect;
          const leftPercent = (Math.min(x1, x2) / viewport.width) * 100;
          const topPercent = (Math.min(y1, y2) / viewport.height) * 100;
          const widthPercent = (Math.abs(x1 - x2) / viewport.width) * 100;
          const heightPercent = (Math.abs(y1 - y2) / viewport.height) * 100;

          const linkEl = document.createElement("a");
          linkEl.className = "pdf-link-overlay";
          linkEl.href = url;
          linkEl.target = "_blank";
          linkEl.rel = "noopener noreferrer";
          linkEl.style.left = `${leftPercent}%`;
          linkEl.style.top = `${topPercent}%`;
          linkEl.style.width = `${widthPercent}%`;
          linkEl.style.height = `${heightPercent}%`;
          linkEl.setAttribute("aria-label", annotation.altText || annotation.title || "PDF link");
          linkEl.addEventListener("pointerdown", (event) => event.stopPropagation());
          linkEl.addEventListener("click", (event) => event.stopPropagation());

          linkOverlay.appendChild(linkEl);
        });

        const pageDiv = document.createElement("div");
        pageDiv.className = "page";
        pageDiv.setAttribute("data-density", "soft");
        pageDiv.appendChild(canvas);
        pageDiv.appendChild(linkOverlay);

        pages.push(pageDiv);
      }

      this.initializeFlipbook(pages, this.maxPageAspectRatio);
      this.setZoom(1);
      this.bookLoadingEl?.classList.add("is-hidden");
      this.updateStatus();
    } catch (error) {
      console.error(error);
      this.bookLoadingEl?.classList.add("is-hidden");
      this.showError("Could not load the PDF.");
    }
  }

  showError(message) {
    this.statusEl.textContent = message;
    this.flipbookEl.innerHTML = `
      <div class="error" role="alert">
        <strong>PDF could not be loaded.</strong><br>
        Make sure the PDF exists and run the page from a web server rather than opening the HTML file directly.
      </div>
    `;
  }

  getPageHeightForWidth(width, pageAspectRatio) {
    return Math.round(width / pageAspectRatio);
  }

  initializeFlipbook(pages, pageAspectRatio) {
    this.flipbookEl.innerHTML = "";

    pages.forEach((page) => {
      this.flipbookEl.appendChild(page);
    });

    this.pageFlip = new St.PageFlip(this.flipbookEl, {
      width: 420,
      height: this.getPageHeightForWidth(420, pageAspectRatio),
      size: "stretch",
      minWidth: 280,
      maxWidth: 540,
      minHeight: this.getPageHeightForWidth(280, pageAspectRatio),
      maxHeight: this.getPageHeightForWidth(540, pageAspectRatio),
      maxShadowOpacity: 0.35,
      showCover: false,
      mobileScrollSupport: false,
      usePortrait: true,
      flippingTime: 700,
      drawShadow: true
    });

    this.pageFlip.loadFromHTML(this.flipbookEl.querySelectorAll(".page"));
    this.pageFlip.on("flip", () => this.updateStatus());
  }

  updateNavigationButtons() {
    if (!this.pageFlip) return;

    const currentPage = this.pageFlip.getCurrentPageIndex() + 1;
    const totalPages = this.pageFlip.getPageCount();
    const isFirstPage = currentPage <= 1;
    const isLastOrSecondToLastPage = currentPage >= totalPages - 1;

    [this.prevBtn, this.bookPrevBtn].forEach((button) => {
      if (!button) return;

      button.disabled = isFirstPage;
      button.classList.toggle("is-disabled", isFirstPage);
    });

    [this.nextBtn, this.bookNextBtn].forEach((button) => {
      if (!button) return;

      button.disabled = isLastOrSecondToLastPage;
      button.classList.toggle("is-disabled", isLastOrSecondToLastPage);
    });
  }

  updateZoomButtons() {
    const isDefaultZoom = this.zoomLevel === 1;

    if (this.zoomOutBtn) this.zoomOutBtn.disabled = this.zoomLevel <= this.minZoom;
    if (this.zoomInBtn) this.zoomInBtn.disabled = this.zoomLevel >= this.maxZoom;
    this.resetZoomBtn.disabled = isDefaultZoom;
    this.resetZoomBtn.textContent = isDefaultZoom ? "Zoom" : "Reset zoom";
    this.resetZoomBtn.classList.toggle("is-zoomed", !isDefaultZoom);
    if (this.zoomRange) {
      try {
        this.zoomRange.value = String(this.zoomLevel);
        this.zoomRange.min = String(this.minZoom);
        this.zoomRange.max = String(this.maxZoom);
        this.zoomRange.step = String(this.zoomStep);
      } catch (e) {
        // ignore if properties unsupported
      }
    }
  }

  applyTransform() {
    const transformEl = this.viewportEl || this.flipbookEl;
    transformEl.style.setProperty("--flipbook-pan-x", `${this.panX}px`);
    transformEl.style.setProperty("--flipbook-pan-y", `${this.panY}px`);
    transformEl.style.setProperty("--flipbook-zoom", this.zoomLevel.toFixed(2));
  }

  setZoom(nextZoom) {
    this.zoomLevel = Math.min(this.maxZoom, Math.max(this.minZoom, nextZoom));

    if (Math.abs(this.zoomLevel - 1) <= 0.0001) {
      this.panX = 0;
      this.panY = 0;
    }

    this.applyTransform();
    this.bookShell.classList.toggle("is-zoomed", Math.abs(this.zoomLevel - 1) > 0.0001);
    this.updateZoomButtons();
    this.updateStatus();
  }

  getPointerDistance(pointerA, pointerB) {
    return Math.hypot(pointerA.clientX - pointerB.clientX, pointerA.clientY - pointerB.clientY);
  }

  updatePinchStart() {
    if (this.activeTouchPointers.size < 2) return;

    const pointers = Array.from(this.activeTouchPointers.values());
    this.pinchStartDistance = this.getPointerDistance(pointers[0], pointers[1]);
    this.pinchStartZoom = this.zoomLevel;
  }


  handleTouchPointerDown(event) {
    if (event.pointerType !== "touch") return;

    this.activeTouchPointers.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY
    });

    if (this.activeTouchPointers.size === 2) {
      this.isDragging = false;
      this.bookShell.classList.remove("is-dragging");
      this.updatePinchStart();
      return;
    }

    if (this.activeTouchPointers.size === 1 && this.bookShell.classList.contains("is-zoomed")) {
      this.handlePanStart(event);
    }
  }

  handleTouchPointerMove(event) {
    if (!this.activeTouchPointers.has(event.pointerId)) return;

    this.activeTouchPointers.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY
    });

    if (this.activeTouchPointers.size === 1 && this.isDragging) {
      this.handlePanMove(event);
      return;
    }

    if (this.activeTouchPointers.size < 2 || this.pinchStartDistance <= 0) return;

    const pointers = Array.from(this.activeTouchPointers.values());
    const currentDistance = this.getPointerDistance(pointers[0], pointers[1]);
    this.setZoom(this.pinchStartZoom * (currentDistance / this.pinchStartDistance));
    event.preventDefault();
  }

  handleTouchPointerEnd(event) {
    if (!this.activeTouchPointers.delete(event.pointerId)) return;

    if (this.activeTouchPointers.size >= 2) {
      this.updatePinchStart();
      return;
    }

    this.pinchStartDistance = 0;
    this.pinchStartZoom = this.zoomLevel;
  }

  handlePanStart(event) {
    if (event.pointerType === "touch" && this.activeTouchPointers.size > 1) {
      return;
    }

    if (!this.bookShell.classList.contains("is-zoomed") || event.button !== undefined && event.button !== 0) {
      return;
    }

    this.isDragging = true;
    this.bookShell.classList.add("is-dragging");
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragOriginX = this.panX;
    this.dragOriginY = this.panY;
    event.preventDefault();
  }

  handlePanMove(event) {
    if (!this.isDragging) return;

    this.panX = this.dragOriginX + (event.clientX - this.dragStartX);
    this.panY = this.dragOriginY + (event.clientY - this.dragStartY);
    this.applyTransform();
    event.preventDefault();
  }

  handlePanEnd() {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.bookShell.classList.remove("is-dragging");
  }

  updateStatus() {
    if (!this.pageFlip) {
      this.statusEl.textContent = `Zoom ${Math.round(this.zoomLevel * 100)}%`;
      return;
    }

    const currentPage = this.pageFlip.getCurrentPageIndex() + 1;
    const totalPages = this.pageFlip.getPageCount();
    this.statusEl.textContent = `Page ${currentPage} of ${totalPages} - Zoom ${Math.round(this.zoomLevel * 100)}%`;
    this.updateNavigationButtons();
  }

  flipPage(direction) {
    if (!this.pageFlip) return;

    if (direction === "next") {
      this.pageFlip.flipNext();
    } else if (direction === "prev") {
      this.pageFlip.flipPrev();
    }
  }

  async toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await this.bookShell.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("Fullscreen failed:", error);
    }
  }

  handleKeydown(event) {
    if (!this.pageFlip) return;

    if (event.key === "ArrowLeft") {
      this.pageFlip.flipPrev();
    }

    if (event.key === "ArrowRight") {
      this.pageFlip.flipNext();
    }

    if ((event.ctrlKey || event.metaKey) && event.key === "+") {
      event.preventDefault();
      this.setZoom(this.zoomLevel + this.zoomStep);
    }

    if ((event.ctrlKey || event.metaKey) && event.key === "-") {
      event.preventDefault();
      this.setZoom(1);
    }

    if ((event.ctrlKey || event.metaKey) && event.key === "0") {
      event.preventDefault();
      this.setZoom(1);
    }
  }
}

function createPdfFlipbook(root, options) {
  const rootElement = typeof root === "string" ? document.querySelector(root) : root;
  if (!rootElement) {
    throw new Error("PdfFlipbook root element was not found.");
  }

  const instance = new PdfFlipbook(rootElement, options);
  instance.render();
  return instance;
}

window.PdfFlipbook = PdfFlipbook;
window.createPdfFlipbook = createPdfFlipbook;
window.getPdfFlipbookTemplate = getPdfFlipbookTemplate;

export { PdfFlipbook, createPdfFlipbook, getPdfFlipbookTemplate };

flipbookConfigs.forEach((config) => {
  document.querySelectorAll(config.root).forEach((root) => {
    createPdfFlipbook(root, {
      pdfUrl: root.dataset.pdfUrl || config.pdfUrl
    });
  });
});
