/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        soft: {
          base: '#EEF2F6',       // canvas baseline background
          card: '#F8FAFC',       // raised card surface
          sunken: '#E2E8F0',     // recessed well/inputs
          overlay: '#FFFFFF',    // highest elevation modal/popover
          border: '#CBD5E1',     // distinct accessible boundaries
          divider: '#E2E8F0',    // soft inner dividers
          text: {
            primary: '#0F172A',  // 13.8:1 AAA contrast
            secondary: '#475569',// 5.4:1 AA contrast
            muted: '#64748B',    // 4.5:1 AA contrast
          }
        },
        brand: {
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          500: '#14B8A6',
          600: '#0D9488',       // primary teal accent
          700: '#0F766E',
          800: '#115E59',
          900: '#134E4A',
        },
        amber: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          500: '#F59E0B',
          600: '#D97706',       // harvest surge accent
          700: '#B45309',
        },
      },
      boxShadow: {
        // Paired functional elevation for Soft UI Evolution (ambient light + shadow)
        'soft-sm': '-2px -2px 6px rgba(255, 255, 255, 0.9), 2px 2px 6px rgba(148, 163, 184, 0.22)',
        'soft-md': '-4px -4px 10px rgba(255, 255, 255, 0.95), 4px 4px 12px rgba(148, 163, 184, 0.25)',
        'soft-lg': '-6px -6px 16px rgba(255, 255, 255, 0.95), 6px 6px 18px rgba(148, 163, 184, 0.3)',
        'soft-inner': 'inset 2px 2px 5px rgba(148, 163, 184, 0.32), inset -2px -2px 5px rgba(255, 255, 255, 0.85)',
        'soft-pill': '-3px -3px 7px rgba(255, 255, 255, 0.9), 3px 3px 7px rgba(148, 163, 184, 0.22)',
        'soft-pressed': 'inset 1.5px 1.5px 3px rgba(148, 163, 184, 0.4), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
      },
      borderRadius: {
        'soft-sm': '0.5rem',    // 8px
        'soft': '0.875rem',     // 14px
        'soft-lg': '1.125rem',  // 18px
        'soft-xl': '1.5rem',    // 24px
      }
    },
  },
  plugins: [],
}
