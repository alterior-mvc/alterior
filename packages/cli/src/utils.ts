import { rimraf } from "rimraf";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as process from "process";
import mkdirp from "mkdirp";
import * as readline from 'readline';
import { resolve } from "path";
import inquirer from "inquirer";

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

export function isPropertyPrivate(target : any, propertyName : string) {
    return false; // No way yet
    //return Reflect.hasMetadata('design:paramtypes', target, propertyName);
}

export function getWorkingDirectory() {
    return process.cwd();
}

export function capitalize(name : string) {
    return name[0].toUpperCase() + name.slice(1);
}

export function toCamelCase(name : string) {
    return name.replace(/-(.)/g, (_, c) => c.toUpperCase());
}

export function toUpperCamelCase(name: string) {
    return capitalize(toCamelCase(name));
}

export function removeAll(path : string) : Promise<boolean> {
    return rimraf(path);
}

export async function makeDirectory(path : string) {
    await mkdirp(path);
}

export function fileExists(path : string) : Promise<boolean> {
    return new Promise<boolean>(resolve => fs.exists(path, exists => resolve(exists)));
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
    let startIndex = content.findIndex(line => line.includes(lineRangeTagStart(tagName)));
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
    writeTextFile(filename, lines.join(os.EOL));
}

export async function readJsonFile<T = any>(filename : string) : Promise<T> {
    return await new Promise((res, rej) => 
        fs.readFile(filename, (err, buf) => {
            if (err) {
                rej(new Error(`Failed to read JSON file '${filename}': ${err.message}`)); 
                return;
            }

            try {
                res(JSON.parse(buf.toString('utf-8')));
            } catch (e) {
                rej(new Error(`Failed to read JSON file '${filename}': ${e.message} -- JSON was ${buf.toString('utf-8')}`));
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

export async function writeJsonFile<T = any>(filename : string, content : T) {
    await new Promise<void>((resolve, reject) => {
        fs.writeFile(filename, JSON.stringify(content, undefined, 2), err => err ? reject(err) : resolve());
    });
}

export async function writeTextFile(filename : string, content : string) {
    await makeDirectory(path.dirname(filename));
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