// TODO(revisión legal): revisar con abogado antes de cambiar estas filas. Deben coincidir con la app.
const PROVIDERS = [
  {
    name: "Servidor de Psiconex",
    receives: "Los datos de tu cuenta y de tus pacientes. El audio, solo mientras se transcribe.",
    purpose: "Guardar tu información, transcribir el audio y operar la plataforma.",
    when: "Siempre. Diagnóstico, medicación, notas y firmas se guardan cifrados. El audio se elimina al terminar la transcripción.",
  },
  {
    name: "Deepgram",
    receives: "El audio de las sesiones grabadas o subidas desde el navegador, por HTTPS.",
    purpose: "Separar las voces (quién habla). Solo usamos los turnos de habla.",
    when: "Automáticamente, al procesar cada sesión de audio. Procesa el audio en Estados Unidos. Le indicamos que no lo use para mejorar sus modelos.",
  },
  {
    name: "DeepSeek",
    receives: "Texto de la sesión y datos de la ficha (por ejemplo motivo de consulta, diagnóstico sospechado o medicación), sin el nombre del paciente.",
    purpose: "Chat por paciente, informes y observación de tests con IA.",
    when: "Solo cuando usas esas funciones.",
  },
  {
    name: "Google",
    receives: "Datos de tu agenda, y tu nombre y correo si inicias sesión con Google.",
    purpose: "Sincronizar tus citas con Google Calendar e iniciar sesión.",
    when: "Solo si conectas tu cuenta. Nunca se envían a la IA.",
  },
  {
    name: "Mercado Pago",
    receives: "Los datos de pago de tu suscripción.",
    purpose: "Cobrar la suscripción.",
    when: "Al suscribirte. Psiconex no almacena los datos de tu tarjeta.",
  },
  {
    name: "SII",
    receives: "Nombre, RUT y dirección del receptor de la boleta (paciente o tutor) y el monto.",
    purpose: "Emitir tus boletas de honorarios. Psiconex actúa como usuario autorizado por ti; nunca pide ni guarda tu clave del SII.",
    when: "Solo en el Plan Plus, cuando confirmas cada boleta.",
  },
  {
    name: "Brevo",
    receives: "Nombre y correo del destinatario, y el contenido del aviso (por ejemplo la fecha y hora de una cita, el nombre de un test enviado o el mensaje que tú escribas).",
    purpose: "Enviar correos: recordatorios de citas, consentimientos, tests y avisos de tu cuenta.",
    when: "Al enviar cada correo. No incluye fichas, notas, diagnósticos ni transcripciones.",
  },
]

export function ProvidersTable() {
  return (
    <>
      <div
        role="region"
        aria-label="Proveedores y qué recibe cada uno"
        className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block"
      >
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Servicio</th>
              <th scope="col" className="px-4 py-3 font-semibold">Qué recibe</th>
              <th scope="col" className="px-4 py-3 font-semibold">Para qué</th>
              <th scope="col" className="px-4 py-3 font-semibold">Cuándo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-muted-foreground">
            {PROVIDERS.map((p) => (
              <tr key={p.name} className="align-top">
                <th scope="row" className="px-4 py-3 font-medium text-foreground">{p.name}</th>
                <td className="px-4 py-3">{p.receives}</td>
                <td className="px-4 py-3">{p.purpose}</td>
                <td className="px-4 py-3">{p.when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul aria-label="Proveedores y qué recibe cada uno" className="space-y-3 md:hidden">
        {PROVIDERS.map((p) => (
          <li key={p.name} className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">{p.name}</p>
            <dl className="mt-2 space-y-2">
              <div><dt className="font-medium text-foreground/80">Qué recibe</dt><dd>{p.receives}</dd></div>
              <div><dt className="font-medium text-foreground/80">Para qué</dt><dd>{p.purpose}</dd></div>
              <div><dt className="font-medium text-foreground/80">Cuándo</dt><dd>{p.when}</dd></div>
            </dl>
          </li>
        ))}
      </ul>

      <ul className="mt-5 space-y-1.5 text-sm text-muted-foreground">
        <li>La separación de voces se aplica automáticamente a las sesiones de audio. El chat, los informes y la observación de tests con IA los solicitas tú.</li>
        <li>Las sesiones por Meet o Zoom registradas con la extensión de Chrome usan los subtítulos de la llamada, no el audio.</li>
        <li>Cada proveedor procesa y conserva los datos según sus propias condiciones.</li>
      </ul>
    </>
  )
}
