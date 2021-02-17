import { Process } from "./process";

export class CommandRunner {
    constructor() {

    }

    silent = false;

    private formatArg(arg : string) {
        if (arg.includes(' '))
            return `"${arg}"`;

        return arg;
    }

    async run(...args : string[]) {

        if (!this.silent)
            console.log(`> ${args.map(x => this.formatArg(x)).join(' ')}`);
        
        let result = await Process.run({
            command: args[0], 
            args: args.slice(1),
            shell: false,
            stdio: this.silent ? 'ignore' : 'inherit'
        });

        if (result.code !== 0) {
            console.log(`(!!) ${args[0]} exited with code ${result.code}`);
            throw new Error(`${args[0]} exited with code ${result.code}`);
        }

        if (result.signal) {
            console.log(`(!!) ${args[0]} exited with signal ${result.signal}`);
            throw new Error(`${args[0]} exited with signal ${result.signal}`);
        }
    }
}