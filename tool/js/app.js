import { createPdfFlipbook } from './modules/flipbook.js';

const defaultPdfUrl = '../example-pdfs/Annual_Report_Concept_Windows_v3_spreads 1.pdf';

function initializeAutoFlipbooks() {
  const flipbookSelectors = document.querySelectorAll('[data-pdf-flipbook], .pdf-flipbook');

  flipbookSelectors.forEach((root) => {
    const pdfUrl = root.dataset.pdfUrl || defaultPdfUrl;
    const pdfLinkUrl = root.dataset.pdfLinkUrl || pdfUrl;

    try {
      createPdfFlipbook(root, { pdfUrl, pdfLinkUrl });
    } catch (err) {
      console.error('Failed to initialize flipbook', err);
    }
  });
}

export { createPdfFlipbook };

initializeAutoFlipbooks();
