module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  plugins: [
    'html',
    '@typescript-eslint'
  ],
  env: {
    browser: true,
    node: true
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { 'args': 'none' }],
    'arrow-parens': ['error', 'always'],
    'arrow-spacing': ['error', { before: true, after: true }],
    'brace-style': ['error'],
    'comma-dangle': ['error', 'never'],
    'curly': ['error', 'all'],
    'dot-notation': ['error'],
    'eol-last': ['error'],
    'indent': ['error', 2, { SwitchCase: 1 }],
    'key-spacing': ['error', { mode: 'strict' }],
    'keyword-spacing': ['error', { before: true, after: true }],
    'no-constant-condition': ['error', { checkLoops: false }],
    'no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 1 }],
    'no-trailing-spaces': ['error'],
    'no-unused-vars': 'off',
    'object-shorthand': ['error', 'properties'],
    'padded-blocks': ['error', 'never'],
    'prefer-const': ['error', { destructuring: 'any' }],
    'prefer-destructuring': ['error', { AssignmentExpression: { array: false, object: false }, VariableDeclarator: { array: false, object: true } }], // array suggests pointlessly replacing foo[0],
    'prefer-template': ['error'],
    'quote-props': ['error', 'as-needed'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'space-in-parens': ['error'],
    'space-unary-ops': ['error'],
    'template-curly-spacing': ['error', 'never']
  },
  globals: {
    gc: false,
    Map: false,
    Promise: false,
    Set: false
  }
};
