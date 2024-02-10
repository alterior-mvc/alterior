import { Key } from "./key";

/**
 * `Dependency` is used by the framework to extend DI.
 * @internal
 */
export class Dependency {
    constructor(
        public key: Key,
        public optional: boolean,
        public visibility: 'self' | 'skip-self' | 'default',
        public skip: boolean
    ) {
    }

    static fromKey(key: Key): Dependency {
        return new Dependency(key, false, 'default', false);
    }
}
