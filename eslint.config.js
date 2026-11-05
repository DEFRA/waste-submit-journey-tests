import { defineConfig } from 'eslint/config'
import js from '@eslint/js'
import globals from 'globals'
import eslintPluginPrettier from 'eslint-plugin-prettier'
import eslintConfigPrettier from 'eslint-config-prettier/flat'
import playwright from 'eslint-plugin-playwright'

export default defineConfig([
  {
    ignores: [
      'allure-results/',
      'allure-report/',
      'test-results/',
      'zap-report/',
      'docker/'
    ]
  },

  js.configs.recommended,

  { files: ['test/**/*.js'], ...playwright.configs['flat/recommended'] },

  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node
      }
    },
    plugins: {
      prettier: eslintPluginPrettier
    },
    rules: {
      'prettier/prettier': 'error',
      'no-console': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },

  eslintConfigPrettier
])
