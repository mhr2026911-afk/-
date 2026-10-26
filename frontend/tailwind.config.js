/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0f6b57',
          dark: '#0a5443',
          deep: '#0c2f27',
          soft: '#e7f3ef',
          tint: '#f2f9f6',
        },
        canvas: '#f2f5f3',
        ink: '#12211d',
        muted: '#6b7d77',
        line: '#e3eae6',
        danger: '#b4234b',
        gold: '#c9a24a',
      },
      fontFamily: {
        sans: ['Tajawal', 'Noto Kufi Arabic', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 6px 24px rgba(12, 47, 39, 0.06)',
        float: '0 12px 34px rgba(12, 47, 39, 0.16)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(14px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'pop-in': {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        ripple: {
          '0%': { transform: 'scale(0.9)', opacity: '0.6' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'slide-up': 'slide-up 240ms cubic-bezier(0.22, 1, 0.36, 1)',
        'pop-in': 'pop-in 180ms ease-out',
        ripple: 'ripple 1.6s ease-out infinite',
      },
    },
  },
  plugins: [],
}
