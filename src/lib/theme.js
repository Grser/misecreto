export const T = {
  bg:         '#060910',
  bg2:        '#0a0d1a',
  bg3:        '#0f1629',
  card:       '#0f1629',
  card2:      '#131c33',
  border:     '#1a2540',
  border2:    '#243252',
  text:       '#e2e8f0',
  text2:      '#94a3b8',
  text3:      '#475569',
  blue:       '#3b82f6',
  indigo:     '#6366f1',
  rose:       '#f43f5e',
  amber:      '#f59e0b',
  green:      '#22c55e',
  purple:     '#a855f7',
  nsfwBg:     '#100818',
  nsfwCard:   '#1a0e24',
  nsfwBorder: '#3d1a5a',
  nsfwAccent: '#c026d3',
};

export const GRADIENTS = [
  ['#ec4899', '#fb7185'],
  ['#0ea5e9', '#22d3ee'],
  ['#10b981', '#2dd4bf'],
  ['#f59e0b', '#fb923c'],
  ['#8b5cf6', '#c084fc'],
  ['#d946ef', '#f472b6'],
  ['#3b82f6', '#818cf8'],
  ['#84cc16', '#4ade80'],
];

export const COUNTRY_CLR = {
  ar: '#c8102e', mx: '#006847', co: '#003893',
  es: '#c60b1e', cl: '#d52b1e', ve: '#cf142b',
  pe: '#d91023', us: '#002868', uy: '#0038a8',
};

export const COUNTRIES = [
  { code: 'ar', flag: '🇦🇷', label: 'AR', name: 'Argentina' },
  { code: 'mx', flag: '🇲🇽', label: 'MX', name: 'México' },
  { code: 'co', flag: '🇨🇴', label: 'CO', name: 'Colombia' },
  { code: 'es', flag: '🇪🇸', label: 'ES', name: 'España' },
  { code: 'cl', flag: '🇨🇱', label: 'CL', name: 'Chile' },
  { code: 've', flag: '🇻🇪', label: 'VE', name: 'Venezuela' },
  { code: 'pe', flag: '🇵🇪', label: 'PE', name: 'Perú' },
  { code: 'us', flag: '🇺🇸', label: 'US', name: 'Estados Unidos' },
  { code: 'uy', flag: '🇺🇾', label: 'UY', name: 'Uruguay' },
];

export const cOf = (code) => COUNTRIES.find(c => c.code === code) || COUNTRIES[0];

export const ADMIN = { user: 'admin', pass: 'admin123' };
