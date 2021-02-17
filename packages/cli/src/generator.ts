export abstract class Generator {
    constructor(
        readonly projectName : string, 
        readonly projectDir : string
    ) {
    }

    abstract generate() : Promise<void>;

    static description = 'No description for this generator';
}