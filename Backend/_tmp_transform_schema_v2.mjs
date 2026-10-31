// TEMPORARY — corrected transform. Processes each LINE independently (so a
// stray apostrophe in one line/comment, e.g. "doesn't", can never desync
// quote-tracking for the rest of the file — the bug in v1). Within each
// line: find the SQL comment marker `--` while tracking real SQL string
// quoting (SQL uses '' to escape a quote inside a string, never backslash)
// so a `--` that happens to appear inside a string literal isn't mistaken
// for a comment start. Code before that point gets string-literal-safe
// identifier replacement; the comment portion (if any) gets a direct
// identifier replacement with no quote-awareness needed, since there are
// no real SQL string literals in a comment.
import fs from "fs";

const dict = JSON.parse(fs.readFileSync("_tmp_rename_dict.json", "utf8"));
const merged = { ...dict.constraints, ...dict.indexes, ...dict.tables, ...dict.columns };
const keys = Object.keys(merged).sort((a, b) => b.length - a.length);
const pattern = new RegExp(`\\b(${keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "g");

function replaceIdentifiers(text) {
  return text.replace(pattern, (m) => merged[m] ?? m);
}

// Splits one line into { code, comment } at the first `--` that is not
// inside a single-quoted SQL string literal on that line.
function splitLine(line) {
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'") {
      if (inString && line[i + 1] === "'") {
        i++; // escaped '' inside a string — stays in string, skip both chars
        continue;
      }
      inString = !inString;
      continue;
    }
    if (!inString && ch === "-" && line[i + 1] === "-") {
      return { code: line.slice(0, i), comment: line.slice(i) };
    }
  }
  return { code: line, comment: "" };
}

// Applies the identifier transform to `code`, protecting single-quoted
// string literals (SQL '' escaping) from being touched.
function transformCode(code) {
  const parts = [];
  let cur = "";
  let inString = false;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch === "'") {
      if (inString && code[i + 1] === "'") {
        cur += "''";
        i++;
        continue;
      }
      if (inString) {
        cur += ch;
        parts.push({ str: true, text: cur });
        cur = "";
        inString = false;
      } else {
        parts.push({ str: false, text: cur });
        cur = ch;
        inString = true;
      }
      continue;
    }
    cur += ch;
  }
  parts.push({ str: inString, text: cur });
  return parts.map((p) => (p.str ? p.text : replaceIdentifiers(p.text))).join("");
}

function transformFile(content) {
  return content
    .split("\n")
    .map((line) => {
      const { code, comment } = splitLine(line);
      return transformCode(code) + (comment ? replaceIdentifiers(comment) : "");
    })
    .join("\n");
}

const files = process.argv.slice(2);

for (const f of files) {
  const before = fs.readFileSync(f, "utf8");
  const after = transformFile(before);
  fs.writeFileSync(f, after, "utf8");
  console.log(`Transformed ${f}`);
}
