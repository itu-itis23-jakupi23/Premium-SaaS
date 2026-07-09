const fs = require("fs"), path = require("path");
const base = path.join(__dirname, "../src/i18n/locales");

function deepMerge(target, source) {
  const out = Object.assign({}, target);
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      out[key] = deepMerge(typeof target[key] === "object" && target[key] !== null ? target[key] : {}, source[key]);
    } else if (!(key in target)) {
      out[key] = source[key];
    }
  }
  return out;
}

const enRaw = fs.readFileSync(path.join(base, "en.json"), "utf8").replace(/^﻿/, "");
const en = JSON.parse(enRaw);
const langs = ["ar","de","es","fr","it","ja","nl","pt","tr","zh"];

for (const lang of langs) {
  const filePath = path.join(base, lang + ".json");
  const raw = fs.readFileSync(filePath, "utf8").replace(/^﻿/, "");
  const data = JSON.parse(raw);
  const merged = deepMerge(data, en);
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf8");
  console.log(lang + " OK");
}
