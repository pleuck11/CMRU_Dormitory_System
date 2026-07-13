const fs = require('fs');
const path = require('path');

function walk(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.next' || file === '.git') continue;
    const stat = fs.statSync(path.join(dir, file));
    if (stat.isDirectory()) {
      fileList = walk(path.join(dir, file), fileList);
    } else {
      if (file.endsWith('.tsx')) {
        fileList.push(path.join(dir, file));
      }
    }
  }
  return fileList;
}

const files = walk('./app').concat(walk('./components'));
const thaiRegex = /[\u0E00-\u0E7F]/;
const englishRegex = /[A-Za-z]/;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf-8');
  let match;
  
  // Single line comments
  const singleLineRegex = /(?<!:)\s*\/\/\s*(.*)$/gm;
  while ((match = singleLineRegex.exec(content)) !== null) {
      const text = match[1].trim();
      if(englishRegex.test(text) && !thaiRegex.test(text)) {
        const line = content.substring(0, match.index).split('\n').length;
        console.log(`[SL] ${file}:${line} ::: ${text}`);
      }
  }

  // JSX/Block comments
  const blockRegex = /(?:\{)?\/\*\s*([^]*?)\s*\*\/(?:\})?/g;
  while ((match = blockRegex.exec(content)) !== null) {
      const text = match[1].trim();
      if(englishRegex.test(text) && !thaiRegex.test(text)) {
         const line = content.substring(0, match.index).split('\n').length;
         console.log(`[BL] ${file}:${line} ::: ${text}`);
      }
  }
}
