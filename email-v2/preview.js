// Writes email-v2/preview.html with this week's real games. Sends nothing.
// Usage (from the repo root): node email-v2/preview.js
const fs = require("fs");
const path = require("path");
const { fetchItems } = require("./items");
const { buildHtml, buildText } = require("./template");

(async () => {
  const items = await fetchItems();
  const out = path.join(__dirname, "preview.html");
  fs.writeFileSync(out, buildHtml(items));
  fs.writeFileSync(path.join(__dirname, "preview.txt"), buildText(items));
  console.log(`${items.length} games -> ${out}`);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
