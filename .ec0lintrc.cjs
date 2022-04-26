"use strict";

module.exports = {
    root: true,
    extends: [
        "ec0lint"
    ],
    parserOptions: {
        ecmaVersion: "latest"
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
