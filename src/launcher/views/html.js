/** Safe HTML encoding and the shared icon vocabulary. */
export var icons = {
  tv: 'M3 6h18v11H3z M8 20h8 M9 2l3 3 3-3',
  play: 'M8 5.5v13l10.5-6.5z',
  apps: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  hdmi: 'M3 8h18v5l-3 4H6l-3-4z M7 11h10',
  usb: 'M8 3h8v5H8z M6 8h12v13H6z M10 4v3 M14 4v3',
  share: 'M3 4h18v14h-8 M3 11a9 9 0 0 1 9 9 M3 15a5 5 0 0 1 5 5 M3 20h.01',
  picture: 'M3 5h18v12H3z M8 21h8 M12 17v4',
  sound: 'M11 5L6 9H3v6h3l5 4z M15.5 8.5a5 5 0 0 1 0 7 M18.5 5.5a9 9 0 0 1 0 13',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M5 5l1 1 M18 18l1 1 M2 12h2 M20 12h2 M5 19l1-1 M18 6l1-1',
  wifi: 'M2 8.5a15 15 0 0 1 20 0 M5 12a10 10 0 0 1 14 0 M8.5 15.5a5 5 0 0 1 7 0 M12 19h.01',
  bt: 'M7 7l10 10-5 5V2l5 5L7 17',
  reorder: 'M4 7h16 M4 12h16 M4 17h16 M17 4l3 3-3 3',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  scene: 'M3 17l5-6 4 4 3-3 6 5 M3 21h18',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0',
  settings:
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 11v5 M12 8h.01',
  power: 'M12 3v8 M6.3 6.3a8 8 0 1 0 11.4 0',
  home: 'M3 10l9-7 9 7 M5 9v12h14V9 M10 21v-7h4v7',
  motion: 'M3 8h9 M3 12h14 M3 16h9 M17 5l4 7-4 7',
  browser:
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c3 3.5 3 14.5 0 18 M12 3c-3 3.5-3 14.5 0 18'
};

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

export function renderIcon(name) {
  return (
    '<svg class="ico" aria-hidden="true" viewBox="0 0 24 24"><path d="' +
    (icons[name] || icons.apps) +
    '"></path></svg>'
  );
}
