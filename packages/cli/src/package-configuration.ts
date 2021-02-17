import { readFile } from "fs";
import { pathCombine, readJsonFile, readFileLines, fileExists, writeFileLines, writeJsonFile, removeTaggedLineRange, lineRangeTagStart, lineRangeTagEnd, replaceTaggedLineRange } from "./utils";

export class PackageConfiguration {
    constructor(readonly directory : string) {

    }

    get packageJsonFilename() {
        return pathCombine(this.directory, 'package.json');
    }

    get npmIgnoreFilename() {
        return pathCombine(this.directory, '.npmignore');
    }

    get buildConfigFilename() {
        return pathCombine(this.directory, 'alterior.json');
    }

    async getPackageAccess() {
        let pkgJson = await readJsonFile(this.packageJsonFilename);
        let access = pkgJson.publishConfig?.access;

        if (!access) {
            if (pkgJson.name.startsWith('@'))
                access = 'private';
            else
                access = 'public';
        }

        return access;
    }

    async setPackageAccess(packageAccess : 'public' | 'private') {
        let pkgJson = await readJsonFile(this.packageJsonFilename);

        if (!pkgJson.publishConfig)
            pkgJson.publishConfig = {};

        pkgJson.publishConfig.access = packageAccess;

        await writeJsonFile(this.packageJsonFilename, pkgJson);
    }

    async setPublishBackend(publishBackend : boolean) {
        let npmIgnore : string[] = [];
        if (await fileExists(this.npmIgnoreFilename)) {
            npmIgnore = await readFileLines(this.npmIgnoreFilename);
        }

        let pbLines = [];

        if (!publishBackend) {
            pbLines.push(
                `#################################################################### ${lineRangeTagStart('alt:pb')}`,
                `# AUTO-GENERATED, do not delete. See publishBackend in alterior.json`,
                '# * Backend implementation should be omitted in published packages',
                'dist/**',
                'src/**',
                '!dist/__browser/**',
                '!src/__browser/**',
                `#################################################################### ${lineRangeTagEnd('alt:pb')}`
            );
        } else {
            pbLines.push(
                `#################################################################### ${lineRangeTagStart('alt:pb')}`,
                `# AUTO-GENERATED, do not delete. See publishBackend in alterior.json`,
                '# * Backend implementation should be included in published packages',
                `#################################################################### ${lineRangeTagEnd('alt:pb')}`)
        }

        npmIgnore = replaceTaggedLineRange(npmIgnore, 'alt:pb', pbLines);
        await writeFileLines(this.npmIgnoreFilename, npmIgnore);
    }
}