import { Terminal } from "./terminal";
import { CommandLineOption } from "./command-line-option";
import { CommandLine } from "./command-line";
import { CommandInfo } from "./command-info";

/**
 * Provides core command line processing functionality.
 * Can represent both the top level command line as 
 * well as nested (ie subcommand) command lines.
 */
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

    private handleHelp() {
        this.showHelp();
        this.exit(0);
    }

    exit(code : number) {
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

    /**
     * Show the help screen for this command. You can override this to customize the output.
     */
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
            this.term.table(this._commands.map(command => [`  ${command.id}`, command.description || '' ]));
        }

        this.term.writeLine();
    }

    private _arguments : string[] = [];
    private _options : CommandLineOption[] = [];

    /**
     * Used to determine if a command line has been loaded into this processor. 
     * If not, some properties may cause the global command line to be processed.
     * 
     * This flag does not prevent new command lines from being loaded into the processor.
     */
    private _prepared = false;
    private _commands : Command[] = [];

    /**
     * Ensures the options and arguments reflect the global command line if 
     * a set of arguments have not yet been loaded.
     */
    private prepareOnDemand() {
        if (!this._prepared)
            this.prepare(process.argv.slice(2));
    }

    /**
     * Get the options that are defined for this command line processor,
     * including those defined by the parent command line processor, if any.
     * 
     * If setArguments() or process() has not yet been called, the global 
     * command line (process.argv) will be processed before returning result.
     */
    get definedOptions(): CommandLineOption[] {
        this.prepareOnDemand();
        return (this.parent?.definedOptions || []).filter(x => !this._options.some(y => y.id === x.id)).concat(this._options);
    }

    /**
     * Get the options that are present given the processed command line.
     */
    get options() {
        return this._options.filter(x => x.present);
    }

    /**
     * Get the arguments that are present given the processed command line.
     * 
     * If setArguments() or process() has not yet been called, the global 
     * command line (process.argv) will be processed before returning result.
     */
    get arguments() {
        this.prepareOnDemand();
        return this._arguments.slice();
    }

    /**
     * Get an option by its ID
     * @param id ID of the option to return
     */
    option(id : string) : CommandLineOption

    /**
     * Define an option.
     * @param option The option to define
     */
    option(option : CommandLineOption) : CommandLine

    /**
     * Retrieve an option.
     * 
     * If setArguments() or process() has not yet been called, the global 
     * command line (process.argv) will be processed before returning the result,
     * so that the `value` and `present` properties will be filled.
     * 
     * @param args 
     * @returns 
     */
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

    /**
     * Define a subcommand.
     * 
     * @param id The ID for the subcommand
     * @param definer A function that defines the available command line options and commands for the subcommand.
     */
    command(id : string, definer : (line : Command) => void) {
        let command = new Command(id, this);
        definer(command);
        this._commands.push(command);

        return this;
    }

    /**
     * Get the first value of an option.
     * 
     * If setArguments() or process() has not yet been called, the global 
     * command line (process.argv) will be processed before returning the result,
     * so that the `value` and `present` properties of the option will be filled.
     * 
     * @param id 
     */
    one(id : string) : string {
        this.prepareOnDemand();
        return this.option(id).value;
    }

    /**
     * Get all values defined by multiple usages of a single option
     * 
     * If setArguments() or process() has not yet been called, the global 
     * command line (process.argv) will be processed before returning the result,
     * so that the `value` and `present` properties of the option will be filled.
     * 
     * @param id 
     */
    multiple(id : string) : string[] {
        this.prepareOnDemand();
        return this.option(id).values;
    }

    /**
     * Get a boolean value for a specific option (ie a "flag")
     * 
     * If setArguments() or process() has not yet been called, the global 
     * command line (process.argv) will be processed before returning the result,
     * so that the `value` and `present` properties of the option will be filled.
     * 
     * @param id 
     */
    flag(id : string) : boolean {
        this.prepareOnDemand();
        let value = this.option(id).value;

        if (['false', '0'].includes(value))
            return false;

        return !!value;
    }

    /**
     * Get the description of this command line processor.
     */
    get description() {
        return '';
    }

    private _runners : ((args : string[]) => void)[] = [];

    /**
     * Define a function that should be run when this instance processes a command line.
     * The function will be passed the set of (non-option) arguments parsed from the overall args.
     * Multiple functions can be defined to run per instance. Each one will run in order, waiting for the 
     * previous function to complete before continuing. 
     * 
     * @param handler The function to call.
     */
    run(handler : (args : string[]) => void) {
        this._runners.push(handler);
        return this;
    }

    /**
     * Set the arguments for this CommandLineProcessor so that the command line can be introspected without 
     * running it. 
     * @param args 
     */
    async setArguments(args: string[]) {
        this.prepare(args);
    }

    /**
     * Process the given command line arguments and run any appropriate run() tasks in order.
     * Returns a promise that resolves when all run() tasks have completed.
     * @param args 
     */
    async process(args? : string[]): Promise<void> {
        for (let task of this.prepare(args))
            await task();
    }

    /**
     * Process the given command line arguments and collect run() tasks.
     * 
     * Side effects:
     * - The `value` and `present` fields of Options will be updated to reflect the given command line.
     * 
     * @param args The arguments
     * @returns The set of runner tasks that should be run, in order, waiting for each to resolve before continuing.
     */
    private prepare(args? : string[]): (() => Promise<void> | void)[] {
        if (!args)
            args = process.argv.slice(2);
        
        this._prepared = true;
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
                    //term.writeLine(JSON.stringify(this._options));
                    this.exit(1);
                }
            } else if (arg.startsWith('-')) {
                option = this._options.find(x => x.short === arg.slice(1));
                if (!option) {
                    term.writeLine(`Unknown option: ${arg}`);
                    this.exit(1);
                }
            }

            if (option) {
                option.present = true;

                let value = '1';

                if (option.valueHint) {
                    value = args[++i];
                    if (value === undefined) {
                        term.writeLine(`Missing argument: ${arg} <${option.valueHint}>`);
                        this.exit(1);
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
                        return command.prepare(args.slice(i + 1));
                    } else {
                        term.writeLine(`No such command: ${arg}`);
                        this.exit(1);
                    }
                }

                this._arguments.push(arg);
            }
        }

        return this._runners.map(runner => async () => await runner(this.arguments));
    }
}

/**
 * Represents a Command defined via the command() method.
 */
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
