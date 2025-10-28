/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./contexts/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: '#ffece2',
        primary: '#792339',
        accent: '#F2b25f',
        gray: '#787878',
        lavender: '#d9c3db',
      },
    },
  },
  plugins: [],
};



