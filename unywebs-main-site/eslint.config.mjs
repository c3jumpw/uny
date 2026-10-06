import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // A leading underscore marks a value taken only to leave it out of
      // a rest spread (react-markdown's \`node\` prop, for one).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      // The root layout loads Inter once for every page in the App
      // Router; this rule targets the old pages/_document model.
      "@next/next/no-page-custom-font": "off",
    },
  },
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
];

export default config;
