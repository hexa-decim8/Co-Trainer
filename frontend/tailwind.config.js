/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary Color - Blue (#0176be)
        primary: {
          50: '#e6f4fc',
          100: '#cce9f9',
          200: '#99d3f3',
          300: '#66bded',
          400: '#33a7e7',
          500: '#0176be',
          600: '#015e9b',
          700: '#014774',
          800: '#012f4d',
          900: '#001826',
        },
        // Accent Colors
        accent: {
          pink: '#ffa0ea',
          'pink-light': '#ffd0f5',
          'pink-dark': '#ff70e0',
          yellow: '#eecc06',
          'yellow-light': '#fff3b3',
          'yellow-dark': '#d4b500',
        },
        // Base Colors
        base: {
          black: '#000000',
          white: '#ffffff',
          'gray-light': '#f5f5f5',
          'gray': '#808080',
        },
        // Contact Levels - Adjusted for new palette
        contact: {
          none: '#0176be',
          light: '#eecc06',
          medium: '#ffa0ea',
          full: '#000000',
        },
        // Practice Types - Adjusted for new palette
        practice: {
          fundamentals: '#0176be',
          skills: '#ffa0ea',
          scrimmage: '#eecc06',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['Bebas Neue', 'Impact', 'Arial Black', 'sans-serif'],
        athletic: ['Oswald', 'Impact', 'Arial Black', 'sans-serif'],
      },
      boxShadow: {
        'derby': '0 4px 14px 0 rgba(1, 118, 190, 0.2)',
        'derby-lg': '0 10px 40px 0 rgba(1, 118, 190, 0.3)',
        'track': '0 2px 8px 0 rgba(0, 0, 0, 0.15)',
        'elevated': '0 8px 24px 0 rgba(0, 0, 0, 0.12)',
        'glow-blue': '0 0 20px rgba(1, 118, 190, 0.5)',
        'glow-pink': '0 0 20px rgba(255, 160, 234, 0.5)',
        'glow-yellow': '0 0 20px rgba(238, 204, 6, 0.5)',
      },
      backgroundImage: {
        'track-pattern': 'repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(1, 118, 190, 0.1) 10px, rgba(1, 118, 190, 0.1) 12px)',
        'diagonal-stripes': 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0, 0, 0, 0.03) 10px, rgba(0, 0, 0, 0.03) 20px)',
        'track-lines': 'repeating-linear-gradient(90deg, #0176be 0px, #0176be 2px, transparent 2px, transparent 12px)',
        'track-gradient': 'linear-gradient(135deg, #0176be 0%, #015e9b 100%)',
        'accent-gradient': 'linear-gradient(135deg, #ffa0ea 0%, #0176be 50%, #eecc06 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
    },
  },
  plugins: [],
}
