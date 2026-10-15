import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    purple: "#3B0764", // Dark Purple
                    yellow: "#FEF08A", // Light Yellow
                },
            },
        },
    },
    plugins: [],
};
export default config;