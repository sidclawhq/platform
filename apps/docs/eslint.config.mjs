// eslint-config-next 16 ships native flat configs — no FlatCompat needed.
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  { ignores: ["node_modules/**", ".next/**", "out/**", ".source/**"] },
];

export default eslintConfig;
