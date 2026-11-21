export const $ = id => document.getElementById(id);

export function node(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text != null && text !== '') item.textContent = text;
  return item;
}

// Each icon is a list of paths; a path starting with "fill:" is filled instead of stroked.
const icons = {
  sunrise: ['fill:M5 15a7 7 0 0 1 14 0Z', 'M3 18h18M7 21h10'],
  calendar: ['M7 3v4m10-4v4M4 10h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z'],
  chart: ['M4 19h16M5 15l4-4 3 3 7-7m-4 0h4v4'],
  sliders: ['M4 7h10m4 0h2M4 17h4m4 0h8', 'M18 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM12 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z'],
  system: ['M4 5h16v11H4zM9 20h6m-3-4v4'],
  sun: ['M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2'],
  moon: ['M20.5 15A8.8 8.8 0 0 1 9 3.5 8.8 8.8 0 1 0 20.5 15Z'],
  left: ['M15 5l-7 7 7 7'],
  right: ['m9 5 7 7-7 7'],
  down: ['m6 9 6 6 6-6'],
  arrow: ['M5 12h14m-6-6 6 6-6 6'],
  close: ['m6 6 12 12M18 6 6 18'],
  share: ['M12 15V3m-4 4 4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7'],
  external: ['M13 5h6v6m0-6-9 9m-1-8H6a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-3'],
  check: ['m5 12 5 5L20 7'],
  cross: ['m7 7 10 10M17 7 7 17'],
  india: ['M3 9h18L12 3 3 9Zm2 11h14M6 20V9m6 11V9m6 11V9'],
  world: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM2 12h20M12 2a16 16 0 0 1 0 20m0-20a16 16 0 0 0 0 20'],
  markets: ['M4 4v16h16M7 15l4-5 4 2 5-6m-4 0h4v4'],
  investing: ['M5 20V9m5 11V4m5 16v-7m5 7V7'],
  tech: ['M7 7h10v10H7zM4 9h3m-3 6h3m10-6h3m-3 6h3M9 4v3m6-3v3m-6 10v3m6-3v3'],
  mind: ['M7 19v-2c-1.9-1.3-3-3.4-3-5.7a7 7 0 0 1 14-.7l2 3.4h-3v5h-5v2m-3-10a2 2 0 0 1 4 0'],
  marketing: ['M3 10v4h4l3 6h3l-2-6 10 3V7l-10 3H3Zm4 0v4m4-4v4'],
  done: ['fill:M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Z', 'stroke-bg:m7.5 12.5 3 3 6-6.5']
};

export function setIcon(slot, name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  for (const entry of icons[name] ?? []) {
    const [mode, d] = entry.includes(':') ? entry.split(':') : ['stroke', entry];
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', d);
    if (mode === 'fill') path.setAttribute('fill', 'currentColor');
    else {
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', mode === 'stroke-bg' ? 'var(--bg)' : 'currentColor');
      path.setAttribute('stroke-width', mode === 'stroke-bg' ? '2.2' : '1.75');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
    }
    svg.append(path);
  }
  slot.setAttribute('aria-hidden', 'true');
  slot.replaceChildren(svg);
  return slot;
}
export const icon = (name, className = 'icon') => setIcon(node('span', className), name);
export const hydrateIcons = (root = document) => {
  for (const slot of root.querySelectorAll('[data-icon]')) setIcon(slot, slot.dataset.icon);
};
