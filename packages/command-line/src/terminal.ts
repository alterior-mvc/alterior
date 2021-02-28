import { TableRenderer } from "./table-renderer";

export interface TerminalDriver {
    write(message : string);
}

export class NodeTerminalDriver implements TerminalDriver {
    write(message: string) {
        process.stdout.write(message);
    }
}

export class StringTerminalDriver implements TerminalDriver {
    buffer : string;
    write(message: string) {
        this.buffer += message;
    }
}

export class TeeTerminalDriver extends StringTerminalDriver {
    constructor(private underlyingDriver : TerminalDriver) {
        super();
    }

    write(message : string) {
        super.write(message);
        this.underlyingDriver.write(message);
    }
}

export class MultiplexedTerminalDriver implements TerminalDriver {
    constructor(private drivers : TerminalDriver[]) {
    }

    write(message : string) {
        this.drivers.forEach(d => d.write(message));
    }
}

export class TerminalDriverSelector {
    private static _default : TerminalDriver;

    public static get default() {
        if (this._default)
            return this._default;
           
        if (typeof process !== 'undefined')
            return new NodeTerminalDriver();
        else
            return new StandardTerminalDriver();
    }

    public static set default(value : TerminalDriver) {
        this._default = value;
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
        this.driver.write(message);
        if (typeof process !== 'undefined')
            process.stdout.write(message);
    }

    writeLine(message? : string) {
        this.driver.write(`${message || ''}\n`);
    }

    table(rows : string[][]) {
        TableRenderer.draw(this, rows);
    }
}
