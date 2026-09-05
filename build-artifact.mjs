/* A publikált artifact burkoló tageket (doctype/html/head/body) maga ad hozzá,
   ezért a kredit.html-ből azok nélkül kell kiszedni a tartalmat.
   Használat: node build-artifact.mjs > kredit-artifact.html */
import { readFileSync } from 'node:fs';
const src  = readFileSync(new URL('./kredit.html', import.meta.url), 'utf8');
const head = src.slice(src.indexOf('<title>'), src.indexOf('</head>')).trimEnd();
const body = src.slice(src.indexOf('<body>') + 6, src.indexOf('</body>')).trim();
process.stdout.write(head + '\n\n' + body + '\n');
