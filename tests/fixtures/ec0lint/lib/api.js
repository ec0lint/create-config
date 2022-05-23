/**
 * @fileoverview the file is to mock local-installed eslint for testing
 */
"use strict";
const _module = require("module");
const path = require("path");

const { createRequire } = _module;
const root = path.resolve(__dirname, "../../../../../../");

const realEc0lintPath = createRequire(root).resolve("ec0lint");
module.exports = require(realEc0lintPath);
