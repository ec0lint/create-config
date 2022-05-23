"use strict";

module.exports = {
    root: true,
    extends: [
        "ec0lint"
    ],
    env: {
        es6: true,
        node: true
    },
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module"
    },
    overrides: [
        {
            files: [
                "tests/**/*.js"
            ],
            env: {
                mocha: true
            }
        }
    ],
    ignorePatterns: [
        "fixtures/"
    ]
};
