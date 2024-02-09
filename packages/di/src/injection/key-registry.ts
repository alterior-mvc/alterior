import { Key } from "./key";

/**
 * @internal
 */
export class KeyRegistry {
    private _allKeys = new Map<Object, Key>();

    get(token: Object): Key {
        if (token instanceof Key) return token;

        if (this._allKeys.has(token)) {
            return this._allKeys.get(token)!;
        }

        const newKey = new Key(token, Key.numberOfKeys);
        this._allKeys.set(token, newKey);
        return newKey;
    }

    get numberOfKeys(): number {
        return this._allKeys.size;
    }
}
