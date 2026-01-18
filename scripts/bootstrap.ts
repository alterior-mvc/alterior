#!/usr/bin/env node

/**
 * This script just makes sure @/build is built so that everything else can be built.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as childProcess from 'child_process';

export interface Package {
    name: string;
    folder: string;
    manifest: any;
}

async function main() {
    if (await fileExists(pathCombine(process.cwd(), 'packages/build/dist/main.js')) && !process.argv.includes('--rebuild'))
        return;

    let packages = await findPackages();
    await visitPackageInDependencyOrder(packages.find(x => x.name === '@alterior/build'), async pkg => {
        if (pkg.manifest.scripts.build) {
            console.log(`build ${pkg.name}`);
            await runShellCommand(`${pathCombine(process.cwd(), `node_modules/.bin/tsc`)} -b`, pkg.folder);
        }
    }, packages);

    await runShellCommand(`npm install`);
}

async function visitPackageInDependencyOrder(
    pkg: Package, 
    visitor: (pkg: Package) => Promise<boolean|void>, 
    packages: Package[], 
    visited: Package[] = [],
    depth = 0
) {
    if (visited.includes(pkg))
        return;
    visited.push(pkg);

    for (let depName of Object.keys(pkg.manifest.dependencies || {})) {
        let dep = packages.find(x => x.name === depName);
        if (!dep)
            continue;

        let result = await visitPackageInDependencyOrder(dep, visitor, packages, visited, depth + 1);
        if (result === false)
            return false;
    }

    if ((await visitor(pkg)) === false)
        return false;
}

async function findPackages(projectRoot: string = process.cwd()) {
    let packages: Package[] = [];
    for (let folder of await listDirectory(pathCombine(projectRoot, 'packages'))) {
        let folderPath = pathCombine(projectRoot, 'packages', folder);
        if (!await dirExists(folderPath))
            continue;

        let manifestFile = pathCombine(folderPath, 'package.json');
        if (!await fileExists(manifestFile))
            continue;

        let manifest = await readJsonFile(manifestFile);
        if (!manifest.name)
            continue;

        packages.push({ name: manifest.name, folder: folderPath, manifest });
    }
    return packages;
}

function pathCombine(...paths : string[]) {
    return path.join(...paths);
}

async function fileExists(filename : string) {
    try {
        let s = await stat(filename);
        return s.isFile() || s.isDirectory();
    } catch (e) {
        return false;
    }
}

async function stat(filename : string) {
    return await new Promise<fs.Stats>((rs, rj) => fs.stat(filename, (e, s) => e ? rj(e) : rs(s)));
}

function listDirectory(fullPath: string): Promise<string[]> {
    return new Promise((res, rej) => {
        fs.readdir(fullPath, (err, files) => err ? rej(err) : res(files));
    });
}

async function readJsonFile<T = any>(filename : string, defaultValue?: T) : Promise<T> {
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

async function dirExists(filename : string) {
    let s = await stat(filename);
    return s.isDirectory();
}

async function runShellCommand(commandLine: string, cwd?: string) {
    return new Promise<void>((resolve, reject) => {
        let proc = childProcess.spawn(commandLine, { shell: true, stdio: 'inherit', cwd });
        proc.addListener('exit', status => {
            if (status !== null && status !== 0) {
                reject(status);
            } else {
                resolve();
            }
        });
    });
}

main();
