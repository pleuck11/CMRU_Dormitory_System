const fs = require('fs');
const path = require('path');

// ค้นหาไฟล์ .tsx ทั้งหมดในโฟลเดอร์ที่กำหนด (ข้าม node_modules, .next, .git)
function walk(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    if (['node_modules', '.next', '.git'].includes(entry)) continue;
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fileList = walk(fullPath, fileList);
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const thaiRegex = /[\u0E00-\u0E7F]/;
const englishWordRegex = /[A-Za-z]{2,}/; // ต้องมีตัวอักษรอังกฤษอย่างน้อย 2 ตัวติดกัน

const files = walk('./app').concat(walk('./components')).concat(walk('./lib'));

let totalFound = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf-8');

  // จับ block comments ทุกรูปแบบ:
  //   /* ... */           (JS block comment)
  //   {/* ... */}         (JSX block comment - inline)
  //   {/*\n...\n*/}       (JSX block comment - multi-line)
  const blockRegex = /(?:\{)?\/\*\s*([\s\S]*?)\s*\*\/(?:\})?/g;

  let match;
  while ((match = blockRegex.exec(content)) !== null) {
    const commentText = match[1].trim();

    // ข้ามความคิดเห็นที่ว่างเปล่าหรือสั้นเกินไป
    if (commentText.length < 3) continue;

    // ข้ามถ้าไม่มีตัวอักษรอังกฤษ
    if (!englishWordRegex.test(commentText)) continue;

    // ข้ามถ้ามีภาษาไทยอยู่แล้ว (ถือว่าแปลแล้ว)
    if (thaiRegex.test(commentText)) continue;

    // ข้าม eslint/typescript directives และ code-like patterns
    if (
      commentText.startsWith('@') ||
      commentText.startsWith('eslint') ||
      commentText.startsWith('eslint-disable') ||
      commentText.includes('=>') ||
      commentText.includes('import ') ||
      commentText.includes('export ') ||
      /^[\w\s<>/=\[\]"'`{}()]+$/.test(commentText) && commentText.includes('<') // JSX-like
    ) continue;

    // คำนวณหมายเลขบรรทัด
    const lineNumber = content.substring(0, match.index).split('\n').length;
    const isMultiLine = commentText.includes('\n');
    const preview = commentText.replace(/\s+/g, ' ').substring(0, 100);

    const tag = isMultiLine ? '[BLOCK-ML]' : '[BLOCK]';
    console.log(`${tag} ${file}:${lineNumber} ::: ${preview}`);
    totalFound++;
  }
}

console.log(`\nพบ block comments ภาษาอังกฤษทั้งหมด: ${totalFound} รายการ`);
