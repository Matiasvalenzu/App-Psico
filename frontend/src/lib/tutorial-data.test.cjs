require("sucrase/register");
const assert = require("node:assert/strict");
const test = require("node:test");
const { TUTORIALES, tutorialForPath } = require("./tutorial-data.ts");

test("hay 14 tutoriales y Mi Suscripción no tiene video", () => {
  assert.equal(TUTORIALES.length, 14);
  assert.equal(TUTORIALES.some((video) => video.slug === "suscripcion"), false);
  assert.equal(tutorialForPath("/dashboard/suscripcion"), null);
});

test("cada ruta abre el video de su sección", () => {
  assert.equal(tutorialForPath("/dashboard"), "pacientes");
  assert.equal(tutorialForPath("/dashboard/pacientes"), "pacientes");
  assert.equal(tutorialForPath("/dashboard/pacientes/12"), "ficha");
  assert.equal(tutorialForPath("/dashboard/pacientes/12/sesiones/4"), null);
  assert.equal(tutorialForPath("/dashboard/pacientes/12/sesiones/4/sala"), "sesion-virtual");
  assert.equal(tutorialForPath("/dashboard/configuracion/perfil"), "perfil");
  assert.equal(tutorialForPath("/dashboard/configuracion/boletas"), "boletas-config");
  assert.equal(tutorialForPath("/dashboard/configuracion/privacidad"), "privacidad");
  assert.equal(tutorialForPath("/dashboard/tests"), "tests");
  assert.equal(tutorialForPath("/dashboard/agenda"), "agenda");
  assert.equal(tutorialForPath("/dashboard/voz"), "voz");
  assert.equal(tutorialForPath("/dashboard/feedback"), "feedback");
  assert.equal(tutorialForPath("/dashboard/usuarios"), null);
});
