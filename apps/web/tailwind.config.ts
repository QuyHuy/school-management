import type { Config } from "tailwindcss";
import baseConfig from "@school/configs/tailwind";

const config: Config = {
  ...baseConfig,
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      ...(baseConfig.theme?.extend ?? {}),
    },
  },
};
export default config;
