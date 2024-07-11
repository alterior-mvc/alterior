import { CommandRunner } from './command-runner';
import { getWorkingDirectory, readJsonFile, pathCombine, readTextFile, fileExists } from './utils';
import { BuildConfig } from './build-config';
import { PackageConfiguration } from './package-configuration';

export class LintCommand {
    constructor() {
    }

    runner = new CommandRunner();

    private dir! : string;

    private reportLintError(code : string, message : string) {
        console.error(`[${code}] ${message}`);
        console.error(`    https://github.com/alterior-mvc/alterior/wiki/Lint_${code}`);
        console.error();
    }

    private async checkAccess() {
        
        // @ts-ignore unused
        let buildConfig = await readJsonFile<BuildConfig>(pathCombine(this.dir, 'alterior.json'));
        let pkgConfig = new PackageConfiguration(getWorkingDirectory());
        
        // @ts-ignore unused
        let currentAccess = await pkgConfig.getPackageAccess();
        
        // if (currentAccess !== buildConfig.packageAccess) {
        //     this.reportLintError(
        //         'PackageAccessMismatch', 
        //         'The packageAccess option of alterior.json does not match the publishing behavior specified in package.json'
        //     );
        // }
    }

    private async checkEntrypoint(name : string, filename : string, errorMessage : string) {
        if (!filename) {
            this.reportLintError(
                'MissingEntrypoint',
                `The '${name}' field of package.json is not specified. ${errorMessage}`
            );
            return;
        }

        if (!await fileExists(filename)) {
            this.reportLintError(
                'MissingEntrypoint',
                `The '${name}' field of package.json points to a file that does not exist ('${filename}')`
            );
            return;
        }
    }

    private async checkTypes(pkgJson : any) {
        if (!pkgJson.types && !pkgJson.typings) {
            this.reportLintError(
                'TypesNotProvided',
                `The 'types' field of package.json is not specified. Package will not have Typescript intellisense`
            );
            return;
        }

        let filename = pkgJson.types || pkgJson.typings;
        if (!await fileExists(filename)) {
            this.reportLintError(
                'TypesNotProvided',
                `The 'types' field of package.json points to a file that does not exist ('${filename}')`
            );
        }
    }

    private async checkMainDefn() {
        let pkgJson = await readJsonFile(pathCombine(this.dir, 'package.json'));

        // Entry points

        await this.checkEntrypoint('main', pkgJson.main, 'Package will not be usable in CommonJS environments');
        await this.checkEntrypoint('browser', pkgJson.browser, 'Package will not be usable in older versions of Webpack');
        await this.checkEntrypoint('module', pkgJson.module, 'Package will not be usable in environments which require Ecmascript modules');
        
        // TypesNotProvided

        await this.checkTypes(pkgJson);
    }

    private async checkMainTS() {
        // @ts-ignore unused
        let pkgJson = await readJsonFile(pathCombine(this.dir, 'package.json'));

        let guessedMainTS = 'src/main.ts';
        // @ts-ignore unused
        let jsEntrypointFile = 'dist/main.js';

        if (!await fileExists(guessedMainTS)) {
            this.reportLintError(
                `NoMainTS`, 
                `No main.ts file can be found`
            );
            return;
        }
        
        let mainTS = await readTextFile(guessedMainTS);

        if (!mainTS.match(/import ['"]source-map-support\/register['"]/)) {
            this.reportLintError(
                `MissingSourceMapSupport`, 
                `The main entrypoint does not import "source-map-support/register", stack traces will not use Typescript sources`
            );
        }

        if (!mainTS.match(/import ['"]zone.js['"]/)) {
            this.reportLintError(
                `MissingZoneJS`, 
                `The main entrypoint does not import "zone.js", some Alterior functionality may not work correctly`
            );
        }

        if (!mainTS.match(/import ['"]reflect-metadata['"]/)) {
            this.reportLintError(
                `MissingReflectMetadata`, 
                `The main entrypoint does not import "reflect-metadata". This could cause problems if decorators are used before Alterior is loaded`
            );
        }
    }

    async run(args : string[]) {
        if (args.length !== 0) {
            console.error(`usage: alt lint`);
            console.error(`** Extra arguments were passed (none expected)`);
            return 1;
        }

        this.dir = getWorkingDirectory();
        await this.checkAccess();
        await this.checkMainDefn();
        await this.checkMainTS();
    }
}