// Medians per label and phase of an ab-*.sh log: total / renderer / fabric ms (and, when the
// instrument splits it, Fabric's createNode, completeRoot and appendChild), and MB allocated.
import { readFileSync } from 'node:fs';
const med = (a) => {
  const s = a.filter((x) => !Number.isNaN(x)).sort((x, y) => x - y);
  return s.length ? s[s.length >> 1] : NaN;
};
const g = {};
const re =
  /(\w+): ([\d.]+)ms \(renderer ([\d.]+), fabric ([\d.]+)(?: \[create ([\d.]+), complete ([\d.]+)(?:, append ([\d.]+))?\])?, gc ([\d.]+), ([\d.]+)MB/g;
for (const line of readFileSync(process.argv[2], 'utf8').split('\n')) {
  const label = line.split(' ')[0];
  for (const m of line.matchAll(re)) {
    const k = ((g[label] ??= {})[m[1]] ??= {
      n: 0,
      t: [],
      r: [],
      f: [],
      c: [],
      d: [],
      a: [],
      mb: [],
    });
    k.n++;
    k.t.push(+m[2]);
    k.r.push(+m[3]);
    k.f.push(+m[4]);
    k.c.push(+(m[5] ?? NaN));
    k.d.push(+(m[6] ?? NaN));
    k.a.push(+(m[7] ?? NaN));
    k.mb.push(+m[9]);
  }
}
const labels = Object.keys(g);
const split = labels.some((l) =>
  Object.values(g[l]).some((k) => k.c.some((x) => !Number.isNaN(x))),
);
const appends = labels.some((l) =>
  Object.values(g[l]).some((k) => k.a.some((x) => !Number.isNaN(x))),
);
const phases = [...new Set(labels.flatMap((l) => Object.keys(g[l])))];
const head = split
  ? `total / renderer / fabric [create, complete${appends ? ', append' : ''}] ms, MB`
  : 'total / renderer / fabric ms, MB';
console.log(`| phase | ${labels.map((l) => `${l}: ${head}`).join(' | ')} |`);
console.log(`| --- | ${labels.map(() => '---').join(' | ')} |`);
const f = (x) => x.toFixed(1);
for (const p of phases) {
  console.log(
    `| ${p} | ${labels
      .map((l) => {
        const k = g[l][p];
        if (!k) return '-';
        const a = appends ? `, ${f(med(k.a))}` : '';
        const s = split ? ` [${f(med(k.c))}, ${f(med(k.d))}${a}]` : '';
        return `${f(med(k.t))} / ${f(med(k.r))} / ${f(med(k.f))}${s}, ${f(med(k.mb))}`;
      })
      .join(' | ')} |`,
  );
}
console.log(
  `(n = ${labels.map((l) => `${l} ${Math.max(...Object.values(g[l]).map((k) => k.n))}`).join(', ')})`,
);
