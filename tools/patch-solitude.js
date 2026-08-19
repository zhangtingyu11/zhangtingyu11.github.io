const fs = require("node:fs");
const path = require("node:path");

const file = path.join(
  __dirname,
  "..",
  "node_modules",
  "hexo-renderer-stylus",
  "lib",
  "renderer.js"
);
const before = "const plugins = ['nib'].concat(config.plugins || []);";
const after = "const plugins = [].concat(config.plugins || []);";

if (!fs.existsSync(file)) process.exit(0);

const source = fs.readFileSync(file, "utf8");
if (source.includes(after)) process.exit(0);
if (!source.includes(before)) {
  throw new Error("Stylus renderer compatibility patch no longer matches; review the dependency update.");
}

fs.writeFileSync(file, source.replace(before, after));
console.log("Disabled legacy nib transforms for Solitude 4 CSS variables.");
