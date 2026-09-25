import "server-only";
import path from "node:path";
import sharp from "sharp";
import { createWorker, type Worker } from "tesseract.js";
import type { OcrLine } from "./parse";

// Text recognition runs here, on the computer serving the app. The English
// language data ships in node_modules (@tesseract.js-data/eng), so nothing is
// downloaded and no photo leaves the house.

let worker: Promise<Worker> | null = null;
let queue: Promise<unknown> = Promise.resolve();

function getWorker() {
  worker ??= createWorker("eng", 1, {
    langPath: path.join(
      /* turbopackIgnore: true */ process.cwd(),
      "node_modules/@tesseract.js-data/eng/4.0.0_best_int",
    ),
    gzip: true,
    cacheMethod: "none",
  });
  return worker;
}

/**
 * Reads a receipt photo. Returns the text lines (with where they sit on the
 * photo) and a smaller colour copy of the photo for the review screen.
 */
export async function readReceiptImage(input: Buffer) {
  // .rotate() applies the phone's orientation flag so the text is upright.
  const upright = sharp(input, { failOn: "none" }).rotate();
  const display = await upright
    .clone()
    .resize({ width: 1000, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  // Recognition works best on a large, high-contrast greyscale image.
  const forOcr = await upright
    .clone()
    .resize({ width: 1600 })
    .grayscale()
    .normalize()
    .png()
    .toBuffer({ resolveWithObject: true });

  const ocr = await getWorker();
  // One recognition at a time on the shared worker.
  const job = queue.then(() => ocr.recognize(forOcr.data, {}, { blocks: true }));
  queue = job.catch(() => undefined);
  const { data } = await job;

  const scale = display.info.width / forOcr.info.width;
  const lines: OcrLine[] = [];
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        lines.push({
          text: line.text.trim(),
          confidence: line.confidence,
          bbox: {
            x0: Math.round(line.bbox.x0 * scale),
            y0: Math.round(line.bbox.y0 * scale),
            x1: Math.round(line.bbox.x1 * scale),
            y1: Math.round(line.bbox.y1 * scale),
          },
        });
      }
    }
  }

  return {
    lines,
    image: display.data,
    width: display.info.width,
    height: display.info.height,
  };
}
