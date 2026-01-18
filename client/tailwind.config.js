/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'court-dg': '#006400',
                'court-g': '#008000',
                'court-r': '#8B0000',
                'court-y': '#FFFF00',
                'court-b': '#00008B',
                'court-w': '#F0F8FF',
            }
        },
    },
    plugins: [],
}
