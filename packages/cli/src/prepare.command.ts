import * as path from 'path';
import { CommandRunner } from './command-runner';
import { ServiceGenerator } from './service-generator';
import { GeneratorCanceled } from './generator-canceled';
import { GeneratorError } from './generator-error';
import { LibraryGenerator } from './library-generator';
import { Generator } from './generator';
import { Constructor } from '@alterior/runtime';
import { pathCombine, getWorkingDirectory, readJsonFile, askBoolean } from './utils';
import { BuildConfig } from './build-config';
import { PackageConfiguration } from './package-configuration';

export class PrepareCommand {
    constructor() {
    }

    runner = new CommandRunner();

    async run(args : string[]) {

        if (process.env['ALT_NESTED']) {
            console.log(`alt prepare: Skipping recursive invocation`);
            return 0;
        }

        // if (process.env.npm_config_argv) {
        //     let npmArgv = JSON.parse(process.env.npm_config_argv);
        //     if (npmArgv.cooked && npmArgv.cooked.includes('--dry-run')) {
        //         console.log(`alt prepare: Skipping for dry-run.`);
        //         return;
        //     }
        // }

        if (args.length !== 0) {
            console.error(`usage: alt prepare`);
            console.error(`** Extra arguments were passed (none expected)`);
            return 1;
        }

        let buildConfig = await readJsonFile<BuildConfig>(pathCombine(getWorkingDirectory(), 'alterior.json'));
        let pkgJson = await readJsonFile(pathCombine(getWorkingDirectory(), 'package.json'));
        let currentAccess = pkgJson.publishConfig?.access;
        let commandRunner = new CommandRunner();

        if (!currentAccess) {
            if (pkgJson.name.startsWith('@'))
                currentAccess = 'private';
            else
                currentAccess = 'public';
        }

        if (currentAccess !== buildConfig.packageAccess) {
            console.log(`================================================================================`);
            console.log(`ERROR: package.json is configured to publish ${pkgJson.name} as ${currentAccess}`);
            console.log(`but Alterior is configured with packageAccess=${buildConfig.packageAccess}`);
            console.log();
            console.log(`** If you changed this setting via publishConfig.access in package.json you should`);
            console.log(`   also change packageAccess in alterior.json after reading the below information.`);
            console.log();

            if (currentAccess === 'public' && buildConfig.publishBackend) {
                console.log(`WARNING: You are publishing a public package that will include your backend`);
                console.log(`implementation. You may be unintentionally publishing code that should not`);
                console.log(`be published!`);
                console.log();
                console.log(`** If you do not wish to include your backend code, set publishBackend=false`);
                console.log(`   in alterior.json`);
                console.log();
            } else if (currentAccess === 'public' && !buildConfig.publishBackend) {
                console.log(`INFO: You are publishing a public package which will not include your backend`);
                console.log(`implementation. Only the generated API client portion of your package will be`);
                console.log(`published.`);
                console.log();
                console.log(`** If you intend to include your backend implementation, set publishBackend=true`);
                console.log(`   in alterior.json`);
            } else if (currentAccess === 'private' && buildConfig.publishBackend) {
                console.log(`INFO: You are publishing a private package which will include both your backend`);
                console.log(`implementation and the generated API client implementation.`);
                console.log();
                console.log(`** If you do not intend to include your backend implementation, set`);
                console.log(`   publishBackend=false in alterior.json`);
            } else if (currentAccess === 'private' && !buildConfig.publishBackend) {
                console.log(`INFO: You are publishing a private package which will not include your backend`);
                console.log(`implementation. Only the generated API client portion of your package will be`);
                console.log(`published.`);
                console.log();
                console.log(`** If you intend to include your backend implementation, set publishBackend=true`);
                console.log(`   in alterior.json`);
            }

            console.log();
            console.log(`NOTE: The above message(s) are intended to ensure you understand the implications of`);
            console.log(`publishing your package to NPM while using Alterior's Transparent Services`);
            console.log(`feature. If you are not careful, you may publish secrets unintentionally.`);
            console.log(`To check what files will be included in your package, run:`);
            console.log(`    npm publish --dry-run`);

            // process.env['ALT_NESTED'] = '1';
            // await commandRunner.run(`npm`, `publish`, `--dry-run`);
            // process.env['ALT_NESTED'] = '0';
            // console.log(`The above is a DRY RUN of publishing your package.`);
            
            console.log(`================================================================================`);
            console.log();

            // for (let key of Object.keys(process.env)) {
            //     console.log(` ** ${key}=${process.env[key]}`);
            // }

            return 1;
        }

        // Make sure we've excluded the backend via .npmignore if necessary

        let pkgConfig = new PackageConfiguration(getWorkingDirectory());
        await pkgConfig.setPublishBackend(buildConfig.publishBackend);

    }
}