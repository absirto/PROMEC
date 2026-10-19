// ProMEC · Aço & Fagulha — preset do Tailwind apontando para os tokens de promec-tokens.css
// Uso: presets: [require('./docs/design/tailwind.promec.js')]

module.exports = {
  theme: {
    extend: {
      colors: {
        canvas: 'var(--pm-canvas)',
        base: 'var(--pm-base)',
        surface: { 1: 'var(--pm-surface-1)', 2: 'var(--pm-surface-2)', 3: 'var(--pm-surface-3)' },
        border: { DEFAULT: 'var(--pm-border)', strong: 'var(--pm-border-strong)' },
        ink: { 1: 'var(--pm-text-1)', 2: 'var(--pm-text-2)', 3: 'var(--pm-text-3)' },
        primary: { DEFAULT: 'var(--pm-primary)', fill: 'var(--pm-primary-fill)', on: 'var(--pm-primary-on)', soft: 'var(--pm-primary-soft)', text: 'var(--pm-primary-text)' },
        steel: { DEFAULT: 'var(--pm-steel)', 2: 'var(--pm-steel-2)', 3: 'var(--pm-steel-3)', soft: 'var(--pm-steel-soft)' },
        signal: 'var(--pm-signal)',
        ok: { DEFAULT: 'var(--pm-ok)', soft: 'var(--pm-ok-soft)' },
        warn: { DEFAULT: 'var(--pm-warn)', soft: 'var(--pm-warn-soft)' },
        bad: { DEFAULT: 'var(--pm-bad)', soft: 'var(--pm-bad-soft)' },
        info: { DEFAULT: 'var(--pm-info)', soft: 'var(--pm-info-soft)' },
        run: { DEFAULT: 'var(--pm-run)', soft: 'var(--pm-run-soft)' },
        neutral: { DEFAULT: 'var(--pm-neutral)', soft: 'var(--pm-neutral-soft)' },
        chart: {
          material: 'var(--pm-chart-material)', hora: 'var(--pm-chart-hora)', setup: 'var(--pm-chart-setup)',
          rateio: 'var(--pm-chart-rateio)', impostos: 'var(--pm-chart-impostos)', margem: 'var(--pm-chart-margem)',
          orcado: 'var(--pm-chart-orcado)', real: 'var(--pm-chart-real)'
        }
      },
      fontFamily: {
        display: ['Barlow Semi Condensed', 'IBM Plex Sans', 'sans-serif'],
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace']
      },
      fontSize: {
        display: ['var(--pm-size-display)', { lineHeight: '1', fontWeight: '700' }],
        'title-1': ['46px', { lineHeight: '1', fontWeight: '700' }],
        'title-2': ['26px', { lineHeight: '1.1', fontWeight: '700' }],
        headline: ['17px', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['var(--pm-size-body)', { lineHeight: '1.5' }],
        callout: ['var(--pm-size-callout)', { lineHeight: '1.5' }],
        caption: ['12.5px', { lineHeight: '1.4' }],
        kpi: ['52px', { lineHeight: '1.05', fontWeight: '700', letterSpacing: '-.04em' }]
      },
      borderRadius: {
        control: '12px', field: '14px', card: '22px', panel: '30px', sheet: '28px'
      },
      boxShadow: {
        1: 'var(--pm-shadow-1)', 2: 'var(--pm-shadow-2)', 3: 'var(--pm-shadow-3)',
        glass: 'var(--pm-glass-highlight), var(--pm-glass-shadow)'
      },
      backgroundImage: {
        hero: 'var(--pm-hero)', sidebar: 'var(--pm-sidebar)', hazard: 'var(--pm-hazard)',
        grid: 'linear-gradient(var(--pm-grid) 1px, transparent 1px), linear-gradient(90deg, var(--pm-grid) 1px, transparent 1px)'
      },
      backgroundSize: { grid: '24px 24px' },
      transitionTimingFunction: { promec: 'cubic-bezier(.2, .8, .2, 1)' },
      transitionDuration: { micro: '200ms', theme: '300ms', panel: '450ms' },
      minHeight: { target: 'var(--pm-target)', operador: '56px' },
      minWidth: { target: 'var(--pm-target)', operador: '56px' }
    }
  },
  plugins: [
    function ({ addComponents }) {
      addComponents({
        '.glass': {
          background: 'var(--pm-glass-bg)',
          backdropFilter: 'blur(var(--pm-glass-blur)) saturate(var(--pm-glass-saturate))',
          border: '1px solid var(--pm-glass-border)',
          boxShadow: 'var(--pm-glass-highlight), var(--pm-glass-shadow)'
        },
        '.glass-dark': {
          background: 'var(--pm-glass-dark-bg)',
          backdropFilter: 'blur(18px) saturate(1.6)',
          border: '1px solid var(--pm-glass-dark-border)',
          color: '#fff'
        },
        '@supports not (backdrop-filter: blur(1px))': {
          '.glass': { background: 'var(--pm-surface-1)' }
        }
      });
    }
  ]
};
