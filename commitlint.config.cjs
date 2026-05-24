// commitlint.config.cjs
module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'type-enum': [
            2,
            'always',
            [
                'feat',
                'fix',
                'docs',
                'style',
                'refactor',
                'perf',
                'test',
                'chore',
                'revert',
                'ci',
            ],
        ],
        'subject-case': [2, 'always', 'lower-case'],
        'subject-max-length': [2, 'always', 72],
    },
};