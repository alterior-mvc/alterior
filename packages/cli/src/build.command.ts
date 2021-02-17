import { getWorkingDirectory } from "./utils";
import { Builder, BuildError } from "./builder";

export class BuildCommand {
    async run(args : string[]) {
        let dir = getWorkingDirectory();
        if (args.length > 0)
            dir = args[0];

        let builder = new Builder(dir);

        try {
            builder.build();
        } catch (e) {
            if (e instanceof BuildError) {
                console.error(`alt build: ${e.message}`);
                return 1;
            }

            throw e;
        }
    }
}