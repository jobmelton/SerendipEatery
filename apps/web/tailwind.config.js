/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        btc: {
          DEFAULT: '#F7941D',
          dark:    '#E8810A',
          light:   '#FDB253',
          ghost:   '#FEE8CC',
        },
        night:     '#0f0a1e',
        'warm-dark': '#1a0e00',
        surface:   '#fff8f2',
        teal:      '#1D9E75',
        purple:    '#534AB7',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Arial Black', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
