import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'
import prettier from 'eslint-plugin-prettier'

export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.{js,mjs,jsx,vue}']
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**']
  },

  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  skipFormatting,

  {
    name: 'app/parser-options',
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ElMessage: 'readonly',
        ElMessageBox: 'readonly',
        ElLoading: 'readonly'
      }
    }
  },

  {
    name: 'app/rules',
    plugins: {
      prettier
    },
    rules: {
      'prettier/prettier': [
        'warn',
        {
          singleQuote: true,
          semi: false,
          printWidth: 80,
          trailingComma: 'none',
          endOfLine: 'auto'
        }
      ],
      'vue/multi-word-component-names': [
        'warn',
        {
          ignores: ['index']
        }
      ],
      'vue/no-setup-props-destructure': 'off',
      'no-undef': 'error'
    }
  }
]
