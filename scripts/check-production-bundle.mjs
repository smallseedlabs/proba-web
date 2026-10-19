// Fails if development-only demo data or prototype wording leaks into the
// production bundle. Run after `npm run build`.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const FORBIDDEN = [/Northwind/, /DemoTransport/, /DemoAuthClient/, /local-session/, /\bmock\b/i, /fixture/i, /dev login/i, /\balpha\b/i, /\bbeta\b/i];

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.(js|html|css)$/.test(entry.name)) files.push(path);
  }
};
walk(DIST);

const problems = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const pattern of FORBIDDEN) {
    const match = text.match(pattern);
    if (match) problems.push(`${file}: found "${match[0]}"`);
  }
}

if (problems.length > 0) {
  console.error('Production bundle check failed:\n' + problems.join('\n'));
  process.exit(1);
}
console.log(`Production bundle check passed (${files.length} files scanned).`);
