import { CommandLineProcessor } from '@alterior/command-line';
import { dirExists, fileExists, pathCombine, readJsonFile } from '@alterior/functions';
import { CLITask, style, styled } from '@alterior/terminal';
import { Package } from './package';
import { listDirectory, runAndCapture, runAndCaptureLines, runShellCommand } from './utils';

export async function getPackageFromRepository(name: string, version?: string) {
    let result = await runAndCapture(`npm view ${version ? `${name}@${version}` : name} --json`);
    let data = JSON.parse(result.stdout);
    if (data.error)
        throw new Error(`[${data.error.code}] ${data.error.summary}`);
    return data;
}

export async function validateProject(cmd: CommandLineProcessor) {
    let projectRoot = process.cwd();
    let rootManifestFile = pathCombine(projectRoot, 'package.json');

    if (!await fileExists(rootManifestFile)) {
        console.log(`Error: Current directory must be root of the mono-repo.`);
        cmd.showHelp();
        return;
    }
}

export async function runInAll(command: string, task?: CLITask, unordered = false) {
    if (unordered) {
        await visitInParallel(unit => runInUnit(command, unit, task?.subtask(unit.name), true));
    } else {
        await visitInDependencyOrderParallel((unit, unitTask) => runInUnit(command, unit, unitTask), task);
    }
}

export async function visitInParallel(work: (unit: Package) => Promise<void>) {
    await Promise.all((await findPackages()).map(p => work(p)));
}

export async function runInUnit(command: string, unit: Package, subtask?: CLITask, allowFailure = false) {
    if (unit.manifest.scripts[command]) {
        if (subtask) {
            try {
                let exitCode = await runAndCaptureLines(
                    `npm run ${command}`,
                    (line, error) => logToTask(unit, subtask, line, error),
                    unit.folder
                );

                if (exitCode !== 0 && !allowFailure)
                    throw new Error(`${unit.name}: Failed to run '${command}'`);

                subtask?.finish();
            } catch (e) {
                subtask?.error(e.message);
                throw e;
            }
        } else {
            runShellCommand(`npm run ${command}`, undefined, unit.folder);
        }
    }
}

export async function visitInDependencyOrder(visitor: (unit: Package) => Promise<boolean | void>) {
    let units = await findPackages();
    let visited: Package[] = [];
    for (let unit of units) {
        let result = await visitPackageInDependencyOrder(unit, visitor, units, visited);
        if (result === false)
            return false;
    }
}

export async function visitInDependencyOrderParallel(visitor: (unit: Package, task?: CLITask) => Promise<void>, task?: CLITask) {
    let packages = await findPackages();
    let packageReady = new Map<string, Future<void>>();
    packages.forEach(p => packageReady.set(p.name, newFuture<void>()))

    await Promise.all(packages.map(async pkg => {
        let pkgTask = task?.subtask(pkg.name);
        let pendingDeps = Object.keys(dependenciesOf(pkg)).filter(x => packageReady.has(x));

        if (pendingDeps.length > 0) {
            pkgTask.status = 'waiting';
            function updateWaiting() {
                pkgTask.waitingFor = `Waiting for ${pendingDeps.join(', ')}`;
            }

            updateWaiting();
            await Promise.all(pendingDeps.map(async depName => {
                await packageReady.get(depName)?.promise;
                let index = pendingDeps.indexOf(depName);
                if (index >= 0)
                    pendingDeps.splice(index, 1);
                updateWaiting();
            }));
            pkgTask.status = 'running';
        }

        try {
            await visitor(pkg, pkgTask);
            packageReady.get(pkg.name).resolve();
        } catch (e) {
            packageReady.get(pkg.name).resolve(undefined, e);
        }
    }));
}

export function dependenciesOf(pkg: Package) {
    return {
        ...(pkg.manifest.dependencies ?? {}),
        ...(pkg.manifest.peerDependencies ?? {}),
        ...(pkg.manifest.devDependencies ?? {}),
    };
}

export function newFuture<T>() {
    let resolve: (value: T) => void;
    let reject: (error?: any) => void;
    return {
        promise: new Promise<T>((rs, rj) => (resolve = rs, reject = rj)),
        resolve: (value: T, error?) => error ? reject(error) : resolve(value)
    };
}

export interface Future<T> {
    promise: Promise<T>;
    resolve: (value: T | Promise<T> | undefined, error?: any) => void;
}


export async function visitInReverseDependencyOrder(visitor: (unit: Package) => Promise<boolean>) {
    let units: Package[] = [];
    await visitInDependencyOrder(async unit => (units.push(unit), true));
    units.reverse();
    for (let unit of units) {
        if (await visitor(unit) === false)
            break;
    }
}

export async function visitDependents(dependency: Package, visitor: (unit: Package) => Promise<boolean>) {
    let units = await findPackages();

    for (let dependent of units) {
        if (dependent.name === dependency.name)
            continue;

        if (dependent.manifest.dependencies?.[dependency.name]) {
            let result = await visitor(dependent);
            if (result === false)
                return;
        }
    }
}

export async function visitPackageInDependencyOrder(
    pkg: Package,
    visitor: (pkg: Package) => Promise<boolean | void>,
    packages: Package[],
    visited: Package[] = [],
    depth = 0
) {
    if (visited.includes(pkg))
        return;
    visited.push(pkg);

    //console.log(`${fill(depth, () => `-- `).join('')} ${pkg.name}`);

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

export async function findPackages(projectRoot: string = process.cwd(), includePrivate = false) {
    let packages: Package[] = [];
    for (let folder of await listDirectory(pathCombine(projectRoot, 'packages'))) {
        let folderPath = pathCombine(projectRoot, 'packages', folder);
        if (!await dirExists(folderPath))
            continue;

        let manifestFile = pathCombine(folderPath, 'package.json');
        if (!await fileExists(manifestFile))
            continue;

        let manifest = await readJsonFile(manifestFile);

        if (!includePrivate && manifest.private)
            continue;

        if (!manifest.name)
            continue;

        packages.push({ name: manifest.name, folder: folderPath, manifest });
    }
    return packages;
}

export function logToTask(unit: Package, task: CLITask, line: string, error: boolean) {
    if (!line.trim())
        return;

    if (unit && line.startsWith(`> ${unit.name}@${unit.manifest?.version ?? ''}`))
        return;

    if (error)
        task.log(styled(style.$red(line)));
    else
        task.log(line);
}
