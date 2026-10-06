const typeRules = {
	'@typescript-eslint/no-explicit-any': 'error',
	'@typescript-eslint/no-unsafe-assignment': 'error',
	'@typescript-eslint/no-unsafe-member-access': 'error',
	'@typescript-eslint/no-unsafe-call': 'error',
	'@typescript-eslint/no-unsafe-return': 'error',
	'@typescript-eslint/no-unsafe-argument': 'error',
	'@typescript-eslint/ban-ts-comment': 'error',
	'no-unused-vars': 'off',
	'@typescript-eslint/no-unused-vars': [
		'error',
		{ argsIgnorePattern: '^_', varsIgnorePattern: '^_|^T$' }
	]
};

module.exports = {
	root: true,
	extends: ['eslint:recommended', 'prettier'],
	parserOptions: { sourceType: 'module', ecmaVersion: 'latest' },
	env: { browser: true, es2022: true, node: true },
	overrides: [
		{
			files: ['src/**/*.js', 'src/**/*.ts'],
			parser: '@typescript-eslint/parser',
			plugins: ['@typescript-eslint'],
			parserOptions: {
				project: './tsconfig.json',
				jsDocParsingMode: 'all',
				extraFileExtensions: ['.svelte']
			},
			rules: typeRules
		},
		{
			files: ['src/**/*.svelte'],
			parser: 'svelte-eslint-parser',
			plugins: ['svelte', '@typescript-eslint'],
			parserOptions: {
				parser: '@typescript-eslint/parser',
				project: './tsconfig.json',
				jsDocParsingMode: 'all',
				extraFileExtensions: ['.svelte']
			},
			rules: {
				...typeRules,
				'no-inner-declarations': 'off',
				'no-undef': 'off'
			}
		}
	]
};
