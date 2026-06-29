import * as pdfjsLib from "./vendor/pdfjs-dist/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "./vendor/pdfjs-dist/pdf.worker.min.mjs";

// Default PDF. Keep this HTML file and FFSS.pdf in the same folder.
const pdfUrl = "FFSS.pdf";

const flipbookEl = document.getElementById("flipbook");
const statusEl = document.getElementById("status");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const bookPrevBtn = document.getElementById("bookPrevBtn");
const bookNextBtn = document.getElementById("bookNextBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const bookShell = document.querySelector(".book-shell");
const coverZones = document.querySelectorAll(".cover-zone");

let pageFlip = null;

async function renderPdfToFlipbook(url) {
  try {
    const loadingTask = pdfjsLib.getDocument(url);
    const pdf = await loadingTask.promise;

    statusEl.textContent = `Rendering ${pdf.numPages} pages…`;

    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);

      // Scale controls render sharpness. Higher values are sharper but heavier.
      const viewport = page.getViewport({ scale: 1.6 });

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

    initializeFlipbook(pages);
    updateStatus();
  } catch (error) {
    console.error(error);
    statusEl.textContent = "Could not load the PDF.";
    flipbookEl.innerHTML = `
      <div class="error">
        <strong>PDF could not be loaded.</strong><br>
        Make sure this HTML file and <code>FFSS.pdf</code> are in the same folder,
        and run the page from a web server rather than opening the HTML file directly.
      </div>
    `;
  }
}

function initializeFlipbook(pages) {
  flipbookEl.innerHTML = "";

  pages.forEach((page) => {
    flipbookEl.appendChild(page);
  });

  pageFlip = new St.PageFlip(flipbookEl, {
    width: 420,
    height: 594,
    size: "stretch",
    minWidth: 280,
    maxWidth: 540,
    minHeight: 396,
    maxHeight: 764,
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

function updateStatus() {
  if (!pageFlip) return;

  const currentPage = pageFlip.getCurrentPageIndex() + 1;
  const totalPages = pageFlip.getPageCount();
  statusEl.textContent = `Page ${currentPage} of ${totalPages}`;
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
});

renderPdfToFlipbook(pdfUrl);
