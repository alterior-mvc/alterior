import { TableRenderer } from "./table-renderer";

export interface TerminalDriver {
    write(message : string);
}

export class NodeTerminalDriver implements TerminalDriver {
    write(message: string) {
        process.stdout.write(message);
    }
}

export class TerminalDriverSelector {
    public static get default() {
        if (typeof process !== 'undefined')
            return new NodeTerminalDriver();
        else
            return new StandardTerminalDriver();
    }
}

export class StandardTerminalDriver implements TerminalDriver {
    private _buffer = '';

    write(message: string) {
        let newlinePos = message.indexOf("\n");

        while (newlinePos) {
            let line = message.substr(0, newlinePos);
            this._buffer += line;
            this.flushBuffer();
            message = message.substr(newlinePos);
        }

        this._buffer += message;
    }

    flushBuffer() {
        console.log(this._buffer);
        this._buffer = '';
    }
}

export class Terminal {
    constructor(driver? : TerminalDriver) {
        this.driver = driver || TerminalDriverSelector.default;
    }

    driver : TerminalDriver;

    write(message : string) {
        if (typeof process !== 'undefined')
            process.stdout.write(message);
    }

    writeLine(message? : string) {
        process.stdout.write(`${message || ''}\n`);
    }

    table(rows : string[][]) {
        TableRenderer.draw(this, rows);
    }
}
