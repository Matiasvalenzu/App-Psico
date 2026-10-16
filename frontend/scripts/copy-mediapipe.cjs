// Copia los .wasm de @mediapipe/tasks-vision a public/mediapipe/wasm para servirlos
// desde el mismo origen (sin CDN). Se ejecuta antes de dev y build; no se versionan.
const fs = require("fs");
const path = require("path");
const src = path.join(__dirname, "..", "node_modules", "@mediapipe", "tasks-vision", "wasm");
const dst = path.join(__dirname, "..", "public", "mediapipe", "wasm");
fs.mkdirSync(dst, { recursive: true });
for (const f of ["vision_wasm_internal.js", "vision_wasm_internal.wasm", "vision_wasm_nosimd_internal.js", "vision_wasm_nosimd_internal.wasm"]) {
  fs.copyFileSync(path.join(src, f), path.join(dst, f));
}
console.log("mediapipe wasm copiado a public/mediapipe/wasm");
