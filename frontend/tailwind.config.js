/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Roller Derby Theme Colors
        primary: {
          50: '#fef1f7',
          100: '#fee5f0',
          200: '#fecce3',
          300: '#ffa3cb',
          400: '#fe6aaa',
          500: '#f83d8c',
          600: '#e91e6f',
          700: '#ca0f56',
          800: '#a71148',
          900: '#8b1240',
        },
        derby: {
          black: '#0a0a0a',
          white: '#fafafa',
          track: '#1a1a1a',
          highlight: '#00f0ff', // Electric blue
          neon: '#39ff14', // Neon green
        },
        contact: {
          none: '#10b981', // Green
          light: '#f59e0b', // Amber
          medium: '#f97316', // Orange  
          full: '#ef4444', // Red
        },
        practice: {
          fundamentals: '#10b981', // Green
          skills: '#3b82f6', // Blue
          scrimmage: '#ef4444', // Red
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['Bebas Neue', 'Impact', 'Arial Black', 'sans-serif'],
        athletic: ['Oswald', 'Impact', 'Arial Black', 'sans-serif'],
      },
      boxShadow: {
        'derby': '0 4px 14px 0 rgba(232, 30, 111, 0.15)',
        'derby-lg': '0 10px 40px 0 rgba(232, 30, 111, 0.25)',
        'track': '0 2px 8px 0 rgba(0, 0, 0, 0.3)',
        'elevated': '0 8px 24px 0 rgba(0, 0, 0, 0.12)',
      },
      backgroundImage: {
        'track-pattern': 'repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(232, 30, 111, 0.1) 10px, rgba(232, 30, 111, 0.1) 12px)',
        'diagonal-stripes': 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0, 0, 0, 0.03) 10px, rgba(0, 0, 0, 0.03) 20px)',
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
