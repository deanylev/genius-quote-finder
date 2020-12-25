module.exports = {
  root: true,
  parser: 'babel-eslint',
  extends: [
    'eslint:recommended'
  ],
  plugins: [
    'html'
  ],
  env: {
    browser: true,
    node: true
  },
  rules: {
    'no-unused-vars': ['error', { args: 'none' }], // ignore arguments since we can't mark unused with underscores
    semi: ['error', 'always'],
    indent: ['error', 2, { SwitchCase: 1 }],
    curly: ['error', 'all'],
    'keyword-spacing': ['error', { before: true, after: true }],
    'prefer-destructuring': ['error', { AssignmentExpression: { array: false, object: false }, VariableDeclarator: { array: false, object: true } }], // array suggests pointlessly replacing foo[0],
    'arrow-spacing': ['error', { before: true, after: true }],
    'prefer-const': ['error', { destructuring: 'any' }],
    quotes: ['error', 'single'],
    'prefer-template': ['error'],
    'template-curly-spacing': ['error', 'never'],
    'object-shorthand': ['error', 'properties'],
    'padded-blocks': ['error', 'never'],
    'no-trailing-spaces': ['error'],
    'quote-props': ['error', 'as-needed'],
    'key-spacing': ['error', { mode: 'strict' }],
    'space-in-parens': ['error'],
    'brace-style': ['error'],
    'no-constant-condition': ['error', { checkLoops: false }],
    'arrow-parens': ['error', 'always'],
    'space-unary-ops': ['error'],
    'no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 1 }],
    'eol-last': ['error'],
    'dot-notation': ['error'],
    'comma-dangle': ['error', 'never']
  },
  globals: {
    gc: false,
    Map: false,
    Promise: false,
    Set: false
  }
};
