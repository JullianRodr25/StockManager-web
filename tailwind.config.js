import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Adaptativos: cambian de valor entre modo claro y oscuro (ver
        // variables --navy/--background/etc. en index.css). Se usan para
        // texto y superficies que sí deben invertirse con el tema.
        navy: 'hsl(var(--navy) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        'text-muted': 'hsl(var(--text-muted) / <alpha-value>)',
        'error-text': 'hsl(var(--error-text) / <alpha-value>)',
        'error-bg': 'hsl(var(--error-bg) / <alpha-value>)',

        // Fijos: NO cambian entre modo claro/oscuro. "ink" y "cream" son la
        // pareja fondo-oscuro/texto-claro que usan las superficies siempre
        // oscuras de la marca (sidebar, avatares, badges, overlays), donde
        // antes se reutilizaban "navy"/"background" — pero esos dos ahora
        // son adaptativos y ya no sirven para ese propósito.
        ink: '#16233B',
        cream: '#FAF9F6',
        gold: {
          DEFAULT: 'hsl(var(--gold) / <alpha-value>)',
          hover: 'hsl(var(--gold-hover) / <alpha-value>)',
        },
        green: 'hsl(var(--green) / <alpha-value>)',

        // Tokens shadcn/ui, ya usados por los componentes base.
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: 'hsl(var(--card) / <alpha-value>)',
        'card-foreground': 'hsl(var(--card-foreground) / <alpha-value>)',
        popover: 'hsl(var(--popover) / <alpha-value>)',
        'popover-foreground': 'hsl(var(--popover-foreground) / <alpha-value>)',
        primary: 'hsl(var(--primary) / <alpha-value>)',
        'primary-foreground': 'hsl(var(--primary-foreground) / <alpha-value>)',
        secondary: 'hsl(var(--secondary) / <alpha-value>)',
        'secondary-foreground': 'hsl(var(--secondary-foreground) / <alpha-value>)',
        muted: 'hsl(var(--muted) / <alpha-value>)',
        'muted-foreground': 'hsl(var(--muted-foreground) / <alpha-value>)',
        accent: 'hsl(var(--accent) / <alpha-value>)',
        'accent-foreground': 'hsl(var(--accent-foreground) / <alpha-value>)',
        destructive: 'hsl(var(--destructive) / <alpha-value>)',
        'destructive-foreground': 'hsl(var(--destructive-foreground) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
      },
      fontFamily: {
        heading: ['Manrope', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
