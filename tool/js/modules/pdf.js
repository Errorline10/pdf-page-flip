export const pdfjsLib = await import(new URL("../minifyed/pdf.min.mjs", import.meta.url));

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("../minifyed/pdf.worker.min.mjs", import.meta.url).href;

export function getDocument(url) {
  const loadingTask = pdfjsLib.getDocument(url);
  return loadingTask.promise;
}

export default pdfjsLib;
