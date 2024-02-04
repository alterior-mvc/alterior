import { Constructor } from '@alterior/runtime';
import inquirer from 'inquirer';
import * as path from 'path';
import { CommandRunner } from './command-runner';
import { Generator } from './generator';
import { GeneratorCanceled } from './generator-canceled';
import { GeneratorError } from './generator-error';
import { LibraryGenerator } from './library-generator';
import { ServiceGenerator } from './service-generator';

export class NewCommand {
    constructor() {
    }

    runner = new CommandRunner();

    generators: Record<string, typeof Generator> = {
        service: ServiceGenerator,
        library: LibraryGenerator
    }

    private showGeneratorTypes() {
        console.error();
        console.error(`Available types:`);
        for (let type of Object.keys(this.generators)) {
            let gen = this.generators[type];
            console.error(`    ${type}: ${gen.description}`);
        }
    }

    async run(args: string[]) {
        let showUsage = () => console.error(`usage: alt new [<type>] <folder>`);
        if (args.length < 1) {
            showUsage();
            this.showGeneratorTypes();
            console.error();
            return 1;
        }

        let type: string | undefined;
        let name!: string;

        if (args.length === 2) {
            type = args[0];
            name = args[1];
        } else if (args.length === 1) {
            name = args[0];
        }

        if (!type) {
            console.log();
            let answers = await inquirer.prompt<{ type: string }>([
                {
                    message: 'What type of project are you creating?',
                    name: 'type',
                    choices: [
                        { name: 'Web Service (REST/Conduit)', value: 'service', checked: true },
                        { name: 'App', value: 'app' },
                        { name: 'Library', value: 'library' }
                    ],
                    type: 'list'
                }
            ]);

            type = answers.type;
        }

        let generatorCtor = <Constructor<Generator>><unknown>this.generators[type];

        if (!generatorCtor) {
            showUsage();
            console.error(` * No generator for type '${type}'`);
            this.showGeneratorTypes();
            console.error();
            return 1;
        }

        let dir = path.join(process.cwd(), name);
        let generator = new generatorCtor(name, dir);

        try {
            await generator.generate();
        } catch (e) {
            if (e instanceof GeneratorCanceled)
                return 0;

            if (e instanceof GeneratorError) {
                console.error(`alt new: ${e.message}`);
                return 1;
            }

            throw e;
        }
    }
}