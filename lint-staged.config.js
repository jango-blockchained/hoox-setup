// @ts-check

/**
 * @type {import('lint-staged').Configuration}
 */
const config = {
  "*.{ts,tsx,js,jsx,mjs,cjs}": ["eslint --fix", "prettier --write"],
  "*.{json,yaml,yml,md,css,scss}": ["prettier --write"],
};

export default config;
