import { Generator } from "./generator";

export class LibraryGenerator extends Generator {
    static description = 'Generate a library';

    async generate() {
        throw new Error("Library generator not yet implemented.");
    }
}