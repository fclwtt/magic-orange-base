const fs = require('fs');
const path = require('path');

const exts = fs.readdirSync('extensions').filter(d =>
  fs.statSync(path.join('extensions', d)).isDirectory()
);

const allDeps = new Set();
exts.forEach(d => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join('extensions', d, 'package.json'), 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    Object.entries(deps).forEach(([k, v]) => {
      if (k.startsWith('@openclaw/') && String(v).startsWith('workspace')) {
        allDeps.add(k);
      }
    });
  } catch (e) {}
});

console.log('Workspace deps needed by extensions:');
[...allDeps].sort().forEach(d => console.log(d));

// Check which are present in packages/
const packages = fs.readdirSync('packages').filter(d =>
  fs.statSync(path.join('packages', d)).isDirectory()
);
console.log('\nPackages present:');
packages.forEach(p => console.log(`  @openclaw/${p}`));

// Check missing
const missing = [...allDeps].filter(d => {
  const pkgName = d.replace('@openclaw/', '');
  return !packages.includes(pkgName);
});
console.log('\nMissing packages:');
missing.forEach(m => console.log(`  ${m}`));
