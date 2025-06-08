/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Matching your existing theme colors
        primary: {
          DEFAULT: '#8B5CF6',
          hover: '#7C3AED',
          light: '#A78BFA',
          dark: '#6D28D9',
        },
        success: {
          DEFAULT: '#10B981',
          hover: '#059669',
        },
        warning: {
          DEFAULT: '#F59E0B',
          hover: '#D97706',
        },
        error: {
          DEFAULT: '#EF4444',
          hover: '#DC2626',
        },
        // Custom surface colors to match your theme
        surface: {
          DEFAULT: '#FFFFFF',
          hover: '#F9FAFB',
          secondary: '#FAFBFC',
        },
        // Text colors
        text: {
          DEFAULT: '#1F2937',
          secondary: '#4B5563',
          muted: '#9CA3AF',
          inverse: '#FFFFFF',
        },
      },
    },
  },
  darkMode: 'class', // Enable class-based dark mode
  plugins: [],
}
