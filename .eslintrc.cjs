const MAX_FUNCTION_LINES = 30;
const MAX_FILE_LINES = 200;
const MAX_TEST_FILE_LINES = 400;
const MAX_PARAMS = 3;

const INDEX_LOOPS = ['ForStatement', 'WhileStatement', 'DoWhileStatement'];
const ELSE_BLOCK = {
  selector: 'IfStatement[alternate]',
  message: 'Use a guard clause and return early instead of else.',
};
const REEXPORT_ONLY = {
  selector: 'ExportAllDeclaration',
  message: 'No barrel re-exports; import the module path directly.',
};
const RAW_SQL = {
  selector: 'MemberExpression[property.name=/^\\$(queryRaw|executeRaw)/]',
  message: 'SQL lives in a *.repository.ts next to the feature.',
};
const DB_ACCESS_IMPORTS = [
  {
    name: '@app/platform/database/prisma.service',
    message: 'DB access goes through a *.repository.ts next to the feature.',
  },
  {
    name: '@prisma/client',
    importNames: ['Prisma', 'PrismaClient'],
    message: 'Use TransactionClient from @app/platform/database/transaction-runner.',
  },
];

module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: ['plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'],
  root: true,
  env: { node: true, jest: true },
  ignorePatterns: ['.eslintrc.cjs', 'dist', 'node_modules'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-argument': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-enum-comparison': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/no-unsafe-unary-minus': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-magic-numbers': [
      'error',
      { ignore: [0, 1], ignoreEnums: true, ignoreReadonlyClassProperties: true },
    ],
    'no-console': 'error',
    'id-length': ['error', { min: 2, exceptions: ['_'], properties: 'never' }],
    'max-params': ['error', MAX_PARAMS],
    'max-lines-per-function': [
      'error',
      { max: MAX_FUNCTION_LINES, skipBlankLines: true, skipComments: true },
    ],
    'max-lines': ['error', { max: MAX_FILE_LINES, skipBlankLines: true, skipComments: true }],
    'no-restricted-syntax': ['error', ...INDEX_LOOPS, ELSE_BLOCK, REEXPORT_ONLY],
  },
  overrides: [
    {
      files: ['libs/tournaments/src/**/*.ts'],
      excludedFiles: ['**/*.repository.ts'],
      rules: {
        'no-restricted-imports': ['error', { paths: DB_ACCESS_IMPORTS }],
        'no-restricted-syntax': ['error', ...INDEX_LOOPS, ELSE_BLOCK, REEXPORT_ONLY, RAW_SQL],
      },
    },
    {
      files: ['test/**/*.ts'],
      rules: {
        '@typescript-eslint/no-magic-numbers': 'off',
        'max-lines-per-function': 'off',
        'max-lines': ['error', { max: MAX_TEST_FILE_LINES }],
      },
    },
    {
      files: ['test/**/*.int-spec.ts'],
      rules: {
        'no-restricted-syntax': [
          'error',
          ...INDEX_LOOPS,
          'ForOfStatement',
          'ForInStatement',
          'IfStatement',
          'SwitchStatement',
          'ConditionalExpression',
        ],
      },
    },
  ],
};
