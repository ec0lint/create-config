/**
 * @fileoverview Config initialization wizard.
 * @author Ilya Volodin
 */


//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

import fs from "fs";
import enquirer from "enquirer";
import { Legacy } from "@eslint/eslintrc";
import { info } from "../shared/logging.js";
import * as ConfigFile from "./config-file.js";
import * as npmUtils from "./npm-utils.js";

const { ConfigOps, naming } = Legacy;

//------------------------------------------------------------------------------
// Private
//------------------------------------------------------------------------------

/* istanbul ignore next: hard to test fs function */
/**
 * Create .ec0lintrc file in the current working directory
 * @param {Object} config object that contains user's answers
 * @param {string} format The file format to write to.
 * @returns {void}
 */
async function writeFile(config, format) {

    // default is .js
    let extname = ".js";

    if (format === "YAML") {
        extname = ".yml";
    } else if (format === "JSON") {
        extname = ".json";
    } else if (format === "JavaScript") {
        const pkgJSONPath = npmUtils.findPackageJson();

        if (pkgJSONPath) {
            const pkgJSONContents = JSON.parse(fs.readFileSync(pkgJSONPath, "utf8"));

            if (pkgJSONContents.type === "module") {
                extname = ".cjs";
            }
        }
    }

    delete config.installedEc0Lint;

    await ConfigFile.write(config, `./.ec0lintrc${extname}`);
    info(`Successfully created .ec0lintrc${extname} file in ${process.cwd()}`);
}

/**
 * Get the peer dependencies of the given module.
 * This adds the gotten value to cache at the first time, then reuses it.
 * In a process, this function is called twice, but `npmUtils.fetchPeerDependencies` needs to access network which is relatively slow.
 * @param {string} moduleName The module name to get.
 * @returns {Object} The peer dependencies of the given module.
 * This object is the object of `peerDependencies` field of `package.json`.
 * Returns null if npm was not found.
 */
function getPeerDependencies(moduleName) {
    let result = getPeerDependencies.cache.get(moduleName);

    if (!result) {
        info(`Checking peerDependencies of ${moduleName}`);

        result = npmUtils.fetchPeerDependencies(moduleName);
        getPeerDependencies.cache.set(moduleName, result);
    }

    return result;
}
getPeerDependencies.cache = new Map();

/**
 * Return necessary plugins, configs, parsers, etc. based on the config
 * @param {Object} config config object
 * @param {boolean} [installEc0Lint=true] If `false` is given, it does not install ec0lint.
 * @returns {string[]} An array of modules to be installed.
 */
function getModulesList(config, installEc0Lint) {
    const modules = {};

    // Create a list of modules which should be installed based on config
    if (config.plugins) {
        for (const plugin of config.plugins) {
            const moduleName = naming.normalizePackageName(plugin, "eslint-plugin");

            modules[moduleName] = "latest";
        }
    }
    if (config.extends) {
        const extendList = Array.isArray(config.extends) ? config.extends : [config.extends];

        for (const extend of extendList) {
            if (extend.startsWith("eslint:") || extend.startsWith("plugin:")) {
                continue;
            }
            const moduleName = naming.normalizePackageName(extend, "ec0lint-config");

            modules[moduleName] = "latest";
            Object.assign(
                modules,
                getPeerDependencies(`${moduleName}@latest`)
            );
        }
    }

    const parser = config.parser || (config.parserOptions && config.parserOptions.parser);

    if (parser) {
        modules[parser] = "latest";
    }

    if (installEc0Lint === false) {
        delete modules.ec0lint;
    } else {
        const installStatus = npmUtils.checkDevDeps(["eslint"]);

        // Mark to show messages if it's new installation of ec0lint.
        if (installStatus.ec0lint === false) {
            info("Local Ec0Lint installation not found.");
            modules.ec0lint = modules.ec0lint || "latest";
            config.installedEc0Lint = true;
        }
    }

    return Object.keys(modules).map(name => `${name}@${modules[name]}`);
}

/**
 * process user's answers and create config object
 * @param {Object} answers answers received from enquirer
 * @returns {Object} config object
 */
function processAnswers(answers) {
    const config = {
        rules: {},
        env: {},
        parserOptions: {},
        extends: []
    };

    config.parserOptions.ecmaVersion = "latest";
    config.env.es2021 = true;

    // add in browser and node environments if necessary
    answers.env.forEach(env => {
        config.env[env] = true;
    });


    if (answers.purpose === "code") {

        // setup rule for checking resources
    } else {
        config.extends.unshift("ec0lint:recommended");
    }

    // normalize extends
    if (config.extends.length === 0) {
        delete config.extends;
    } else if (config.extends.length === 1) {
        config.extends = config.extends[0];
    }

    ConfigOps.normalizeToStrings(config);
    return config;
}

/**
 * Install modules.
 * @param {string[]} modules Modules to be installed.
 * @returns {void}
 */
function installModules(modules) {
    info(`Installing ${modules.join(", ")}`);
    npmUtils.installSyncSaveDev(modules);
}

/* istanbul ignore next: no need to test enquirer */
/**
 * Ask user to install modules.
 * @param {string[]} modules Array of modules to be installed.
 * @param {boolean} packageJsonExists Indicates if package.json is existed.
 * @returns {Promise<void>} Answer that indicates if user wants to install.
 */
function askInstallModules(modules, packageJsonExists) {

    // If no modules, do nothing.
    if (modules.length === 0) {
        return Promise.resolve();
    }

    info("The config that you've selected requires the following dependencies:\n");
    info(modules.join(" "));
    return enquirer.prompt([
        {
            type: "toggle",
            name: "executeInstallation",
            message: "Would you like to install them now with npm?",
            enabled: "Yes",
            disabled: "No",
            initial: 1,
            skip() {
                return !(modules.length && packageJsonExists);
            },
            result(input) {
                return this.skipped ? null : input;
            }
        }
    ]).then(({ executeInstallation }) => {
        if (executeInstallation) {
            installModules(modules);
        }
    });
}

/* istanbul ignore next: no need to test enquirer */
/**
 * Ask use a few questions on command prompt
 * @returns {Promise<void>} The promise with the result of the prompt
 */
function promptUser() {

    return enquirer.prompt([
        {
            type: "select",
            name: "purpose",
            message: "How would you like to use ec0lint?",

            // The returned number matches the name value of nth in the choices array.
            initial: 1,
            choices: [
                { message: "To check code issues only", name: "syntax" },

                { message: "To check code issues and static resources", name: "all" }
            ]
        },

        // {
        //     type: "select",
        //     name: "framework",
        //     message: "Which framework does your project use?",
        //     initial: 0,
        //     choices: [
        //         { message: "React", name: "react" },
        //         { message: "Vue.js", name: "vue" },
        //         { message: "None of these", name: "none" }
        //     ]
        // },
        // {
        //     type: "toggle",
        //     name: "typescript",
        //     message: "Does your project use TypeScript?",
        //     enabled: "Yes",
        //     disabled: "No",
        //     initial: 0
        // },
        {
            type: "multiselect",
            name: "env",
            message: "Where does your code run?",
            hint: "(Press <space> to select, <a> to toggle all, <i> to invert selection)",
            initial: 0,
            choices: [
                { message: "Browser", name: "browser" },
                { message: "Node", name: "node" }
            ]
        },
        {
            type: "select",
            name: "format",
            message: "What format do you want your config file to be in?",
            initial: 0,
            choices: ["JavaScript", "YAML", "JSON"]
        },
        {
            type: "select",
            name: "indent",
            message: "What style of indentation do you use?",
            initial: 0,
            choices: [{ message: "Tabs", name: "tab" }, { message: "Spaces", name: 4 }]
        }
    ]).then(earlyAnswers => {
        const totalAnswers = Object.assign({}, earlyAnswers);

        const config = processAnswers(totalAnswers);
        const modules = getModulesList(config);

        return askInstallModules(modules, earlyAnswers.packageJsonExists).then(() => writeFile(config, earlyAnswers.format));
    });
}

/* istanbul ignore next */
/** an wrapper for promptUser
 *  @returns {void}
 */
function initializeConfig() {
    return promptUser();
}

//------------------------------------------------------------------------------
// Public Interface
//------------------------------------------------------------------------------

export {
    getModulesList,
    installModules,
    processAnswers,
    writeFile,
    initializeConfig
};
