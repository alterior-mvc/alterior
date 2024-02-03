import * as path from 'node:path';
import * as fs from 'node:fs';

async function main() {
    let files = await listDirectory('packages');
    let packages: any[] = [];

    for (let file of files) {
        let pkgFileName = path.join('packages', file, 'package.json');

        if (!await isFile(pkgFileName))
            continue;

        let pkg = JSON.parse(fs.readFileSync(pkgFileName).toString('utf-8'));

        if (pkg.private)
            continue;

        packages.push(file);
    }

    fs.writeFileSync(
        path.join('packages', 'website', 'src', 'assets', 'packages.json'), 
        JSON.stringify(packages, undefined, 2)
    );

    console.log(`Wrote packages.json`);
}

async function listDirectory(path: string) {
    return await new Promise<string[]>((resolve, reject) => {
        fs.readdir(path, (err, files) => {
            if (err)
                reject(err);
            else
                resolve(files);
        });
    });
}

function findPackageJson(folder: string) {
    while (true) {
        let pkgJsonFile = path.resolve(folder, 'package.json');
        if (fs.existsSync(pkgJsonFile)) {
            let pkg = JSON.parse(fs.readFileSync(pkgJsonFile).toString('utf-8'));
            pkg.filename = pkgJsonFile;
            return pkg;
        }

        let parentFolder = path.dirname(folder);
        if (parentFolder === folder)
            break;

        folder = parentFolder;
    }

    return undefined;
}

async function stat(filename : string) {
    return await new Promise<fs.Stats>((rs, rj) => fs.stat(filename, (e, s) => e ? rj(e) : rs(s)));
}

async function isFile(filename : string) {
    try {
        let s = await stat(filename);
        return s.isFile();
    } catch (e) {
        return false;
    }
}

async function isDirectory(filename : string) {
    try {
        let s = await stat(filename);
        return s.isDirectory();
    } catch (e) {
        return false;
    }
}

main();