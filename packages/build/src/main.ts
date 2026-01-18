import { CommandLine } from '@alterior/command-line';
import { listDirectory, makeDirectory, runCommand, runShellCommand, runSimple } from './utils';
import { fileExists, pathCombine, readJsonFile, writeJsonFile } from '@alterior/functions';
import { SemVer, ReleaseType } from 'semver';

import git from 'simple-git';

const PKG = require('../package.json');

async function main(args: string[]) {
    new CommandLine()
        .info({
            executable: 'alt-build',
            description: 'Build Alterior projects',
            copyright: 'Copyright 2025 The Alterior Project',
            version: PKG.version
        })
        .command('version', cmd => {
            cmd .info({
                description: 'Bump the version of the entire mono-repo',
                argumentUsage: '<major|minor|patch>'
            })
                .run(async ([ releaseType ]) => {
                    let projectRoot = process.cwd();
                    let rootManifestFile = pathCombine(projectRoot, 'package.json');
                    if (!await fileExists(rootManifestFile)) {
                        console.log(`Error: Current directory must be root of the mono-repo.`);
                        cmd.showHelp();
                        return;
                    }

                    let rootManifest = await readJsonFile(rootManifestFile);
                    let oldVersion = rootManifest.version;
                    let newVersion = new SemVer(oldVersion)
                        .inc(releaseType as ReleaseType).toString();

                    console.log(`${oldVersion} -> ${newVersion}`);

                    let files: string[] = [];
                    for (let pkg of await findPackages(projectRoot)) {
                        pkg.manifest.version = newVersion;
                        await writeJsonFile(pathCombine(pkg.folder, 'package.json'), pkg.manifest);
                        files.push(pathCombine(pkg.folder, 'package.json'));
                    }

                    await git(projectRoot).commit(`v${newVersion}`, files).addTag(`v${newVersion}`);
                })
            ;
        })
        .command('publish', async cmd => {
            cmd.run(async () => {
                let projectRoot = process.cwd();
                let rootManifestFile = pathCombine(projectRoot, 'package.json');
                if (!await fileExists(rootManifestFile)) {
                    console.log(`Error: Current directory must be root of the mono-repo.`);
                    cmd.showHelp();
                    return;
                }

                let packages = await findPackages(projectRoot);
                let tmpDir = pathCombine(projectRoot, 'tmp');
                await makeDirectory(tmpDir);

                await runShellCommand(`npm pack --pack-destination "${tmpDir}" ${packages.map(x => `"${x.folder}"`).join(' ')}`);

                //await runShellCommand(`npm login`);
            });
        })
        .process();
    ;
}

export interface Package {
    folder: string;
    manifest: any;
}

async function findPackages(projectRoot: string) {
    let packages: Package[] = [];
    for (let folder of await listDirectory(pathCombine(projectRoot))) {
        let manifest = await readJsonFile(pathCombine(folder, 'package.json'));
        packages.push({ folder, manifest });
    }
    return packages;
}

main(process.argv.slice(1));