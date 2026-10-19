import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  presets: [require('../../docs/design/tailwind.promec.js')],
  theme: { extend: { screens: { xs: '390px' } } }
};
