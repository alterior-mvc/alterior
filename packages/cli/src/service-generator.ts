import inquirer from 'inquirer';
import { BuildConfig, ServiceBuildConfig } from './build-config';
import { CommandRunner } from './command-runner';
import { Generator } from './generator';
import { GeneratorError } from './generator-error';
import { PackageConfiguration } from './package-configuration';
import { capitalize, changeWorkingDirectory, getWorkingDirectory, makeDirectory, toUpperCamelCase, unindent, writeJsonFile, writeTextFile } from './utils';

import * as fs from 'fs';
import ora from 'ora';
import * as os from 'os';
import * as path from 'path';
import { SPDX } from './spdx';

export interface ServiceGenerationSettings {
    engine: 'express' | 'fastify';
    moduleClassName: string;
    serviceName: string;
}

export class ServiceGenerator extends Generator {
    runner = new CommandRunner(true);

    static description = 'Generate a backend service';
    async createDirectory() {
        await makeDirectory(this.projectDir);
    }

    async writePackageJson() {
        // Package.json

        await writeJsonFile('tsconfig.json', {
            "compilerOptions": {
                "outDir": "dist",
                "target": "ES2016",
                "module": "commonjs",
                "moduleResolution": "node",
                "strict": true,
                "declaration": true,
                "emitDecoratorMetadata": true,
                "experimentalDecorators": true,
                "resolveJsonModule": true,
                "sourceMap": true,
                "esModuleInterop": true
            },
            "include": [
                "./src/**/*.ts"
            ]
        });

        await writeJsonFile('package.json', this.packageJson);

    }

    async installDependencies() {
        let dependencies = [
            '@alterior/runtime',
            '@alterior/web-server',
            `@alterior/${this.serviceGenerationSettings.engine}`,
            '@alterior/logging',
            '@alterior/di',
            '@alterior/platform-nodejs',
            '@astronautlabs/conduit'
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

        await this.runner.run('npm', 'install', ...dependencies);
        await this.runner.run('npm', 'install', ...devDependencies, '-D');
    }

    async writeIgnores() {
        await writeTextFile(
            path.join('.gitignore'), 
            unindent(
                `
                node_modules/
                dist/
                *.env
                `
            )
        );
        await writeTextFile(
            path.join('.npmignore'),
            unindent(
                `
                ##############################################
                # Alterior: Exclude server from NPM package
                ./src/server/**
                ./dist/server/**
                ##############################################
                # Files to omit from NPM package
                `
            )
        );
    }

    async writeCode() {
        let engineClass = `${capitalize(this.serviceGenerationSettings.engine)}Engine`;
        let enginePackage = `@alterior/${this.serviceGenerationSettings.engine}`;
        
        await writeTextFile(
            path.join('src', 'interface', 'index.ts'), 
            unindent(
                `
                import * as conduit from '@astronautlabs/conduit';
                
                @conduit.Name('${this.serviceGenerationSettings.serviceName}')
                export abstract class ${this.serviceGenerationSettings.moduleClassName} {
                    abstract info(): Promise<{ service: string, version: string }>;
                }
                `
            )
        );

        await writeTextFile(
            path.join('src', 'server', 'main.ts'), 
            unindent(
                `
                import '@alterior/platform-nodejs';

                import { Application } from '@alterior/runtime';
                import { WebServer, WebServerEngine } from '@alterior/web-server';
                import { ${engineClass} } from '${enginePackage}';
                import { ${this.serviceGenerationSettings.moduleClassName} } from './server';

                WebServerEngine.default = ${engineClass};
                Application.bootstrap(${this.serviceGenerationSettings.moduleClassName});
                `
            )
        );

        await writeTextFile(
            path.join('src', 'server', `server.ts`), 
            unindent(
                `
                import { WebService, Get } from '@alterior/web-server';
                import * as Interface from '../interface';

                @WebService()
                export class ${this.serviceGenerationSettings.moduleClassName} extends Interface.${this.serviceGenerationSettings.moduleClassName} {
                    @Get()
                    async info() {
                        const PKG = await import('../../package.json');

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

    async writeBuildConfig() {
        await writeTextFile(
            path.join('alterior.json'), 
            JSON.stringify(this.buildConfig, undefined, 2)
        );
    }

    async configurePackage() {
        let pkgConfig = new PackageConfiguration(getWorkingDirectory());
        await pkgConfig.setPublishBackend(false);
        await pkgConfig.setPackageAccess(this.packageJson.publishConfig.access);
    }

    async buildProject() {
        await this.runner.run('npm', 'run', 'build');
    }

    buildConfig : BuildConfig = {
        projectType: 'service',
        service: {
            publishBackend: false
        }
    };

    serviceGenerationSettings: ServiceGenerationSettings = {
        engine: 'express',
        moduleClassName: toUpperCamelCase(this.projectName),
        serviceName: `com.example.${toUpperCamelCase(this.projectName)}`
    };

    packageJson: any = {
        name: this.projectName,
        private: true,
        version: '0.0.0',
        description: '',
        main: './dist/interface',
        publishConfig: { access: 'private' },
        author: os.userInfo()?.username,
        license: 'UNLICENSED',
        scripts: {
            build: "npm run clean && alt build",
            rebuild: "alt build",
            test: "npm run build && node dist/test",
            start: "npm run build && node dist/main",
            clean: "rimraf dist .tsbuildinfo",
            prepublishOnly: "alt prepare",
        }
    };

    async askQuestions() {
        console.log();

        let packageAnswers = await inquirer.prompt<typeof this.packageJson>([
            {
                message: `package.json » Package name`,
                type: 'input',
                default: this.packageJson.name,
                name: 'name'
            },
            {
                message: `package.json » Initial version`,
                type: 'input',
                default: this.packageJson.version,
                name: 'version'
            },
            {
                message: `package.json » Description`,
                type: 'input',
                default: this.packageJson.description,
                name: 'description'
            },
            {
                message: `package.json » Author`,
                type: 'input',
                default: this.packageJson.author,
                name: 'author'
            },
            {
                message: `package.json » License`,
                type: 'list',
                default: this.packageJson.license,
                name: 'license',
                choices: [
                    new inquirer.Separator('--------- Common Options ---------'),

                    { value: 'UNLICENSED', name: 'All Rights Reserved [UNLICENSED]' },
                    { value: 'MIT', name: 'MIT License [MIT]' },
                    { value: 'Apache-2.0', name: 'Apache 2.0 License [Apache-2.0]' },
                    { value: 'GPL-2.0-or-later', name: 'GNU General Public License v2 or later [GPL-2.0-or-later]' },
                    { value: 'GPL-3.0-or-later', name: 'GNU General Public License v3 or later [GPL-3.0-or-later]' },
                    { value: 'AGPL-1.0', name: 'Affero General Public License 1.0 [AGPL-1.0]' },

                    new inquirer.Separator('--------- All Options ---------'),

                    ...SPDX.licenses.map(license => ({
                        name: `[${license.licenseId}] ${license.name}`,
                        value: license.licenseId
                    }))
                ]
            }
        ]);

        console.log();

        Object.assign(this.packageJson, packageAnswers);

        let serviceConfigAnswers = await inquirer.prompt<ServiceBuildConfig>([
            {
                message: 'Which web server engine would you like to use?',
                name: 'engine',
                type: 'list',
                choices: [
                    { name: 'Express', value: 'express', checked: this.serviceGenerationSettings.engine === 'express' },
                    { name: 'Fastify', value: 'fastify', checked: this.serviceGenerationSettings.engine === 'fastify' },
                ]
            },
            {
                message: `What class name should be used for the main @WebService() class?`,
                type: 'input',
                default: this.serviceGenerationSettings.moduleClassName,
                name: 'moduleClassName'
            },
            {
                message: `What Conduit service name should be used for the main @WebService() class?`,
                type: 'input',
                default: this.serviceGenerationSettings.serviceName,
                name: 'moduleClassName'
            }
        ]);

        Object.assign(this.serviceGenerationSettings, serviceConfigAnswers);
    }

    async generate() {
        let projectDir = this.projectDir;

        if (fs.existsSync(projectDir))
            throw new GeneratorError(`Project directory ${projectDir} already exists`);
        
        await this.askQuestions();

        console.log();

        let spinner = ora();
        spinner.start('Generating project...');
        await this.createDirectory();
        await changeWorkingDirectory(projectDir);
        await this.writePackageJson();
        await this.configurePackage();
        await this.writeBuildConfig();
        await this.writeIgnores();
        await this.writeCode();
        spinner.succeed('Generated project.');

        spinner.start('Installing dependencies...');
        await this.installDependencies();
        spinner.succeed('Dependencies installed.');

        spinner.start('Building project...');
        await this.buildProject();
        spinner.succeed('Project built.');
        spinner.succeed('Done.');
        console.log();
    }
}