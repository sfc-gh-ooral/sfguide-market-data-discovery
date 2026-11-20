// Checks every text/background pair the app uses against WCAG AA (docs/DESIGN.md).
//   node scripts/check-contrast.mjs
const T = {
  light: { bg: '#EEF3F7', surface: '#FFFFFF', surface2: '#F5F8FB', ink: '#0E1B2C', muted: '#4E5D70', link: '#1F5FA8', rasp: '#B0245A', saffron: '#8A5600', moss: '#2E6B36' },
  dark: { bg: '#0A1320', surface: '#111D2E', surface2: '#16243A', ink: '#E6EDF5', muted: '#93A3B8', link: '#8DB8EA', rasp: '#F06A98', saffron: '#E5B04A', moss: '#6CC27A' },
};
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (h) => { const [r, g, b] = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (fg, bg, a) => '#' + rgb(fg).map((v, i) => Math.round(v * a + rgb(bg)[i] * (1 - a)).toString(16).padStart(2, '0')).join('');
let fail = 0;
const check = (name, fg, bg, min = 4.5) => { const r = ratio(fg, bg); if (r < min) fail++; console.log(`${r >= min ? 'ok  ' : 'FAIL'} ${r.toFixed(2).padStart(5)}  ${name}`); };
for (const [mode, t] of Object.entries(T)) {
  for (const fg of ['ink', 'muted', 'link', 'rasp', 'saffron', 'moss']) for (const bg of ['bg', 'surface', 'surface2']) check(`${mode} ${fg} on ${bg}`, t[fg], t[bg]);
  // Status pills: accent text on a 14% tint of itself over the surface.
  for (const fg of ['link', 'rasp', 'saffron', 'moss']) check(`${mode} ${fg} pill`, t[fg], mix(t[fg], t.surface, 0.14));
  check(`${mode} white on harbor button`, '#FFFFFF', '#12355B');
  check(`${mode} rail label on harbor`, '#C9DCF0', '#12355B');
}
process.exit(fail ? 1 : 0);
