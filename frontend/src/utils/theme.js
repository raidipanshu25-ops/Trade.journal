/* ════════════════════════════════════════════════
   Theme Presets & Utilities
   ════════════════════════════════════════════════ */

export const THEME_PRESETS = [
  {
    id: 'terminal-teal',
    name: 'Terminal Teal',
    desc: 'FundingPips-inspired',
    accent: '#00D9A3',
    accentDark: '#00B88A',
    bgBase: '#0A0E14',
    bgSurface: '#111722',
    bgRaised: '#161D2B',
    borderColor: '#232B3A',
    textPrimary: '#F2F5F9',
    textSecondary: '#8A93A6',
    profit: '#22C55E',
    loss: '#F43F5E',
  },
  {
    id: 'obsidian-gold',
    name: 'Obsidian Gold',
    desc: 'GoatFundedTrader-inspired',
    accent: '#D4A24C',
    accentDark: '#B8892E',
    bgBase: '#0B0A0A',
    bgSurface: '#141211',
    bgRaised: '#1C1917',
    borderColor: '#2A2622',
    textPrimary: '#F5F1E8',
    textSecondary: '#9C9385',
    profit: '#34D399',
    loss: '#FB7185',
  },
  {
    id: 'violet-aurora',
    name: 'Violet Aurora',
    desc: 'Maven-inspired',
    accent: '#8B5CF6',
    accentDark: '#7C3AED',
    bgBase: '#0D0B14',
    bgSurface: '#14111F',
    bgRaised: '#1C1830',
    borderColor: '#2A2440',
    textPrimary: '#F3F1FA',
    textSecondary: '#948DA8',
    profit: '#10B981',
    loss: '#EF4444',
  },
];

export function hexToHSL(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

export function applyThemePreset(presetId) {
  if (!presetId) presetId = 'terminal-teal';

  const el = document.documentElement;

  document.body.style.backgroundImage = '';
  document.body.style.backgroundSize = '';
  document.body.style.backgroundColor = '';
  document.body.style.backgroundAttachment = '';

  if (presetId === 'dark' || presetId === 'light') {
    el.setAttribute('data-theme', presetId);
    localStorage.setItem('tj-preset', presetId);
    localStorage.setItem('tj-theme', presetId);
    const varsToClear = [
      '--bg-0', '--bg-1', '--bg-2', '--bg-3', '--border',
      '--cyan', '--cyan-dark', '--cyan-dim', '--cyan-dim2', '--cyan-border',
      '--cyan-glow', '--cyan-glow-sm', '--gradient-accent', '--gradient-accent-hover', '--gradient-brand',
      '--text-0', '--text-1', '--text-2',
      '--green', '--red',
    ];
    varsToClear.forEach(v => el.style.removeProperty(v));
    return;
  }

  if (presetId === 'custom') {
    const baseHex = localStorage.getItem('tj-custom-base') || '#00D9A3';
    const { h, s, l } = hexToHSL(baseHex);

    const bgBase = hslToHex(h, Math.min(s, 15), Math.max(l, 5));
    const bgSurface = hslToHex(h, Math.min(s, 15), Math.max(l, 5) + 4);
    const bgRaised = hslToHex(h, Math.min(s, 15), Math.max(l, 5) + 8);
    const borderHex = hslToHex(h, Math.min(s, 15), Math.max(l, 5) + 12);

    const rgb = hexToRgb(baseHex);

    el.setAttribute('data-theme', 'dark');
    localStorage.setItem('tj-preset', 'custom');
    localStorage.setItem('tj-theme', 'custom');

    el.style.setProperty('--bg-0', bgBase);
    el.style.setProperty('--bg-1', bgSurface);
    el.style.setProperty('--bg-2', bgRaised);
    el.style.setProperty('--bg-3', borderHex);
    el.style.setProperty('--border', borderHex);

    el.style.setProperty('--cyan', baseHex);
    el.style.setProperty('--cyan-dark', hslToHex(h, s, Math.max(l - 10, 10)));
    el.style.setProperty('--cyan-dim', `rgba(${rgb}, 0.06)`);
    el.style.setProperty('--cyan-dim2', `rgba(${rgb}, 0.09)`);
    el.style.setProperty('--cyan-border', `rgba(${rgb}, 0.14)`);
    el.style.setProperty('--cyan-glow', `0 0 16px rgba(${rgb}, 0.2), 0 0 32px rgba(${rgb}, 0.06)`);
    el.style.setProperty('--cyan-glow-sm', `0 0 8px rgba(${rgb}, 0.18)`);
    el.style.setProperty('--gradient-accent', `linear-gradient(135deg, ${baseHex} 0%, ${hslToHex(h, s, Math.max(l - 10, 10))} 100%)`);
    el.style.setProperty('--gradient-accent-hover', `linear-gradient(135deg, ${hslToHex(h, s, Math.max(l - 10, 10))} 0%, ${hslToHex(h, s, Math.max(l - 10, 10))} 100%)`);
    el.style.setProperty('--gradient-brand', `linear-gradient(135deg, ${baseHex}, ${hslToHex(h, s, Math.max(l - 10, 10))})`);

    el.style.setProperty('--text-0', '#F2F5F9');
    el.style.setProperty('--text-1', '#8A93A6');
    el.style.setProperty('--text-2', '#5A6478');

    el.style.setProperty('--green', '#22C55E');
    el.style.setProperty('--red', '#F43F5E');
    return;
  }

  const preset = THEME_PRESETS.find(p => p.id === presetId);
  if (preset) {
    el.setAttribute('data-theme', presetId);
    localStorage.setItem('tj-preset', presetId);
    localStorage.setItem('tj-theme', presetId);
    const varsToClear = [
      '--bg-0', '--bg-1', '--bg-2', '--bg-3', '--border',
      '--cyan', '--cyan-dark', '--cyan-dim', '--cyan-dim2', '--cyan-border',
      '--cyan-glow', '--cyan-glow-sm', '--gradient-accent', '--gradient-accent-hover', '--gradient-brand',
      '--text-0', '--text-1', '--text-2',
      '--green', '--red',
    ];
    varsToClear.forEach(v => el.style.removeProperty(v));
  }
}

export function applyBgPreset() {}
export function applyAccentPreset() {}
export function applyTextPreset() {}
