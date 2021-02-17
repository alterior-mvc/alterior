import * as path from 'path';
import { CommandRunner } from './command-runner';
import { ServiceGenerator } from './service-generator';
import { GeneratorCanceled } from './generator-canceled';
import { GeneratorError } from './generator-error';
import { LibraryGenerator } from './library-generator';
import { Generator } from './generator';
import { Constructor } from '@alterior/runtime';

export class NewCommand {
    constructor() {
    }

    runner = new CommandRunner();

    generators : Record<string, typeof Generator> = {
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

    async run(args : string[]) {
        if (args.length !== 2) {
            console.error(`usage: alt new <type> <folder>`);
            this.showGeneratorTypes();
            console.error();
            return 1;
        }
        
        let [ type, name ] = args;
        let generatorCtor = <Constructor<Generator>> <unknown> this.generators[type];

        if (!generatorCtor) {
            console.error(`usage: alt new <type> <folder>`);
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