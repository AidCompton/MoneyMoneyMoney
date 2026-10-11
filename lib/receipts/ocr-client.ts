// Reads receipt photos on the phone itself (in a background worker, so the
// page stays responsive). The reading engine and English data are served by
// this app from /ocr (copied there from node_modules by
// scripts/copy-ocr-assets.mjs), never from a third-party CDN. The first scan
// downloads them (about 7 MB); the browser keeps them for next time.
//
// Browser-only: import this from client components.

import type { Worker } from "tesseract.js";
import type { ReadLines } from "./types";

export type PreparedPhoto = {
  /** A colour JPEG, at most 1000px wide: shown while reviewing and saved with the receipt. */
  display: Blob;
  displayUrl: string;
  width: number;
  height: number;
  /** A larger, greyscale, high-contrast copy for reading. */
  ocr: HTMLCanvasElement;
  /** OCR pixels to display pixels. */
  scale: number;
};

export type ReadProgress = { status: string; progress: number };

const OCR_WIDTH = 1600;
const MAX_OCR_PIXELS = 12_000_000;
const DISPLAY_WIDTH = 1000;
const MAX_DISPLAY_BYTES = 600 * 1024;

function canvas(width: number, height: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  return c;
}

const toJpeg = (c: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("The photo couldn't be prepared."))), "image/jpeg", quality),
  );

/** Greyscale, then stretch the contrast so faint thermal print stands out. */
function greyAndStretch(c: HTMLCanvasElement) {
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const image = ctx.getImageData(0, 0, c.width, c.height);
  const px = image.data;
  const histogram = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) {
    const y = (px[i] * 77 + px[i + 1] * 150 + px[i + 2] * 29) >> 8;
    px[i] = y;
    histogram[y]++;
  }
  const total = px.length / 4;
  let low = 0;
  let high = 255;
  for (let seen = 0; low < 255 && (seen += histogram[low]) < total * 0.01; low++);
  for (let seen = 0; high > 0 && (seen += histogram[high]) < total * 0.01; high--);
  const range = Math.max(1, high - low);
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.min(255, Math.max(0, ((px[i] - low) * 255) / range));
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(image, 0, 0);
}

/** Turns a photo (any size, any way up) into the copies needed for reading and keeping. */
export async function preparePhoto(file: Blob): Promise<PreparedPhoto> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => {
      throw new Error("That file isn't a photo this phone can open.");
    });
    // Browsers apply the camera's rotation flag, so these sizes are upright.
    const w = img.naturalWidth;
    const h = img.naturalHeight;

    let ocrScale = OCR_WIDTH / w;
    if (w * h * ocrScale * ocrScale > MAX_OCR_PIXELS) ocrScale = Math.sqrt(MAX_OCR_PIXELS / (w * h));
    const ocr = canvas(w * ocrScale, h * ocrScale);
    ocr.getContext("2d", { willReadFrequently: true })!.drawImage(img, 0, 0, ocr.width, ocr.height);
    greyAndStretch(ocr);

    const displayScale = Math.min(1, DISPLAY_WIDTH / w);
    const display = canvas(w * displayScale, h * displayScale);
    display.getContext("2d")!.drawImage(img, 0, 0, display.width, display.height);
    let blob = await toJpeg(display, 0.8);
    if (blob.size > MAX_DISPLAY_BYTES) blob = await toJpeg(display, 0.6);
    if (blob.size > MAX_DISPLAY_BYTES) {
      const smaller = canvas(display.width * 0.7, display.height * 0.7);
      smaller.getContext("2d")!.drawImage(display, 0, 0, smaller.width, smaller.height);
      blob = await toJpeg(smaller, 0.6);
      return { display: blob, displayUrl: URL.createObjectURL(blob), width: smaller.width, height: smaller.height, ocr, scale: smaller.width / ocr.width };
    }

    return {
      display: blob,
      displayUrl: URL.createObjectURL(blob),
      width: display.width,
      height: display.height,
      ocr,
      scale: display.width / ocr.width,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

let worker: Promise<Worker> | null = null;
let listener: ((p: ReadProgress) => void) | undefined;

function getWorker() {
  worker ??= import("tesseract.js").then(({ createWorker }) =>
    createWorker("eng", 1 /* LSTM only */, {
      workerPath: "/ocr/worker.min.js",
      corePath: "/ocr/core",
      langPath: "/ocr/lang",
      gzip: true,
      workerBlobURL: false,
      logger: (m: { status: string; progress: number }) => listener?.({ status: m.status, progress: m.progress }),
    }),
  );
  worker.catch(() => {
    worker = null;
  });
  return worker;
}

/** Reads the text on the photo, with each line's position on the display copy. */
export async function readText(photo: PreparedPhoto, onProgress?: (p: ReadProgress) => void): Promise<ReadLines> {
  listener = onProgress;
  try {
    const w = await getWorker();
    const { data } = await w.recognize(photo.ocr, {}, { blocks: true });
    const lines: ReadLines["lines"] = [];
    for (const block of data.blocks ?? []) {
      for (const paragraph of block.paragraphs) {
        for (const line of paragraph.lines) {
          const s = photo.scale;
          lines.push({
            text: line.text.trim(),
            confidence: Math.max(0, Math.min(100, line.confidence)),
            bbox: {
              x0: Math.min(photo.width, Math.max(0, Math.round(line.bbox.x0 * s))),
              y0: Math.min(photo.height, Math.max(0, Math.round(line.bbox.y0 * s))),
              x1: Math.min(photo.width, Math.max(0, Math.round(line.bbox.x1 * s))),
              y1: Math.min(photo.height, Math.max(0, Math.round(line.bbox.y1 * s))),
            },
          });
        }
      }
    }
    return { lines: lines.slice(0, 400), width: photo.width, height: photo.height };
  } finally {
    listener = undefined;
  }
}

/** A blob's bytes as base64 (no data: prefix). */
export function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
