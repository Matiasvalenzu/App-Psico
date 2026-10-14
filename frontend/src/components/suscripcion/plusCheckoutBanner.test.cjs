require("sucrase/register");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const assert = require("node:assert/strict");
const test = require("node:test");
const { PlusCheckoutBanner, textoBotonPagoPlus } = require("./PlusCheckoutBanner.tsx");

function html(props) {
  return renderToStaticMarkup(React.createElement(PlusCheckoutBanner, props));
}

test("banner de prueba avisa cobro inmediato y fin de la prueba", () => {
  const markup = html({ plan: "plus", isTrial: true, enEstandarPagado: false, monto: 9990 });
  assert.match(markup, /data-testid="plus-cobro-banner"/);
  assert.match(markup, /Al confirmar, el cobro de \$9\.990 empieza hoy y se terminan tus días de prueba\./);
  assert.doesNotMatch(markup, /plus-cobro-nota/);
  assert.doesNotMatch(markup, /destructive/);
  assert.match(markup, /<svg/);
});

test("banner de Estándar pagado avisa el pase y la cancelación del cobro anterior", () => {
  const markup = html({ plan: "plus", isTrial: false, enEstandarPagado: true, monto: 9990 });
  assert.match(markup, /Al confirmar, pasas a Plus y el cobro de \$9\.990 empieza hoy\./);
  assert.match(markup, /data-testid="plus-cobro-nota"/);
  assert.match(markup, /Tu suscripción Estándar se cancela al confirmar, para no cobrarte dos veces\./);
});

test("sin plan no muestra banner", () => {
  assert.equal(html({ plan: "plus", isTrial: false, enEstandarPagado: false, monto: 9990 }), "");
});

test("el botón de Plus cobra ahora", () => {
  assert.equal(textoBotonPagoPlus(9990), "Pagar $9.990 ahora");
});
