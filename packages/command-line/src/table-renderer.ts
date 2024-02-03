import { Terminal } from "./terminal";

/**
 * Renders data into a table format on the command line.
 */
export class TableRenderer {
    constructor(private _terminal : Terminal) {

    }

    public static draw(terminal : Terminal, rows : string[][]): void;
    public static draw(terminal : Terminal, rows : string[]): void;
    public static draw(terminal : Terminal, rows : string[][] | string[]) {
        new TableRenderer(terminal).add(rows as any).draw();
    }

    private _rows : string[][] = [];

    add(rows : string[][]): this;
    add(row : string[]): this;
    add(...args : any[]): this
    {
        let arg = args[0]

        if (typeof arg[0] === 'string')
            this._rows.push(<string[]>arg);
        else
            this._rows.push(...<string[][]>arg);

        return this;
    }

    get rows() {
        return this._rows.slice();
    }

    rightPad(str : string, length : number) {
        while (`${str}`.length < length)
            str += ' ';

        return str;
    }

    draw() {
        let columnCount = this._rows.reduce((pv, cv) => Math.max(pv, cv.length), 0);
        let columnLengths = [];

        for (let column = 0; column < columnCount; ++column) {
            columnLengths.push(this._rows.reduce((pv, cv) => Math.max(pv, `${cv[column]}`.length) + 3, 0));
        }

        for (let row of this.rows) {
            let str = '';
            for (let column = 0; column < columnCount; ++column) {
                let col = row[column];
                str += this.rightPad(col, columnLengths[column]);
            }
            
            this._terminal.writeLine(str);
        }

    }
}
