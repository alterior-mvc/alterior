import { Key } from "./key";
import { SelfAnnotation, SkipSelfAnnotation } from "./metadata";

/**
 * `Dependency` is used by the framework to extend DI.
 * @internal
 */
export class Dependency {
    constructor(
        public key: Key,
        public optional: boolean,
        public visibility: SelfAnnotation | SkipSelfAnnotation | null,
        public skip: boolean
    ) {
    }

    static fromKey(key: Key): Dependency {
        return new Dependency(key, false, null, false);
    }
}
