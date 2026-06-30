import * as pdfjsLib from "./vendor/pdfjs-dist/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "./vendor/pdfjs-dist/pdf.worker.min.mjs";

// Default PDF. Keep this HTML file and FFSS.pdf in the same folder.
const pdfUrl = "Annual_Report_Concept_Windows_v3_spreads 1.pdf";
//const pdfUrl = "FFSS.pdf"; 

const flipbookEl = document.getElementById("flipbook");
const statusEl = document.getElementById("status");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const bookPrevBtn = document.getElementById("bookPrevBtn");
const bookNextBtn = document.getElementById("bookNextBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const resetZoomBtn = document.getElementById("resetZoomBtn");
const zoomInBtn = document.getElementById("zoomInBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const bookShell = document.querySelector(".book-shell");
const coverZones = document.querySelectorAll(".cover-zone");
const bookLoadingEl = document.getElementById("bookLoading");

let pageFlip = null;
let zoomLevel = 1;
let panX = 0;
let panY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragOriginX = 0;
let dragOriginY = 0;
const activeTouchPointers = new Map();
let pinchStartDistance = 0;
let pinchStartZoom = 1;
const minZoom = 1;
const maxZoom = 5;
const zoomStep = 0.1;
const defaultPageAspectRatio = 420 / 594;
let maxPageAspectRatio = defaultPageAspectRatio;

async function renderPdfToFlipbook(url) {
  try {
    bookLoadingEl.classList.remove("is-hidden");
    const loadingTask = pdfjsLib.getDocument(url);
    const pdf = await loadingTask.promise;

    statusEl.textContent = `Rendering ${pdf.numPages} pages…`;

    const pages = [];
    maxPageAspectRatio = defaultPageAspectRatio;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);

      // Scale controls render sharpness. Higher values are sharper but heavier.
      const viewport = page.getViewport({ scale: 2 });
      //const viewport = page.getViewport({ scale: 1.6 });
      //const viewport = page.getViewport({ scale: 1 });

      const currentPageAspectRatio = viewport.width / viewport.height;
      if (currentPageAspectRatio > maxPageAspectRatio) {
        maxPageAspectRatio = currentPageAspectRatio;
      }

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { alpha: false });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.setAttribute("aria-label", `PDF page ${pageNumber}`);

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      const pageDiv = document.createElement("div");
      pageDiv.className = "page";
      pageDiv.setAttribute("data-density", "soft");
      pageDiv.appendChild(canvas);

      pages.push(pageDiv);
    }

    initializeFlipbook(pages, maxPageAspectRatio);
    bookLoadingEl.classList.add("is-hidden");
    updateStatus();
  } catch (error) {
    console.error(error);
    bookLoadingEl.classList.add("is-hidden");
    statusEl.textContent = "Could not load the PDF.";
    flipbookEl.innerHTML = `
      <div class="error" role="alert">
        <strong>PDF could not be loaded.</strong><br>
        Make sure this HTML file and <code>FFSS.pdf</code> are in the same folder,
        and run the page from a web server rather than opening the HTML file directly.
      </div>
    `;
  }
}

function getPageHeightForWidth(width, pageAspectRatio) {
  return Math.round(width / pageAspectRatio);
}

function initializeFlipbook(pages, pageAspectRatio) {
  flipbookEl.innerHTML = "";

  pages.forEach((page) => {
    flipbookEl.appendChild(page);
  });

  pageFlip = new St.PageFlip(flipbookEl, {
    width: 420,
    height: getPageHeightForWidth(420, pageAspectRatio),
    size: "stretch",
    minWidth: 280,
    maxWidth: 540,
    minHeight: getPageHeightForWidth(280, pageAspectRatio),
    maxHeight: getPageHeightForWidth(540, pageAspectRatio),
    maxShadowOpacity: 0.35,
    showCover: false,
    mobileScrollSupport: false,
    usePortrait: true,
    flippingTime: 700,
    drawShadow: true
  });

  pageFlip.loadFromHTML(document.querySelectorAll(".page"));

  pageFlip.on("flip", () => {
    updateStatus();
  });
}

function updateNavigationButtons() {
  if (!pageFlip) return;

  const currentPage = pageFlip.getCurrentPageIndex() + 1;
  const totalPages = pageFlip.getPageCount();
  const isFirstPage = currentPage <= 1;
  const isLastOrSecondToLastPage = currentPage >= totalPages - 1;

  [prevBtn, bookPrevBtn].forEach((button) => {
    button.disabled = isFirstPage;
    button.classList.toggle("is-disabled", isFirstPage);
  });

  [nextBtn, bookNextBtn].forEach((button) => {
    button.disabled = isLastOrSecondToLastPage;
    button.classList.toggle("is-disabled", isLastOrSecondToLastPage);
  });
}

function updateZoomButtons() {
  zoomOutBtn.disabled = zoomLevel <= minZoom;
  zoomInBtn.disabled = zoomLevel >= maxZoom;
  resetZoomBtn.disabled = zoomLevel === 1;
}

function applyTransform() {
  flipbookEl.style.setProperty("--flipbook-pan-x", `${panX}px`);
  flipbookEl.style.setProperty("--flipbook-pan-y", `${panY}px`);
  flipbookEl.style.setProperty("--flipbook-zoom", zoomLevel.toFixed(2));
}

function setZoom(nextZoom) {
  zoomLevel = Math.min(maxZoom, Math.max(minZoom, nextZoom));
  if (Math.abs(zoomLevel - 1) <= 0.0001) {
    panX = 0;
    panY = 0;
  }
  applyTransform();
  bookShell.classList.toggle("is-zoomed", Math.abs(zoomLevel - 1) > 0.0001);
  updateZoomButtons();
  updateStatus();
}

function getPointerDistance(pointerA, pointerB) {
  return Math.hypot(pointerA.clientX - pointerB.clientX, pointerA.clientY - pointerB.clientY);
}

function updatePinchStart() {
  if (activeTouchPointers.size < 2) return;

  const pointers = Array.from(activeTouchPointers.values());
  pinchStartDistance = getPointerDistance(pointers[0], pointers[1]);
  pinchStartZoom = zoomLevel;
}

function handleWheelZoom(event) {
  event.preventDefault();

  const zoomDirection = event.deltaY < 0 ? 1 : -1;
  setZoom(zoomLevel + zoomDirection * zoomStep);
}

function handleTouchPointerDown(event) {
  if (event.pointerType !== "touch") return;

  activeTouchPointers.set(event.pointerId, {
    clientX: event.clientX,
    clientY: event.clientY
  });

  if (activeTouchPointers.size === 2) {
    isDragging = false;
    bookShell.classList.remove("is-dragging");
    updatePinchStart();
  }
}

function handleTouchPointerMove(event) {
  if (!activeTouchPointers.has(event.pointerId)) return;

  activeTouchPointers.set(event.pointerId, {
    clientX: event.clientX,
    clientY: event.clientY
  });

  if (activeTouchPointers.size < 2 || pinchStartDistance <= 0) return;

  const pointers = Array.from(activeTouchPointers.values());
  const currentDistance = getPointerDistance(pointers[0], pointers[1]);
  setZoom(pinchStartZoom * (currentDistance / pinchStartDistance));
  event.preventDefault();
}

function handleTouchPointerEnd(event) {
  if (!activeTouchPointers.delete(event.pointerId)) return;

  if (activeTouchPointers.size >= 2) {
    updatePinchStart();
    return;
  }

  pinchStartDistance = 0;
  pinchStartZoom = zoomLevel;
}

function handlePanStart(event) {
  if (event.pointerType === "touch") {
    return;
  }

  if (!bookShell.classList.contains("is-zoomed") || event.button !== undefined && event.button !== 0) {
    return;
  }

  isDragging = true;
  bookShell.classList.add("is-dragging");
  dragStartX = event.clientX;
  dragStartY = event.clientY;
  dragOriginX = panX;
  dragOriginY = panY;
  event.preventDefault();
}

function handlePanMove(event) {
  if (!isDragging) return;

  panX = dragOriginX + (event.clientX - dragStartX);
  panY = dragOriginY + (event.clientY - dragStartY);
  applyTransform();
  event.preventDefault();
}

function handlePanEnd() {
  if (!isDragging) return;

  isDragging = false;
  bookShell.classList.remove("is-dragging");
}

function updateStatus() {
  if (!pageFlip) {
    statusEl.textContent = `Zoom ${Math.round(zoomLevel * 100)}%`;
    return;
  }

  const currentPage = pageFlip.getCurrentPageIndex() + 1;
  const totalPages = pageFlip.getPageCount();
  statusEl.textContent = `Page ${currentPage} of ${totalPages} • Zoom ${Math.round(zoomLevel * 100)}%`;
  updateNavigationButtons();
}

function flipPage(direction) {
  if (!pageFlip) return;

  if (direction === "next") {
    pageFlip.flipNext();
  } else if (direction === "prev") {
    pageFlip.flipPrev();
  }
}

prevBtn.addEventListener("click", () => flipPage("prev"));
bookPrevBtn.addEventListener("click", () => flipPage("prev"));

nextBtn.addEventListener("click", () => flipPage("next"));
bookNextBtn.addEventListener("click", () => flipPage("next"));
zoomOutBtn.addEventListener("click", () => setZoom(1));
resetZoomBtn.addEventListener("click", () => setZoom(1));
zoomInBtn.addEventListener("click", () => setZoom(zoomLevel + zoomStep));
bookShell.addEventListener("wheel", handleWheelZoom, { passive: false });
bookShell.addEventListener("pointerdown", handleTouchPointerDown);
document.addEventListener("pointermove", handleTouchPointerMove);
document.addEventListener("pointerup", handleTouchPointerEnd);
document.addEventListener("pointercancel", handleTouchPointerEnd);
bookShell.addEventListener("pointerdown", handlePanStart);
document.addEventListener("pointermove", handlePanMove);
document.addEventListener("pointerup", handlePanEnd);
document.addEventListener("pointercancel", handlePanEnd);

setZoom(1);
updateNavigationButtons();

coverZones.forEach((zone) => {
  const handleZoneInteraction = (event) => {
    if (zone.classList.contains("right")) {
      flipPage("next");
    } else {
      flipPage("prev");
    }
  };

  zone.addEventListener("click", handleZoneInteraction);
  zone.addEventListener("dblclick", handleZoneInteraction);
  zone.addEventListener("touchend", handleZoneInteraction);
});

fullscreenBtn.addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) {
      await bookShell.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    console.error("Fullscreen failed:", error);
  }
});

document.addEventListener("keydown", (event) => {
  if (!pageFlip) return;

  if (event.key === "ArrowLeft") {
    pageFlip.flipPrev();
  }

  if (event.key === "ArrowRight") {
    pageFlip.flipNext();
  }

  if ((event.ctrlKey || event.metaKey) && event.key === "+") {
    event.preventDefault();
    setZoom(zoomLevel + zoomStep);
  }

  if ((event.ctrlKey || event.metaKey) && event.key === "-") {
    event.preventDefault();
    setZoom(1);
  }

  if ((event.ctrlKey || event.metaKey) && event.key === "0") {
    event.preventDefault();
    setZoom(1);
  }
});

renderPdfToFlipbook(pdfUrl);
