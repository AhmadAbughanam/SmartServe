import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const replacements = [
  { pattern: /const COPPER = ".*";/g, replace: 'const COPPER = "#0c0a09";' },
  { pattern: /const COPPER_SOFT = ".*";/g, replace: 'const COPPER_SOFT = "#f5f5f4";' },
  { pattern: /const COPPER_EDGE = ".*";/g, replace: 'const COPPER_EDGE = "#e7e5e4";' },
  { pattern: /const COPPER_INK = ".*";/g, replace: 'const COPPER_INK = "#1c1917";' },
  { pattern: /const COPPER_DEEP = ".*";/g, replace: 'const COPPER_DEEP = "#000000";' }
];

function walkDir(dir) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walkDir(fullPath));
    } else if (entry.isFile() && fullPath.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

const rootDir = path.join(__dirname, '..', 'apps', 'web', 'src');
const files = walkDir(rootDir);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;
  replacements.forEach(({pattern, replace}) => {
    if (pattern.test(content)) {
      content = content.replace(pattern, replace);
      modified = true;
    }
  });
  if (modified) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated', file);
  }
});
