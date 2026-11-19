export const $ = id => document.getElementById(id);

export function node(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text != null && text !== '') item.textContent = text;
  return item;
}

const paths = {
  calendar: 'M7 3v4m10-4v4M4 10h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  settings: 'M4 7h16M4 12h16M4 17h16M8 5v4m8 1v4m-6 1v4',
  system: 'M4 5h16v11H4zM9 20h6m-3-4v4',
  sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2',
  moon: 'M20.5 15A8.8 8.8 0 0 1 9 3.5 8.8 8.8 0 1 0 20.5 15Z',
  left: 'M15 5l-7 7 7 7',
  right: 'm9 5 7 7-7 7',
  down: 'm6 9 6 6 6-6',
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  close: 'm6 6 12 12M18 6 6 18',
  external: 'M13 5h6v6m0-6-9 9m-1-8H6a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-3',
  check: 'm5 12 5 5L20 7'
};

export function setIcon(slot, name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  for (const [key, value] of Object.entries({
    d:paths[name], fill:'none', stroke:'currentColor', 'stroke-width':'1.75',
    'stroke-linecap':'round', 'stroke-linejoin':'round'
  })) path.setAttribute(key, value);
  svg.append(path);
  slot.setAttribute('aria-hidden', 'true');
  slot.replaceChildren(svg);
  return slot;
}
export const icon = name => setIcon(node('span', 'icon'), name);
export const hydrateIcons = (root = document) => {
  for (const slot of root.querySelectorAll('[data-icon]')) setIcon(slot, slot.dataset.icon);
};

// Close a modal dialog when its backdrop (outside the panel) is tapped.
export function closeOnBackdrop(dialog) {
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right &&
      event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) dialog.close();
  });
}
