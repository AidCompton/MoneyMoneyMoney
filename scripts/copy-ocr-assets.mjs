// Copies the receipt-reading engine into public/ocr so the app serves it
// itself (tesseract.js would otherwise fetch it from a public CDN). Runs
// before `npm run dev` and `npm run build`; public/ocr is not committed.
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

const out = path.join("public", "ocr");
const files = [
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js"],
  // Only the LSTM engines are used; the phone picks the fastest one it supports.
  ["node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js", "core/tesseract-core-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "core/tesseract-core-simd-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js", "core/tesseract-core-relaxedsimd-lstm.wasm.js"],
  ["node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "lang/eng.traineddata.gz"],
];

for (const [from, to] of files) {
  const target = path.join(out, to);
  if (!existsSync(from)) {
    console.error(`Missing ${from}. Run npm install.`);
    process.exit(1);
  }
  if (existsSync(target) && statSync(target).size === statSync(from).size) continue;
  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(from, target);
}
