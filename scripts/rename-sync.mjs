import fs from "node:fs";
import path from "node:path";

const dirs = ["src", "extensions", "packages", "scripts", "loop-modules"];
let count = 0;

function walk(d) {
  let entries;
  try {
    entries = fs.readdirSync(d, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name !== "node_modules" && e.name !== "dist") walk(p);
    } else if (/\.(ts|mjs|js|json)$/.test(e.name)) {
      try {
        const buf = fs.readFileSync(p);
        const s = buf.toString("utf8");
        if (s.includes("MO_") || s.includes("mo")) {
          const n = s.replace(/MO_/g, "MO_").replace(/mo/g, "mo");
          fs.writeFileSync(p, n, "utf8");
          count++;
        }
      } catch {}
    }
  }
}

dirs.forEach((d) => walk(d));
console.log("Files updated:", count);
