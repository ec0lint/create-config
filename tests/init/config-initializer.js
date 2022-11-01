/**
 * @fileoverview Tests for configInitializer.
 * @author Ilya Volodin
 */


//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

import chai from "chai";
import fs from "fs";
import path from "path";
import sinon from "sinon";
import sh from "shelljs";
import esmock from "esmock";
import { fileURLToPath } from "url";
import * as npmUtils from "../../lib/init/npm-utils.js";

const originalDir = process.cwd();
const { assert } = chai;

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

let fixtureDir;
let localInstalledEc0lintDir;

/**
 * change local installed eslint version in fixtures
 * @param {string|null} version installed eslint version, null => not installed
 * @returns {void}
 */
// function setLocalInstalledEslint(version) {
//     const eslintPkgPath = path.join(localInstalledEslintDir, "./package.json");
//     let pkg = JSON.parse(fs.readFileSync(eslintPkgPath, "utf8"));
//
//     if (version) {
//         pkg.version = version;
//     } else {
//         pkg = {};
//     }
//
//     fs.writeFileSync(eslintPkgPath, JSON.stringify(pkg, null, 2), "utf8");
// }


//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

let answers = {};
let pkgJSONContents = {};
let pkgJSONPath = "";

describe("configInitializer", () => {

    let npmCheckStub;
    let npmInstallStub;
    let npmFetchPeerDependenciesStub;
    let init;
    let log;


    before(() => {
        const filename = fileURLToPath(import.meta.url);

        fixtureDir = path.join(filename, "../../../tmp/ec0lint/fixtures/config-initializer");
        localInstalledEc0lintDir = path.join(fixtureDir, "./node_modules/ec0lint");
        sh.mkdir("-p", localInstalledEc0lintDir);
        sh.cp("-r", "./tests/fixtures/config-initializer/.", fixtureDir);
        sh.cp("-r", "./tests/fixtures/ec0lint/.", localInstalledEc0lintDir);
        fixtureDir = fs.realpathSync(fixtureDir);
    });

    beforeEach(async () => {
        log = {
            info: sinon.spy(),
            error: sinon.spy()
        };

        npmInstallStub = sinon.stub();
        npmCheckStub = sinon.fake(packages => packages.reduce((status, pkg) => {
            status[pkg] = false;
            return status;
        }, {}));

        const requireStubs = {
            "../../lib/shared/logging.js": log,
            "../../lib/init/npm-utils.js": {
                ...npmUtils,
                installSyncSaveDev: npmInstallStub,
                checkDevDeps: npmCheckStub,
                fetchPeerDependencies: npmFetchPeerDependenciesStub
            }
        };

        init = await esmock("../../lib/init/config-initializer.js", requireStubs, {});
    });

    afterEach(() => {
        log.info.resetHistory();
        log.error.resetHistory();
        npmInstallStub.resetHistory();
        npmCheckStub.resetHistory();
    });

    after(() => {
        sh.rm("-r", fixtureDir);
    });

    describe("processAnswers()", () => {

        describe("prompt", () => {

            beforeEach(() => {
                answers = {
                    purpose: "all",
                    source: "prompt",
                    format: "JSON",
                    framework: "none",
                    env: ["node"]
                };
            });

            it("should create default config", () => {
                const config = init.processAnswers(answers);

                assert.strictEqual(config.env.es2021, true);
                assert.strictEqual(config.parserOptions.ecmaVersion, "latest");
                assert.strictEqual(config.env.node, true);
                assert.strictEqual(config.extends, "ec0lint:recommended");
            });

            // it("should enable typescript parser and plugin", () => {
            //     answers.typescript = true;
            //     const config = init.processAnswers(answers);
            //
            //     assert.strictEqual(config.parser, "@typescript-eslint/parser");
            //     assert.deepStrictEqual(config.plugins, ["@typescript-eslint"]);
            //     assert.deepStrictEqual(config.extends, ["eslint:recommended", "plugin:@typescript-eslint/recommended"]);
            // });

            it("should extend ec0lint:recommended", () => {
                const config = init.processAnswers(answers);

                assert.strictEqual(config.extends, "ec0lint:recommended");
            });

            it("should not use browser by default", () => {
                const config = init.processAnswers(answers);

                assert.isUndefined(config.env.browser);
            });

            it("should use browser when set", () => {
                answers.env = ["browser"];
                const config = init.processAnswers(answers);

                assert.isTrue(config.env.browser);
            });

            it("should use react plugin when set", () => {
                answers.framework = "react";
                const config = init.processAnswers(answers);

                assert.strictEqual(config.extends.length, 2);
                assert.strictEqual(config.extends[1], "plugin:react/recommended");
            });
        });
    });

    describe("writeFile()", () => {

        beforeEach(() => {
            answers = {
                purpose: "all",
                source: "prompt",
                extendDefault: true,
                moduleType: "esm",
                es6Globals: true,
                env: ["browser"],
                format: "JSON"
            };

            pkgJSONContents = {
                name: "config-initializer",
                version: "1.0.0"
            };

            process.chdir(fixtureDir);

            pkgJSONPath = path.resolve(fixtureDir, "package.json");
        });

        afterEach(() => {
            process.chdir(originalDir);
        });

        it("should create .ec0lintrc.json", () => {
            const config = init.processAnswers(answers);
            const filePath = path.resolve(fixtureDir, ".ec0lintrc.json");

            fs.writeFileSync(pkgJSONPath, JSON.stringify(pkgJSONContents));

            init.writeFile(config, answers.format);

            assert.isTrue(fs.existsSync(filePath));

            fs.unlinkSync(filePath);
            fs.unlinkSync(pkgJSONPath);
        });

        it("should create .ec0lintrc.js", async () => {
            answers.format = "JavaScript";

            const config = init.processAnswers(answers);
            const filePath = path.resolve(fixtureDir, ".ec0lintrc.js");

            fs.writeFileSync(pkgJSONPath, JSON.stringify(pkgJSONContents));

            await init.writeFile(config, answers.format);

            assert.isTrue(fs.existsSync(filePath));

            fs.unlinkSync(filePath);
            fs.unlinkSync(pkgJSONPath);
        });

        it("should create .ec0lintrc.yml", async () => {
            answers.format = "YAML";

            const config = init.processAnswers(answers);
            const filePath = path.resolve(fixtureDir, ".ec0lintrc.yml");

            fs.writeFileSync(pkgJSONPath, JSON.stringify(pkgJSONContents));

            await init.writeFile(config, answers.format);

            assert.isTrue(fs.existsSync(filePath));

            fs.unlinkSync(filePath);
            fs.unlinkSync(pkgJSONPath);
        });

        it("should create .ec0lintrc.cjs", async () => {
            answers.format = "JavaScript";

            // create package.json with "type": "module"
            pkgJSONContents.type = "module";

            fs.writeFileSync(pkgJSONPath, JSON.stringify(pkgJSONContents));

            const config = init.processAnswers(answers);
            const filePath = path.resolve(fixtureDir, ".ec0lintrc.cjs");

            await init.writeFile(config, answers.format);

            assert.isTrue(fs.existsSync(filePath));

            fs.unlinkSync(filePath);
            fs.unlinkSync(pkgJSONPath);
        });

        it("should create .ec0lintrc.json even with type: 'module'", async () => {
            answers.format = "JSON";

            // create package.json with "type": "module"
            pkgJSONContents.type = "module";

            fs.writeFileSync(pkgJSONPath, JSON.stringify(pkgJSONContents));

            const config = init.processAnswers(answers);
            const filePath = path.resolve(fixtureDir, ".ec0lintrc.json");

            await init.writeFile(config, answers.format);

            assert.isTrue(fs.existsSync(filePath));

            fs.unlinkSync(filePath);
            fs.unlinkSync(pkgJSONPath);
        });
    });
});
