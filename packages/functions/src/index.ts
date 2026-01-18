import * as fs from 'fs';
import * as os from "os";
import * as path from "path";
import * as process from "process";
import * as readline from 'readline';
import * as crypto from "crypto";
import * as childProcess from "child_process";

export function formEncode(obj : any) {
    return Object
        .keys(obj)
        .filter(key => obj[key] !== void 0)
        .map(key => `${encodeURIComponent(key) ?? ''}=${encodeURIComponent(obj[key] ?? '')}`)
        .filter(x => x !== '=')
        .join('&')
    ;
}

export function sha1(data : string | Buffer) : string {
    return crypto.createHash('sha1').update(data).digest('hex');
}

export async function stat(filename : string) {
    return await new Promise<fs.Stats>((rs, rj) => fs.stat(filename, (e, s) => e ? rj(e) : rs(s)));
}

export async function fileExists(filename : string) {
    try {
        let s = await stat(filename);
        return s.isFile() || s.isDirectory();
    } catch (e) {
        return false;
    }
}

export async function dirExists(filename : string) {
    let s = await stat(filename);
    return s.isDirectory();
}

export async function fileSize(filename : string) {
    let s = await stat(filename);
    return s.size;
}

export const MONTHS = [
    'NONE', 'January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'
];

/**
 * https://www.samanthaming.com/tidbits/90-object-from-entries/#alternative-solutions-to-convert-array-%E2%86%92-object
 */
export function toObject(pairs: any[]) {
    return Array.from(pairs).reduce(
        (acc, [key, value]) => Object.assign(acc, { [key]: value }),
        {},
    );
}

export function monthString(month: number) {
    return [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December'
    ][month];
}

export function twoDigitYear(fullYear: number) {
    return Number(fullYear.toString().slice(2));
}

export function zeroPad(number, digits = 2) {
    let str = `${number}`;
    while (str.length < digits)
        str = '0' + str;

    return str;
}

export function randomItem<T>(arr : T[], emptyValue? : T) : T {
    if (arr.length === 0)
        return emptyValue;

    return arr[Math.floor(Math.random() * arr.length)];
}

export function unindent(str : string) {
    let lastNewline = str.lastIndexOf("\n");
    let indent = str.slice(lastNewline+1).replace(/[^ ]/g, '');
    return str.split(/\n/g).map(x => x.replace(indent, '')).join("\n");
}

export function pathResolve(...paths : string[]) {
    return path.resolve(...paths);
}

export function pathCombine(...paths : string[]) {
    return path.join(...paths);
}

export function changeWorkingDirectory(dir : string) {
    process.chdir(dir);
}

export async function askBoolean(prompt : string, defaultValue = true): Promise<boolean> {
    let key = defaultValue ? '[Y/n]' : '[y/N]';
    prompt = `${prompt}\n${key} `;

    while (true) {
        let answer = (await ask(prompt)).toLowerCase();

        if (answer === 'y')
            return true;
        if (answer === 'n')
            return false;
        if (answer === '')
            return defaultValue;

        console.log(`Please type Y or N (or hit enter to accept default)`);
    }
}

export function ask(prompt : string) {
    return new Promise<string>(resolve => {
        let rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(`\n${prompt}`, answer => {
            rl.close();
            resolve(answer)
        });
    });
}

export function getWorkingDirectory() {
    return process.cwd();
}

export function capitalize(name : string) {
    return name[0].toUpperCase() + name.slice(1);
}

export async function readFileLines(filename : string): Promise<string[]> {
    return (await readTextFile(filename)).split(os.EOL);
}

export function lineRangeTagStart(name : string) {
    return `θ[${name}]`;
}

export function lineRangeTagEnd(name : string) {
    return `θ[/${name}]`;
}

export function replaceTaggedLineRange(content : string[], tagName : string, lines : string[]) {
    let startIndex = content.findIndex(line => line.includes(this.lineRangeTagStart(tagName)));
    content = removeTaggedLineRange(content, tagName);

    if (startIndex) {
        content.splice(startIndex, 0, ...lines);
    } else {
        content.push(...lines);
    }

    return content;
}

export function removeTaggedLineRange(content : string[], tag : string) {
    let filtered : string[] = [];
    let included = true;
    let tagStart = lineRangeTagStart(tag);
    let tagEnd = lineRangeTagEnd(tag);

    for (let line of content) {
        if (line.includes(tagStart)) {
            included = false;
            continue;
        } else if (line.includes(tagEnd)) {
            included = true;
            continue;
        }

        if (!included)
            continue;
        filtered.push(line);
    }

    return filtered;
}

export async function writeFileLines(filename : string, lines : string[]): Promise<void> {
    this.writeTextFile(filename, lines.join(os.EOL));
}

export async function readJsonFile<T = any>(filename : string, defaultValue?: T) : Promise<T> {
    if (defaultValue !== void 0) {
        if (!await fileExists(filename))
            return defaultValue;
    }

    return await new Promise((res, rej) =>
        fs.readFile(filename, (err, buf) => {
            try {
                err ? rej(err) : res(JSON.parse(buf.toString('utf-8')))
            } catch (e) {
                rej(e);
            }
        })
    );
}

export async function readTextFile(filename : string) : Promise<string> {
    return await new Promise((res, rej) =>
        fs.readFile(filename, (err, buf) =>
            err ? rej(err) : res(buf.toString('utf-8'))
        )
    );
}

export async function writeJsonFile<T = any>(filename : string, content : T, indent = 2) {
    await new Promise<void>((resolve, reject) => {
        fs.writeFile(filename, JSON.stringify(content, undefined, 2), err => err ? reject(err) : resolve());
    });
}

export async function writeTextFile(filename : string, content : string) {
    await new Promise<void>((resolve, reject) => {
        fs.writeFile(filename, content, err => err ? reject(err) : resolve());
    });
}

export const raise = (e: string|Error) => { throw typeof e === 'string' ? new Error(e) : e; };
export const timeout = (time: number | string = 0) => new Promise<void>(r => setTimeout(r, timespan(time)));
export function timespan(amount: string | number): number {
    if (amount === 'inf' || !amount)
        return Infinity;
    
    if (typeof amount === 'number')
        return amount;
    
    let result = amount.match(/(\d+)([smhd])/)
    if (!result)
        throw new Error(`Cannot parse timespan '${amount}'!`);
    let [full, numStr, unit] = result;
    let number = Number(numStr);

    switch (unit) {
        case 's': return number * 1000;
        case 'm': return number * 1000 * 60;
        case 'h': return number * 1000 * 60 * 60;
        case 'd': return number * 1000 * 60 * 60 * 24;
    }
}

export function age(timestamp: Date) {
    let now = Date.now();
    let diff = now - timestamp.getTime();
    let minute = 1000 * 60;
    let hour = minute * 60;
    let day = hour * 24;
    let week = day * 7;
    let month = day * 30;
    let year = day * 365;

    if (diff > year) {
        return timestamp.toString();
    }

    if (diff > month) {
        let months = Math.floor(diff / month);

        if (months === 1)
            return `${months} month ago`;
        else
            return `${months} months ago`;

    } else if (diff > week) {
        let weeks = Math.floor(diff / week);

        if (weeks === 1)
            return `${weeks} week ago`;
        else
            return `${weeks} weeks ago`;
    } else if (diff > day) {
        let days = Math.floor(diff / day);
        if (days === 1)
            return `${days} day ago`;
        else
            return `${days} days ago`;
    } else if (diff > hour) {
        let hours = Math.floor(diff / hour);
        if (hours === 1)
            return `${hours} hour ago`;
        else
            return `${hours} hours ago`;
    } else if (diff > minute) {
        let minutes = Math.floor(diff / minute);
        if (minutes === 1)
            return `${minutes} minute ago`;
        else
            return `${minutes} minutes ago`;
    } else if (diff > 30_000) {
        return `about a minute ago`;
    } else {
        return `just now`;
    }
}

/**
 * https://stackoverflow.com/a/46759625
 */
export function isConstructor(f) {
    if (f === Symbol)
        return false;

    try {
        Reflect.construct(String, [], f);
    } catch (e) {
        return false;
    }
    return true;
}

export function count<T>(array: T[], check: (element: T) => boolean) {
    let count = 0;
    for (let element of array) {
        if (check(element))
            count += 1;
    }
    return count;
}