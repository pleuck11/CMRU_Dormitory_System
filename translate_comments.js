const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
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

const files = walk('app');

const translations = {
    "// Render tenant's dashboard component": "// แสดงคอมโพเนนต์แดชบอร์ดของผู้เช่า",
    "// You can map through data to show more cards": "// คุณสามารถวนลูปข้อมูลเพื่อแสดงการ์ดเพิ่มเติม",
    "// Example Action button": "// ตัวอย่างปุ่มการจัดการ",
    "// Action buttons based on status": "// ปุ่มจัดการตามสถานะ",
    "// ... other tenant components": "// ... คอมโพเนนต์อื่่นๆ ของผู้เช่า",
    "// Main Layout component": "// คอมโพเนนต์ Layout หลัก",
    "// Navigation links": "// ลิงก์นำทาง",
    "// User context from DB": "// ข้อมูลผู้ใช้จากฐานข้อมูล",
    "// Handle Request Room": "// ฟังก์ชันจัดการคำขอจองห้อง",
    "// Success messages": "// ข้อความสำเร็จ",
    "// Loading state": "// สถานะกำลังโหลด",
    "// Modal for confirmation": "// กล่องยืนยันการทำรายการ",
    "// Basic user profile": "// ข้อมูลโปรไฟล์ทั่วไป",
    "// Update user profile": "// อัปเดตโปรไฟล์ผู้ใช้",
    "// Can be updated if we track move-in dates in the future": "// สามารถอัปเดตได้หากเรามีการเก็บวันที่เข้าพักในอนาคต",
    "// Keep 'any' only if absolutely needed, but usually Firebase Timestamp works": "// ใช้ 'any' เฉพาะเมื่อจำเป็นเท่านั้น, แต่โดยปกติแล้ว Firebase Timestamp สามารถทำงานได้ดี"
};

let modifiedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let hasChanges = false;
    let lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Exact dictionary replacements for known comments
        Object.keys(translations).forEach(eng => {
            if (line.includes(eng)) {
                lines[i] = line.replace(eng, translations[eng]);
                hasChanges = true;
            }
        });

        // Heuristic fallback for untranslated english comments
        const trimmed = line.trim();
        if (trimmed.startsWith('//')) {
            const commentText = trimmed.substring(2).trim();
            // If it contains english letters and no thai letters, log it so we can translate it manually if needed
            if (/[a-zA-Z]/.test(commentText) && !/[ก-ฮ]/.test(commentText) && commentText.length > 5) {
                // exclude common code-like comments
                if (!commentText.includes('{') && !commentText.includes('<') && !commentText.includes('=>') && !commentText.includes('import')) {
                    console.log(`Unmatched English comment in ${file}:${i+1} -> ${commentText}`);
                }
            }
        }
    }

    if (hasChanges) {
        fs.writeFileSync(file, lines.join('\n'), 'utf8');
        modifiedCount++;
        console.log(`Translated comments in ${file}`);
    }
});

console.log(`Total files modified: ${modifiedCount}`);
