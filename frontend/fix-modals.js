const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/dashboard/pacientes/[id]/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('import { createPortal }')) {
  content = content.replace('"use client";\n', '"use client";\n\nimport { createPortal } from "react-dom";\n');
}

const portalComponent = `
function ClientPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
`;
if (!content.includes('function ClientPortal')) {
  content = content.replace('export default function PacienteDetailPage', portalComponent + '\nexport default function PacienteDetailPage');
}

const modalStates = [
  'testModalOpen',
  'editModalOpen',
  'selectedDocument',
  'virtualModalOpen',
  'documentModalOpen',
  'selectedInforme'
];

for (const state of modalStates) {
  const idx = content.indexOf(`{${state} && (`);
  if (idx !== -1) {
    const divIdx = content.indexOf('<div className="fixed inset-0 z-50', idx);
    if (divIdx !== -1 && divIdx - idx < 100) {
      content = content.slice(0, divIdx) + '<ClientPortal>\n        <div className="fixed inset-0 z-[9999]' + content.slice(divIdx + 34);
      
      let closeIdx = content.indexOf('      )}', divIdx);
      if (closeIdx !== -1) {
        const beforeClose = content.lastIndexOf('</div>', closeIdx);
        if (beforeClose !== -1) {
           content = content.slice(0, beforeClose + 6) + '\n        </ClientPortal>' + content.slice(beforeClose + 6);
        }
      }
    }
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Modals wrapped successfully!');
