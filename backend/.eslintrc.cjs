module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  globals: {
    describe: 'readonly',
    it: 'readonly',
    expect: 'readonly'
  },
  extends: ['eslint:recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {}
};
