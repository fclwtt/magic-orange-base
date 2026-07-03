import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const TARGET_EXTENSIONS = ['.ts', '.js', '.json', '.yaml', '.yml'];
const REPLACEMENTS = [
  { from: 'MO_', to: 'MO_' },
  // 注意：不替换 @mo/* 包名，保留内部 npm 包名
];

function walkDir(dir) {
  const results = [];
  const list = readdirSync(dir);
  for (const file of list) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist') {
        results.push(...walkDir(filePath));
      }
    } else {
      if (TARGET_EXTENSIONS.includes(extname(file))) {
        results.push(filePath);
      }
    }
  }
  return results;
}

function processFile(filePath) {
  let content = readFileSync(filePath, 'utf8');
  let modified = false;
  
  for (const { from, to } of REPLACEMENTS) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      modified = true;
    }
  }
  
  if (modified) {
    writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

const srcDir = process.argv[2] || 'src';
console.log(`Processing directory: ${srcDir}`);

const files = walkDir(srcDir);
console.log(`Found ${files.length} files to process`);

let updatedCount = 0;
for (const file of files) {
  try {
    processFile(file);
    updatedCount++;
  } catch (err) {
    console.error(`Error processing ${file}:`, err.message);
  }
}

console.log(`\nProcessed ${updatedCount} files`);
