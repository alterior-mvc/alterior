import { LogListener } from './log-listener';
import { LogFormatter } from './log-formatter';
import { LogEvent } from './log-event';
import { LogFormat } from './log-format';

import * as fs from 'node:fs';

export class FileLogger implements LogListener {
    constructor(
        readonly format: LogFormat,
        readonly filename: string
    ) {
        this.formatter = new LogFormatter(format);
    }

    private formatter: LogFormatter;
    private _fdReady: Promise<number> | undefined;

    get ready() {
        return this._fdReady;
    }

    async open() {
        if (this._fdReady)
            return await this._fdReady;

        return await (this._fdReady = new Promise((res, rej) => {
            fs.open(this.filename, 'a', (err, fd) => {
                if (err)
                    rej(err);
                else
                    res(fd);
            });
        }));
    }

    async write(str: string) {
        let fd = await this.open();
        await new Promise<void>((res, rej) => {
            fs.write(fd, Buffer.from(str), (err, written, buffer) => {
                if (err) {
                    rej(err);
                    return;
                }
                
                // sync to flush this to disk right away
                fs.fdatasync(fd, (err) => err ? rej(err): res());
            });
        });
    }

    async log(message: LogEvent) {
        let formattedMessage = this.formatter.format(message);
        await this.write(`${formattedMessage}\n`);
    }
}
