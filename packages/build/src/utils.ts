import { pathCombine } from '@alterior/functions';
import { exec, spawn } from 'child_process';
import { Glob } from 'glob';
import { mkdirp } from "mkdirp";
import { rimraf } from "rimraf";
import { Readable } from 'stream';
import { promisify } from 'util';

import * as childProcess from 'child_process';
import * as crypto from "crypto";
import * as fs from 'fs';
import * as jsonc from 'jsonc-parser';
import * as os from "os";
import * as path from "path";
import * as process from "process";
import * as readline from 'readline';
import { Observable } from 'rxjs';

const pExec = promisify(childProcess.exec);

export async function openEditor(filename: string) {
    runCommand(`code ${filename}`);
}

export async function runSimple(command: string): Promise<void> {
    let proc = spawn(command, { stdio: 'inherit' });
    await new Promise<void>((rs, rj) =>
        proc.addListener('exit', code =>
            code ? rj(new Error(`Exited with code ${code}`)) : rs())
    )
}

export async function runCommand(command: string, stdin?: string): Promise<{ stdout, stderr, error }> {
    return new Promise(async (r, rej) => {
        let proc = exec(command, {
            maxBuffer: Number.MAX_SAFE_INTEGER
        }); // (ex, o, e) => r({ stdout: o, stderr: e, error: ex }));
        if (stdin !== undefined) {
            proc.stdin.write(stdin);
            proc.stdin.end();
        }

        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (chunk: Buffer) => {
            try {
                stdout += chunk.toString('utf-8');
            } catch (e) {
                rej(e);
            }
        });
        proc.stderr.on('data', (chunk: Buffer) => {
            try {
                stderr += chunk.toString('utf-8')
            } catch (e) {
                rej(e);
            }
        });

        let [error] = await Promise.all([
            new Promise<Error>(r => proc.on('exit', x => {
                return r(x ? new Error(`Exit code ${x}`) : undefined);
            })),
            new Promise<void>(r => proc.stdout.on('close', () => {
                r();
            })),
            new Promise<void>(r => proc.stderr.on('close', () => {
                r();
            }))
        ])

        r({ stdout: stdout, stderr: stderr, error });
    });
}

export async function removeDirectory(path: string) {
    await rimraf(path);
}
export async function makeDirectory(path: string) {
    await mkdirp(path);
}

export function getFileName(fullPath: string, suffix?: string) {
    return path.basename(fullPath, suffix);
}

export function timeoutGuard<T>(timeLimit: number, message: string, promise: Promise<T>): Promise<T> {
    return Promise.race<T>([
        timeout(timeLimit).then(() => {
            throw new Error(`${message}: Timed out after ${timeLimit} ms`)
        }),
        promise
    ]);
}

export function timeoutFallback<T>(timeLimit: number, fallbackValue: T, promise: Promise<T>): Promise<T> {
    return Promise.race<T>([
        timeout(timeLimit).then(() => fallbackValue),
        promise
    ]);
}

export function getDirectoryPath(fullPath: string) {
    return path.dirname(fullPath);
}

export function isGuid(str: string) {
    return /^[{]?[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}[}]?$/.test(str);
}

export function removeFile(filename: string): Promise<void> {
    return new Promise<void>((rs, rj) => {
        fs.unlink(filename, (err) => err ? rj(err) : rs());
    });
}

export function getFileNameWithoutExtension(fullPath: string) {
    return getFileName(fullPath).replace(/\.[^\.]*?$/, '');
}

export function getFileNameExtension(fullPath: string) {
    return getFileName(fullPath).replace(/.*\./, '');
}

export function listDirectory(fullPath: string): Promise<string[]> {
    return new Promise((res, rej) => {
        fs.readdir(fullPath, (err, files) => err ? rej(err) : res(files));
    });
}

export function formEncode(obj: any) {
    return Object
        .keys(obj)
        .filter(key => obj[key] !== void 0)
        .map(key => `${encodeURIComponent(key) ?? ''}=${encodeURIComponent(obj[key] ?? '')}`)
        .filter(x => x !== '=')
        .join('&')
        ;
}

export function sha1(data: string | Buffer): string {
    return crypto.createHash('sha1').update(data).digest('hex');
}

export async function stat(filename: string) {
    return await new Promise<fs.Stats>((rs, rj) => fs.stat(filename, (e, s) => e ? rj(e) : rs(s)));
}

export async function fileExists(filename: string) {
    try {
        let s = await stat(filename);
        return s.isFile() || s.isDirectory();
    } catch (e) {
        return false;
    }
}

export async function dirExists(filename: string) {
    try {
        let s = await stat(filename);
        return s.isDirectory();
    } catch (e) {
        return false;
    }
}

export async function fileSize(filename: string) {
    let s = await stat(filename);
    return s.size;
}

export function checksumFile(algorithm: 'sha1' | 'sha256' | 'sha512', path: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const hash = crypto.createHash(algorithm);
        const stream = fs.createReadStream(path);
        stream.on('error', err => reject(err));
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

export function streamToString(stream: Readable): Promise<string> {
    const chunks = [];
    return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    })
}
export function streamLines(stream: Readable, lineReceived: (line: string) => void): Promise<void> {
    let string = '';
    return new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
            string += chunk.toString('utf-8');

            let lineMatch: RegExpMatchArray;
            while (lineMatch = /\r?\n/.exec(string)) {
                lineReceived(string.slice(0, lineMatch.index));
                string = string.slice(lineMatch.index + lineMatch[0].length);
            }
        });
        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve());
    })
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

export function randomItem<T>(arr: T[], emptyValue?: T): T {
    if (arr.length === 0)
        return emptyValue;

    return arr[Math.floor(Math.random() * arr.length)];
}

export function unindent(str: string) {
    let lastNewline = str.lastIndexOf("\n");
    let indent = str.slice(lastNewline + 1).replace(/[^ ]/g, '');
    return str.split(/\n/g).map(x => x.replace(indent, '')).join("\n");
}

export function pathResolve(...paths: string[]) {
    return path.resolve(...paths);
}

export function changeWorkingDirectory(dir: string) {
    process.chdir(dir);
}

export async function askBoolean(prompt: string, defaultValue = true): Promise<boolean> {
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

export function ask(prompt: string) {
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

export function capitalize(name: string) {
    return name[0].toUpperCase() + name.slice(1);
}

export async function readFileLines(filename: string): Promise<string[]> {
    return (await readTextFile(filename)).split(os.EOL);
}

export function lineRangeTagStart(name: string) {
    return `θ[${name}]`;
}

export function lineRangeTagEnd(name: string) {
    return `θ[/${name}]`;
}

export function replaceTaggedLineRange(content: string[], tagName: string, lines: string[]) {
    let startIndex = content.findIndex(line => line.includes(this.lineRangeTagStart(tagName)));
    content = removeTaggedLineRange(content, tagName);

    if (startIndex) {
        content.splice(startIndex, 0, ...lines);
    } else {
        content.push(...lines);
    }

    return content;
}

export function removeTaggedLineRange(content: string[], tag: string) {
    let filtered: string[] = [];
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

export async function writeFileLines(filename: string, lines: string[]): Promise<void> {
    this.writeTextFile(filename, lines.join(os.EOL));
}

export async function readJsonFile<T = any>(filename: string): Promise<T> {
    return await new Promise((res, rej) =>
        fs.readFile(filename, (err, buf) => {
            if (err) {
                rej(err);
                return;
            }

            try {
                let content = buf.toString('utf-8');
                if (content.charCodeAt(0) === 0xFEFF)
                    content = content.slice(1);

                let object: T;

                try {
                    object = JSON.parse(content);
                } catch (e) {
                    let errors: jsonc.ParseError[] = [];
                    object = jsonc.parse(content, errors);
                    // if (errors.length > 0) {
                    //     err = Error(`Failed to parse JSONC: ${errors.map(e => e.error).join(', ')}`);
                    // }
                    if (!object) {
                        throw new Error(`Failed to parse JSON: '${content}': ${e.stack}\n---`);
                    }
                }

                res(object);
            } catch (e) {
                rej(e);
            }
        })
    );
}

export async function readTextFile(filename: string): Promise<string> {
    return await new Promise((res, rej) =>
        fs.readFile(filename, (err, buf) =>
            err ? rej(err) : res(buf.toString('utf-8'))
        )
    );
}

export async function writeJsonFile<T = any>(filename: string, content: T) {
    await new Promise<void>((resolve, reject) => {
        let json: string;

        try {
            json = JSON.stringify(content, undefined, 2);
        } catch (e) {
            throw new Error(`Failed to serialize JSON: ${e.message}`);
        }

        fs.writeFile(filename, json, err => err ? reject(err) : resolve());
    });
}

export async function writeTextFile(filename: string, content: string) {
    await new Promise<void>((resolve, reject) => {
        fs.writeFile(filename, content, err => err ? reject(err) : resolve());
    });
}

/**
 * https://stackoverflow.com/a/46759625/1995204
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

export async function timeout(time = 0) {
    await new Promise<void>(resolve => setTimeout(() => resolve(), time));
}

export async function renameFile(oldFilename: string, newFilename: string) {
    return new Promise<void>((res, rej) => {
        fs.rename(oldFilename, newFilename, err => err ? rej(err) : res());
    });
}

export function recordEach<T>(record: Record<string, T>, callback: (key: string, value: T, object: Record<string, T>) => void) {
    if (!record)
        return;

    for (let key of Object.keys(record)) {
        callback(key, record[key], record);
    }
}

export class AsyncQueue<T> {
    requests: { promise: Promise<T>, resolve: (value: T) => void }[] = [];
    values: T[] = [];

    async dequeue(): Promise<T> {
        if (this.values.length > 0)
            return this.values.shift();

        let resolve;
        let promise = new Promise<T>(res => resolve = res);
        this.requests.push({ promise, resolve });
        return await promise;
    }

    clear() {
        this.values = [];
    }

    /**
     * Wait until all requests have been resolved. This is useful to ensure that
     * the consumer of the queue has stopped waiting for the next value.
     */
    async waitForFinish() {
        while (this.requests.length > 0)
            await this.requests[0].promise;
    }

    enqueue(value: T) {
        let request = this.requests.shift();
        if (request) {
            request.resolve(value);
        } else {
            this.values.push(value);
        }
    }
}

/**
 * Replaces {{variable}} references within any string value within the given template object,
 * returning the fully resolved result.
 * @param str
 * @param variables
 * @returns
 */
export function resolveTemplate<T>(template: T, variables: Record<string, string>): T {
    if (!template)
        throw new Error(`Invalid template: ${template}`);
    return JSON.parse(JSON.stringify(template), (key, value) => {
        if (typeof value === 'string')
            return resolveVariablesInString(value, variables);
        return value;
    });
}

/**
 * Replaces {{variable}} references within the given string based on the variable map passed in
 * @param str
 * @param variables
 * @returns
 */
export function resolveVariablesInString(str: string, variables: Record<string, string>): any {
    let castTo: string = undefined;
    let result = str.replace(/\{\{([^\{\}]+)\}\}/g, (_, identifier: string) => {
        identifier = identifier.trim();
        if (identifier.startsWith('config.')) {
            this.configService.getPath(identifier.split('.'));
        } else if (identifier === 'asNumber') {
            castTo = 'number';
        } else {
            return variables[identifier];
        }
    });

    if (castTo === 'number')
        return Number(result);
    return result;
}

export interface FileSearchOptions {
    folder: string;
    pattern: string;
    process: (filename: string) => Promise<void>;
    taskLimit?: number;
    skip?: string[];
}
export async function fileSearch(options: FileSearchOptions) {
    options.taskLimit ??= 50;

    return await new Promise<void>(done => {
        let searchPath = pathCombine(options.folder, '**', options.pattern);
        let outstandingTasks: Promise<void>[] = [];

        if (os.platform() === 'win32') {
            // glob doesn't work otherwise shockingly https://github.com/isaacs/node-glob/issues/592
            searchPath = `//?/${searchPath.replace(/\\/g, '/')}`;
        }

        //console.log(`Finding from ${searchPath}...`);

        let filenameStream = new Glob(searchPath, {}).stream();
        filenameStream.on('data', async filename => {
            try {
                if (options.skip?.some(x => filename.replace(/\\/g, '/').includes(x)))
                    return;

                let needsResume = false;

                if (outstandingTasks.length > options.taskLimit) {
                    filenameStream.pause();
                    needsResume = true;
                    while (outstandingTasks.length > options.taskLimit)
                        await Promise.race(outstandingTasks);
                }

                let task: Promise<void>;

                if (outstandingTasks.length > options.taskLimit)
                    throw new Error(`Accounting failed: Task limit is over max!`);

                try {
                    task = options.process(filename);
                    outstandingTasks.push(task);

                    if (needsResume)
                        filenameStream.resume();

                    await task;
                } finally {
                    if (task) {
                        let deleteIndex = outstandingTasks.indexOf(task);
                        if (deleteIndex >= 0)
                            outstandingTasks.splice(deleteIndex, 1);
                    }
                }

            } catch (e) {
                console.error(`Critical failure occurred in file search streaming:`);
                console.error(`Unhandled exception:`);
                console.error(e);
                process.exit(1);
            }
        });

        filenameStream.on('end', async () => {
            await Promise.all(outstandingTasks);
            done();
        });
    });
}

export function toUnixPath(str: string) {
    return str.replace(/\\/g, '/');
}

export function count<T>(array: T[], check: (element: T) => boolean) {
    let count = 0;
    for (let element of array) {
        if (check(element))
            count += 1;
    }
    return count;
}

export interface Future<T> {
    promise: Promise<T>;
    resolve: (value: T | Promise<T> | undefined, error?: any) => void;
}

export function newFuture<T>() {
    let resolve: (value: T) => void;
    let reject: (error?: any) => void;
    return {
        promise: new Promise<T>((rs, rj) => (resolve = rs, reject = rj)),
        resolve: (value: T, error?) => error ? reject(error) : resolve(value)
    };
}

export function inFuture<T>(callback: (future: Future<T>) => void) {
    let future = newFuture<T>();
    callback(future);
    return future.promise;
}

export function fill<T>(count: number, determinant: (index: number) => T): T[] {
    return Array.from(Array(count)).map((_, i) => determinant(i));
}

export function alongside(work: () => Promise<void>): void {
    work();
}

export async function runAndCapture(program: string): Promise<{ exitCode: number, stdout: string, stderr: string }> {
    const TEN_MEGABYTES = 1000 * 1000 * 10;
    let proc = exec(program, {
        maxBuffer: TEN_MEGABYTES,
    });

    let [exitCode, stdout, stderr] = await Promise.all([
        new Promise<number>(res => proc.addListener('exit', code => res(code))),
        streamToString(proc.stdout),
        streamToString(proc.stderr),
    ]);

    stdout = stdout.replace(/\r\n/g, "\n");
    stderr = stderr.replace(/\r\n/g, "\n");

    return { exitCode, stdout, stderr };
}

export async function runAndCaptureLines(
    program: string, 
    lineReceived: (line: string, error: boolean) => void,
    cwd?: string
): Promise<number> {
    const TEN_MEGABYTES = 1000 * 1000 * 10;
    let proc = exec(program, {
        maxBuffer: TEN_MEGABYTES,
        cwd
    });

    streamLines(proc.stdout, line => lineReceived(line, false));
    streamLines(proc.stderr, line => lineReceived(line, true));

    let exitCode = new Promise<number>(res => proc.addListener('exit', code => res(code)));

    return exitCode;
}

export async function runShellCommand(commandLine: string, interrupted?: Observable<void>, cwd?: string) {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.pause();
    process.stdin.cork();
    process.stdout.cork();

    let proc = childProcess.spawn(commandLine, {
        shell: true,
        stdio: 'inherit',
        cwd
    });
    let subscription = interrupted?.subscribe(() => proc.kill('SIGINT'));

    // let outBuffer = '';
    // proc.stdout.addListener('data', data => {
    //     outBuffer += data;
    //     while (outBuffer.includes("\n")) {
    //         let length = outBuffer.indexOf("\n");
    //         let outLine = outBuffer.slice(0, length);
    //         outBuffer = outBuffer.slice(length + 1);
    //         ui.log(outLine);
    //     }
    // })

    // let errBuffer = '';
    // proc.stderr.addListener('data', data => {
    //     errBuffer += data;
    //     while (errBuffer.includes("\n")) {
    //         let length = errBuffer.indexOf("\n");
    //         let errLine = errBuffer.slice(0, length);
    //         errBuffer = errBuffer.slice(length + 1);
    //         ui.log(styled(style.$red(errLine)));
    //     }
    // })

    return new Promise<void>((resolve, reject) => {
        proc.addListener('exit', status => {
            subscription?.unsubscribe();
            process.stdout.uncork();
            process.stdin.uncork();
            // process.stdout.resume();
            // process.stdin.resume();
            if (status !== null && status !== 0) {
                reject(status);
            } else {
                resolve();
            }
        });
    });

}
