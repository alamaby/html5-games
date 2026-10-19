import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'src/style.css';
const DEAD = [
  '.mode-tag', '.top-options-drawer', '.mobile-only-btn',
  '.editor-inspector', '.panel-header', '.inspector-body', '.panel-title',
  '.snap-buttons', '.grid-snap-row', '.field-label', '.inspector-empty',
  '.empty-title', '.empty-desc', '.inspector-form', '.inspector-meta',
  '.field-group', '.xyz-row', '.param-field', '.params-container',
  '.inspector-actions', '.persistence-block', '.sub-heading',
  '.persistence-grid', '.editor-status-line', '.editor-dock',
  '.catalog-buttons', '.catalog-tile', '#json-textarea', '.json-feedback',
  '.modal-wide', '.btn-danger', '.btn-compact'
];

const src = readFileSync(FILE, 'utf8');
const lines = src.split(/\r?\n/);
const keep = [];
const removed = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const bare = line.trimEnd();
  const indent = line.length - line.trimStart().length;
  const isTopLevel = indent === 0 && bare.endsWith('{');
  const selector = isTopLevel ? bare.slice(0, -1).trim() : null;
  const match = selector && DEAD.find((d) => selector === d || selector.startsWith(d + ' ') || selector.startsWith(d + ':') || selector.startsWith(d + ',') || selector.startsWith(d + '.'));

  if (!match) { keep.push(line); continue; }

  // Walk to the matching close brace.
  let depth = 0;
  let end = i;
  for (; end < lines.length; end++) {
    for (const ch of lines[end]) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
    if (depth <= 0) break;
  }
  removed.push(`${i + 1}-${end + 1}  ${selector}`);

  // Drop a comment block that sat directly above the rule.
  while (keep.length && keep[keep.length - 1].trim() === '') keep.pop();
  if (keep.length && keep[keep.length - 1].trimEnd().endsWith('*/')) {
    let j = keep.length - 1;
    while (j >= 0 && !keep[j].trimStart().startsWith('/*')) j--;
    if (j >= 0) keep.length = j;
  }
  i = end;
}

const out = keep.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '\n');
writeFileSync(FILE, out);
console.log(`removed ${removed.length} rules:`);
console.log(removed.join('\n'));
console.log(`\n${src.split(/\r?\n/).length} lines -> ${out.split('\n').length} lines`);
