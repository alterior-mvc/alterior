import { Terminal } from "./terminal";
import * as path from 'path';

export interface CommandLineOption {
    id : string;
    description : string;
    short? : string;
    valueHint? : string;
    values? : string[];
    value? : string;
    present? : boolean;
    handler? : () => void;
}

export interface ProgramInfo {
    executable? : string;
    description? : string;
    argumentUsage? : string;
    version? : string;
    copyright? : string;
}

export interface CommandInfo {
    description? : string;
    argumentUsage? : string;
}

export class CommandLineProcessor {
    constructor(readonly parent? : CommandLineProcessor) {
        this.option({
            id: 'help',
            short: 'h',
            description: 'Show help information',
            handler: () => this.handleHelp()
        })
    }

    protected term = new Terminal();

    handleHelp() {
        this.showHelp();
        process.exit(0);
    }

    get argumentUsage() {
        return '';
    }

    get optionUsage() {
        let usage = [];

        if (this.parent)
            usage.push(`${this.parent.optionUsage}`);
        
        if (this.commandName)
            usage.push(this.commandName);

        for (let option of this._options) {
            if (['help', 'version'].includes(option.id))
                continue;
            
            if (option.valueHint) {
                usage.push(`[--${option.id} <${option.valueHint}>]`);
            } else {
                usage.push(`[--${option.id}]`);
            }
        }

        return usage.join(' ');
    }

    get commandName() : string {
        return null;
    }

    get commandUsage() {
        if (this._commands.length > 0)
            return `<command> [<args>]`;

        return this.argumentUsage;
    }

    get usage() {
        let usage = [];

        usage.push(this.optionUsage);

        if (this.commandUsage)
            usage.push(this.commandUsage);

        return usage.join(' ');
    }

    showUsage() {
        this.term.writeLine();
        this.term.writeLine(`usage: ${this.usage}`)
        if (this.description)
            this.term.writeLine(`${this.description}`);
        this.term.writeLine();
    }

    showHelp() {
        this.showUsage();
        this.term.table(
            this.definedOptions.map(option => [
                `--${option.id}${option.short ? `, -${option.short}` : ``} ${option.valueHint? `<${option.valueHint}>` : ``}`,
                `${option.description}`
            ])
        );
        this.term.writeLine();

        if (this._commands.length > 0) {
            this.term.writeLine(`Commands:`);
            this.term.table(this._commands.map(command => [`  ${command.id}`, command.description]));
        }

        this.term.writeLine();
    }

    private _arguments : string[] = [];
    private _options : CommandLineOption[] = [];
    private _processed = false;
    private _commands : Command[] = [];

    prepareOnDemand() {
        if (!this._processed)
            this.process(process.argv.slice(2));
    }

    get definedOptions(): CommandLineOption[] {
        this.prepareOnDemand();
        return (this.parent?.definedOptions || []).filter(x => !this._options.some(y => y.id === x.id)).concat(this._options);
    }

    get options() {
        return this._options.filter(x => x.present);
    }

    get arguments() {
        this.prepareOnDemand();
        return this._arguments.slice();
    }

    option(id : string) : CommandLineOption
    option(option : CommandLineOption) : CommandLine
    option(...args : any[]) : any {
        if (args.length === 1 && typeof args[0] === 'string') {
            this.prepareOnDemand();
            return this._options.find(x => x.id === args[0]) || this.parent?.option(args[0]);
        } else if (args.length === 1) {
            let option = <CommandLineOption>args[0];
            option.values = [];
            option.value = null;

            this._options = this._options.filter(x => x.id !== option.id);

            this._options.push(option);
            return this;
        }
    }

    command(id : string, definer : (line : Command) => void) {
        let command = new Command(id, this);
        definer(command);
        this._commands.push(command);

        return this;
    }

    one(id : string) : string {
        this.prepareOnDemand();
        return this.option(id).value;
    }

    multiple(id : string) : string[] {
        this.prepareOnDemand();
        return this.option(id).values;
    }

    flag(id : string) : boolean {
        this.prepareOnDemand();
        let value = this.option(id).value;

        if (['false', '0'].includes(value))
            return false;

        return !!value;
    }

    get description() {
        return '';
    }

    private _runners : ((args : string[]) => void)[] = [];

    run(handler : (args : string[]) => void) {
        this._runners.push(handler);
        return this;
    }

    process(args? : string[]) {
        if (!args)
            args = process.argv.slice(2);
        
        this._processed = true;
        this._arguments = [];
        this._options.forEach(x => {
            x.values = [];
            x.value = null;
            x.present = false;
        });

        let term = new Terminal();

        for (let i = 0, max = args.length; i < max; ++i) {
            let arg = args[i];
            let option : CommandLineOption;

            if (arg.startsWith('--')) {
                option = this.option(arg.slice(2));
                if (!option) {
                    term.writeLine(`Unknown option: ${arg}`);
                    term.writeLine(JSON.stringify(this._options));
                    process.exit(1);
                }
            } else if (arg.startsWith('-')) {
                option = this._options.find(x => x.short === arg.slice(1));
                if (!option) {
                    term.writeLine(`Unknown option: ${arg}`);
                    process.exit(1);
                }
            }

            if (option) {
                option.present = true;

                let value = '1';

                if (option.valueHint) {
                    value = args[++i];
                    if (value === undefined) {
                        term.writeLine(`Missing argument: ${arg} <${option.valueHint}>`);
                        process.exit(1);
                    }
                }

                option.value = value;
                option.values.push(value);
                
                if (option.handler)
                    option.handler();
            } else {
                if (this._commands.length > 0) {
                    let command = this._commands.find(x => x.id === arg);

                    if (command) {
                        command.process(args.slice(i + 1));
                        return;
                    } else {
                        term.writeLine(`No such command: ${arg}`);
                        process.exit(1);
                    }
                }

                this._arguments.push(arg);
            }
        }

        for (let runner of this._runners) {
            runner(this.arguments);
        }

        return this;
    }
}

export class CommandLine extends CommandLineProcessor {
    constructor() {
        super();

        this.option({
            id: 'version',
            description: 'Show version information',
            handler: () => this.handleVersion()
        })
    }

    private _info : ProgramInfo = {};

    get commandName() {
        return `${this._info.executable || path.basename(process.argv[1])}`;
    }

    info(info : ProgramInfo) {
        this._info = info;
        return this;
    }

    showHelp() {
        super.showHelp();
        
        let info = [];

        if (this._info.version)
            info.push(`Version ${this._info.version}`);
        if (this._info.copyright)
            info.push(`© ${this._info.copyright}`);
        
        if (info.length > 0) {
            this.term.writeLine(info.join("\n"));
            this.term.writeLine();
        }
    }

    get description() {
        return this._info?.description;
    }

    get argumentUsage() {
        return this._info.argumentUsage;
    }

    handleVersion() {
        this.showVersion();
        process.exit(0);
    }

    showVersion() {
        this.term.writeLine(`${this.commandName} ${this._info.version || ''}`);

        if (this._info.copyright) {
            this.term.writeLine(`© ${this._info.copyright}`);
        }

        this.term.writeLine();
    }
}

export class Command extends CommandLineProcessor {
    constructor(readonly id : string, readonly parent : CommandLineProcessor) {
        super(parent);
    }

    get commandName() {
        return this.id;
    }

    get argumentUsage() {
        return this._info.argumentUsage;
    }

    private _info : CommandInfo = {};
    info(info : CommandInfo) {
        this._info = info;
        return this;
    }

    get description() {
        return this._info?.description;
    }
}
