const test = require("node:test");
const assert = require("node:assert");
const { normalizarDocumento } = require("./seguimiento.ts");
test("brief vacío ({} o null) queda como null", () => {
  assert.strictEqual(normalizarDocumento({}), null);
  assert.strictEqual(normalizarDocumento(null), null);
  assert.strictEqual(normalizarDocumento(""), null);
});
test("documento sin advertencias recibe lista vacía", () => {
  const d = normalizarDocumento({ id: 1, estado: "LISTO", advertencias: null, contenido: "x" });
  assert.deepStrictEqual(d.advertencias, []);
});
