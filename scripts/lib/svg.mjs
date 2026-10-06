// Minimal SVG histogram: the null distribution as bars, the real connectome as a lime line.
// Colours match the site. Written by hand so the repo needs no plotting dependency.
export function histogram({ title, xlabel, groups, real, bins = 24, width = 640, height = 260 }) {
  const all = groups.flatMap((g) => g.values).concat([real]);
  let lo = Math.min(...all), hi = Math.max(...all);
  if (hi === lo) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.05; lo -= pad; hi += pad;
  const m = { l: 48, r: 16, t: 36, b: 44 };
  const W = width - m.l - m.r, H = height - m.t - m.b;
  const bw = (hi - lo) / bins;
  const counted = groups.map((g) => { const c = new Array(bins).fill(0); for (const v of g.values) c[Math.min(bins - 1, Math.floor((v - lo) / bw))]++; return c; });
  const maxC = Math.max(1, ...counted.flat());
  const x = (v) => m.l + ((v - lo) / (hi - lo)) * W;
  const y = (c) => m.t + H - (c / maxC) * H;
  let bars = "";
  counted.forEach((c, gi) => c.forEach((n, i) => {
    if (!n) return;
    const x0 = x(lo + i * bw), x1 = x(lo + (i + 1) * bw);
    bars += `<rect x="${x0.toFixed(1)}" y="${y(n).toFixed(1)}" width="${Math.max(1, x1 - x0 - 1).toFixed(1)}" height="${(m.t + H - y(n)).toFixed(1)}" fill="${groups[gi].color}" fill-opacity="0.75"/>`;
  }));
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad].map((v) => `<text x="${x(v).toFixed(1)}" y="${height - 24}" text-anchor="middle">${v.toFixed(3)}</text>`).join("");
  const legend = groups.map((g, i) => `<rect x="${m.l + i * 170}" y="${height - 14}" width="10" height="10" fill="${g.color}"/><text x="${m.l + 14 + i * 170}" y="${height - 5}">${g.label}</text>`).join("") +
    `<rect x="${m.l + groups.length * 170}" y="${height - 14}" width="10" height="10" fill="#c9ff2e"/><text x="${m.l + 14 + groups.length * 170}" y="${height - 5}">real wiring</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="ui-monospace, Menlo, monospace" font-size="11" fill="#a09db4">
<rect width="100%" height="100%" fill="#03050f"/>
<text x="${m.l}" y="20" fill="#ece8e1" font-size="13">${title}</text>
<line x1="${m.l}" y1="${m.t + H}" x2="${m.l + W}" y2="${m.t + H}" stroke="#a09db4" stroke-width="0.5"/>
${bars}
<line x1="${x(real).toFixed(1)}" y1="${m.t - 4}" x2="${x(real).toFixed(1)}" y2="${m.t + H}" stroke="#c9ff2e" stroke-width="2"/>
${ticks}<text x="${m.l + W}" y="20" text-anchor="end">${xlabel}</text>
${legend}
</svg>
`;
}
