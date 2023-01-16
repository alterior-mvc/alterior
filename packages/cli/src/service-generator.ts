import * as path from 'path';
import * as fs from 'fs';
import { CommandRunner } from './command-runner';
import { unindent, capitalize, writeJsonFile, readJsonFile, writeTextFile, makeDirectory, changeWorkingDirectory, pathCombine, askBoolean, writeFileLines, getWorkingDirectory } from './utils';
import { GeneratorCanceled } from './generator-canceled';
import { GeneratorError } from './generator-error';
import { Generator } from './generator';
import { BuildConfig } from './build-config';
import { PackageConfiguration } from './package-configuration';

export class ServiceGenerator extends Generator {
    runner = new CommandRunner();

    static description = 'Generate a backend service';
    async createDirectory() {
        await makeDirectory(this.projectDir);
    }

    async writePackageJson() {
        // Package.json

        let dependencies = [
            '@alterior/runtime',
            '@alterior/web-server',
            '@alterior/express',
            '@alterior/logging',
            '@alterior/di',
            '@alterior/platform-nodejs'
        ];

        let devDependencies = [
            '@alterior/cli',
            'typescript',
            'razmin',
            'chai',
            'rimraf',
            'nodemon',
            '@types/chai',
            '@types/node-fetch',
            '@types/ws'
        ];

        await writeJsonFile('tsconfig.json', {
            "compilerOptions": {
                "outDir": "dist",
                "target": "es2016",
                "module": "commonjs",
                "moduleResolution": "node",
                "declaration": true,
                "emitDecoratorMetadata": true,
                "experimentalDecorators": true,
                "sourceMap": true,
                "esModuleInterop": true
            },
            "include": [
                "./src/**/*.ts"
            ]
        });

        await this.runner.run('npm', 'init');

        if (!fs.existsSync('package.json')) {
            throw new GeneratorCanceled(`Canceled during npm init`);
        }

        await this.runner.run('npm', 'install', ...dependencies);
        await this.runner.run('npm', 'install', ...devDependencies, '-D');

        let pkgJson = await readJsonFile('package.json');

        if (!pkgJson.scripts)
            pkgJson.scripts = {};

        pkgJson.scripts.build = "npm run clean && alt build";
        pkgJson.scripts.rebuild = "alt build";
        pkgJson.scripts.test = "npm run build && node dist/test";
        pkgJson.scripts.start = "npm run build && node dist/main";
        pkgJson.scripts.clean = "rimraf dist .tsbuildinfo";
        pkgJson.scripts.prepublishOnly = "alt prepare";
        
        await writeJsonFile('package.json', pkgJson);

    }

    async installDependencies() {
        await this.runner.run('npm', 'install');
    }

    async makeSkeleton() {
        await Promise.all([
            makeDirectory('src'),
            makeDirectory('dist')
        ]);

        await Promise.all([ 
            makeDirectory(pathCombine('src', this.projectName)),
            makeDirectory(pathCombine('src', 'common'))
        ]);
    }

    async writeGitIgnore() {
        await writeTextFile(
            path.join('.gitignore'), 
            [
                `node_modules/`,
                `dist/`,
                `src/__browser/**`
            ].join(`\n`)
        );
    }

    async writeMainTS() {    
        await writeTextFile(
            path.join('src', 'main.ts'), 
            unindent(
                `
                import '@alterior/platform-nodejs';

                import { Application } from '@alterior/runtime';
                import { WebServer } from '@alterior/web-server';
                import { ExpressEngine } from '@alterior/express';
                import { ${capitalize(this.projectName)} } from './${this.projectName}';

                WebServerEngine.default = ExpressEngine;
                Application.bootstrap(${capitalize(this.projectName)});
                `
            )
        );
    }

    async writeProjectModuleTS() {
        await writeTextFile(
            path.join('src', this.projectName, `${this.projectName}.module.ts`), 
            unindent(
                `
                import { WebService, Get } from '@alterior/web-server';
                
                const PKG = require('../../package.json');

                @WebService()
                export class ${capitalize(this.projectName)} {
                    @Get()
                    async info() {
                        return { 
                            service: PKG.name,
                            version: PKG.version
                        }
                    }
                }
                `
            )
        );
    }

    async writeNPMIgnore() {
        await writeFileLines(
            path.join('.npmignore'),
            [
                `# Files to omit from NPM package`,
                ``
            ]
        );
    }

    async writeBuildConfig() {
        await writeTextFile(
            path.join('alterior.json'), 
            JSON.stringify(this.buildConfig, undefined, 2)
        );
    }

    async configurePackage() {
        let pkgConfig = new PackageConfiguration(getWorkingDirectory());
        await pkgConfig.setPublishBackend(this.buildConfig.publishBackend);
        await pkgConfig.setPackageAccess(this.buildConfig.packageAccess);
    }

    async writeIndexTS() {
        await writeTextFile(
            path.join('src', this.projectName, 'index.ts'), 
            unindent(
                `
                export * from './${this.projectName}.module';
                `
            )
        );
        await writeTextFile(
            path.join('src', 'index.ts'), 
            unindent(
                `
                export { ${capitalize(this.projectName)} } from './${this.projectName}';
                `
            )
        );
    }

    async buildProject() {
        console.log(`Performing initial compilation...`);
        await this.runner.run('npm', 'run', 'build');
    }

    buildConfig : BuildConfig = {
        projectType: 'service',
        publishBackend: false,
        packageAccess: 'private'
    };

    async askQuestions() {
        let isPublic = await askBoolean("Will this package be published to NPM publically?", false);
        this.buildConfig.packageAccess = isPublic ? 'public' : 'private';

        let publishBackendPrompt = `Should the backend code be included when publishing this package to NPM?`;

        if (isPublic) {
            publishBackendPrompt += `\n** Your package is public, so if you intend to only publish an API client, say no`;
        } else {
            publishBackendPrompt += `\n** Your package is private, so it is safe to include the backend`;
        }

        this.buildConfig.publishBackend = await askBoolean(publishBackendPrompt, !isPublic);
    }

    async generate() {
        let projectName = this.projectName;
        let projectDir = this.projectDir;

        if (fs.existsSync(projectDir))
            throw new GeneratorError(`Project directory ${projectDir} already exists`);
        
        await this.askQuestions();

        await this.createDirectory();
        await changeWorkingDirectory(projectDir);
        await this.writePackageJson();
        await this.installDependencies();
        await this.makeSkeleton();
        await this.writeGitIgnore();
        await this.writeMainTS();
        await this.writeProjectModuleTS();
        await this.writeIndexTS();
        await this.writeNPMIgnore();
        await this.buildProject();
        await this.writeBuildConfig();
        await this.configurePackage();
        
        console.log(`================`);
        console.log(`all done!`);
        console.log();
    }
}