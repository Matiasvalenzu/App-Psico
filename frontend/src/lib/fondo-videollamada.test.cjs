require("sucrase/register");
const assert = require("node:assert/strict");
const test = require("node:test");
const f = require("./fondo-videollamada.ts");

test("hay sin efecto, 2 difuminados y 5 fondos", () => {
  assert.equal(f.FONDOS[0].id, "ninguno");
  assert.equal(f.FONDOS.filter((o) => o.efecto.tipo === "difuminar").length, 2);
  assert.equal(f.FONDOS.filter((o) => o.efecto.tipo === "imagen").length, 5);
});

test("la preferencia se guarda y un valor inválido vuelve a sin efecto", () => {
  const mem = {};
  const s = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => (mem[k] = v) };
  assert.equal(f.leerFondoGuardado(s), "ninguno");
  f.guardarFondo("biblioteca", s);
  assert.equal(f.leerFondoGuardado(s), "biblioteca");
  mem[f.FONDO_STORAGE_KEY] = "otro";
  assert.equal(f.leerFondoGuardado(s), "ninguno");
});

test("tamaño de salida y recorte cover", () => {
  assert.deepEqual(f.tamanoSalida(1280, 720), { width: 640, height: 360 });
  assert.deepEqual(f.tamanoSalida(720, 1280), { width: 360, height: 640 });
  const c = f.cubrir(1000, 1000, 640, 360);
  assert.equal(c.sw, 1000);
  assert.equal(Math.round(c.sh), 563);
});
