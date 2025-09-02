import globals from 'globals'

import parser from '@typescript-eslint/parser'

// Import plugins
import prettierPlugin from 'prettier'
import eslintPluginPrettier from 'eslint-plugin-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import jestPlugin from 'eslint-plugin-jest'
import reactHooks from 'eslint-plugin-react-hooks'

// Extend configs
import js from '@eslint/js'
import compat from 'eslint-plugin-compat'

const rules = {
    'eslint-plugin-prettier/prettier': 'error',
    'prefer-spread': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-this-alias': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['error'],
    '@typescript-eslint/no-unused-expressions': 'off',
    'no-prototype-builtins': 'off',
    'no-empty': 'off',
    'no-console': 'error',
    '@typescript-eslint/naming-convention': [
        'error',
        {
            selector: ['memberLike'],
            modifiers: ['private'],
            format: null,
            leadingUnderscore: 'require',
        },
    ],
}

export default [
    js.configs.recommended,
    {
        languageOptions: {
            parser,
            ecmaVersion: 2022,
            globals: {
                ...globals.browser,
                ...globals.node,
                given: 'readonly',
                global: 'readonly',
                Buffer: 'readonly',
            },
        },
        plugins: {
            prettier: prettierPlugin,
            'eslint-plugin-prettier': eslintPluginPrettier,
            '@typescript-eslint': typescriptEslint,
            'eslint-plugin-react': eslintPluginReact,
            'eslint-plugin-jest': jestPlugin,
            'eslint-plugin-react-hooks': reactHooks,
            compat: compat,
        },
        rules,
    },
]
