const fs = require('fs');
const path = require('path');

const exts = fs.readdirSync('extensions');
let fixedCount = 0;

exts.forEach(e => {
  const pkgPath = path.join('extensions', e, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    let modified = false;
    
    // Fix dependencies
    if (pkg.dependencies && pkg.dependencies.openclaw) {
      pkg.dependencies['magic-orange-base'] = pkg.dependencies.openclaw;
      delete pkg.dependencies.openclaw;
      modified = true;
    }
    
    // Fix devDependencies
    if (pkg.devDependencies && pkg.devDependencies.openclaw) {
      pkg.devDependencies['magic-orange-base'] = pkg.devDependencies.openclaw;
      delete pkg.devDependencies.openclaw;
      modified = true;
    }
    
    // Fix peerDependencies
    if (pkg.peerDependencies && pkg.peerDependencies.openclaw) {
      pkg.peerDependencies['magic-orange-base'] = '>=0.1.0';
      delete pkg.peerDependencies.openclaw;
      modified = true;
    }
    
    // Fix peerDependenciesMeta
    if (pkg.peerDependenciesMeta && pkg.peerDependenciesMeta.openclaw) {
      pkg.peerDependenciesMeta['magic-orange-base'] = pkg.peerDependenciesMeta.openclaw;
      delete pkg.peerDependenciesMeta.openclaw;
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
      console.log('Fixed: ' + e);
      fixedCount++;
    }
  }
});

console.log('\nFixed ' + fixedCount + ' extensions');
