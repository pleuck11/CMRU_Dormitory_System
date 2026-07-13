const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory() && !fullPath.includes('node_modules') && !fullPath.includes('.next')) {
            results = results.concat(walk(fullPath));
        } else if (fullPath.endsWith('.tsx')) {
            results.push(fullPath);
        }
    });
    return results;
}

const base = 'g:\\Github\\CMRU_Dormitory_System';
const files = walk(base);

files.forEach(function(file) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach(function(line, i) {
        const trimmed = line.trim();
        // Single line comments
        if (trimmed.startsWith('//')) {
            const commentText = trimmed.substring(2).trim();
            if (/[a-zA-Z]/.test(commentText) && !/[ก-ฮ]/.test(commentText) && commentText.length > 3) {
                if (!commentText.includes('{') && !commentText.includes('<') && !commentText.includes('=>') && !commentText.includes('import') && !commentText.startsWith('eslint') && !commentText.startsWith('@')) {
                    console.log(file.replace(base + '\\', '') + ':' + (i+1) + ' -> ' + commentText);
                }
            }
        }
        // JSX block comments {/* ... */}
        const jsxMatches = line.matchAll(/\{\/\*(.+?)\*\/\}/g);
        for (const m of jsxMatches) {
            const commentText = m[1].trim();
            if (/[a-zA-Z]/.test(commentText) && !/[ก-ฮ]/.test(commentText) && commentText.length > 3) {
                console.log('[JSX] ' + file.replace(base + '\\', '') + ':' + (i+1) + ' -> ' + commentText);
            }
        }
    });
});
