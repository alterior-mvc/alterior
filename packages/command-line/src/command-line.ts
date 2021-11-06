import { CommandLineProcessor } from "./command-line-processor";
import { ProgramInfo } from "./program-info";
import * as path from "path";

/**
 * Process the command line providing an application-like CLI experience 
 * including showing version information (providied via the info() fluent method)
 * and defining `--version` option for showing the application's version.
 */
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
        this.exit(0);
    }

    showVersion() {
        this.term.writeLine(`${this.commandName} ${this._info.version || ''}`);

        if (this._info.copyright) {
            this.term.writeLine(`© ${this._info.copyright}`);
        }

        this.term.writeLine();
    }
}
