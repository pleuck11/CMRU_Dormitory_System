const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app', 'admin', 'report', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

content = content.replace(
  'import { useState } from "react";',
  `import { useState, useEffect } from "react";\nimport { PDFDownloadLink } from "@react-pdf/renderer";\nimport { ReportPDF } from "@/components/ReportPDF";`
);

content = content.replace(
  'const [reportData] = useState<ReportData[]>([]);',
  `const [reportData] = useState<ReportData[]>([]);\n  const [mounted, setMounted] = useState(false);\n\n  useEffect(() => {\n    setMounted(true);\n  }, []);`
);

content = content.replace(
  /const exportPDF = \(\) => {\s+window\.print\(\);\s+};\s+return \(\s+<div className="space-y-6 print:space-y-0 print:m-0 print:p-0 print:bg-white print:text-black">/,
  `return (\n    <div className="space-y-6">`
);

// Remove the entire print layout block
const printBlockStart = '{/* ============ Print Layout (แสดงเฉพาะตอนปริ้น) ============ */}';
const printBlockEnd = '{/* ============ หน้าจอปกติ (print:hidden) ============ */}';
const startIdx = content.indexOf(printBlockStart);
const endIdx = content.indexOf(printBlockEnd) + printBlockEnd.length;

if (startIdx !== -1 && endIdx !== -1) {
  content = content.substring(0, startIdx) + content.substring(endIdx);
}

// Remove print:hidden
content = content.replace(/print:hidden /g, '');
content = content.replace(/ print:hidden/g, '');

// Replace export PDF button
const oldButton = `<button onClick={exportPDF} className="glass-button flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold transition-all shadow-md group">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-y-0.5 transition-transform"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
            ส่งออก PDF
          </button>`;

const newButton = `{mounted && (
            <PDFDownloadLink
              document={<ReportPDF reportData={reportData} />}
              fileName={\`dormitory_report_\${new Date().getTime()}.pdf\`}
              className="glass-button flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold transition-all shadow-md group"
            >
              {({ loading }) => (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-y-0.5 transition-transform"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
                  {loading ? 'กำลังเตรียม...' : 'ส่งออก PDF'}
                </>
              )}
            </PDFDownloadLink>
          )}`;

content = content.replace(oldButton, newButton);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Successfully updated page.tsx');
