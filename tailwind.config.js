/** @type {import('tailwindcss').Config} */

/**
 * De hele kleurentabel wijst naar de CSS-variabelen in src/theme.css. Er bestaan
 * hier bewust geen andere kleuren: een klasse als text-slate-400 compileert dan
 * simpelweg niet meer, dus een hardgecodeerde kleur kan er niet ongemerkt insluipen.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      bg: 'var(--c-bg)',
      raised: 'var(--c-raised)',
      fg: 'var(--c-fg)',
      muted: 'var(--c-muted)',
      faint: 'var(--c-faint)',
      line: 'var(--c-line)',
      'on-invert': 'var(--c-on-invert)',
      error: 'var(--c-error)',
      'on-error': 'var(--c-on-error)',
      scrim: 'var(--c-scrim)',
    },
    /* 4px overal; alleen 'full' blijft voor de voortgangsbalk en ronde knoppen */
    borderRadius: {
      none: '0',
      DEFAULT: 'var(--radius)',
      full: '9999px',
    },
    /* hairlines als standaard randdikte */
    borderWidth: {
      DEFAULT: 'var(--hairline)',
      0: '0',
      2: '2px',
    },
    extend: {
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'SF Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
