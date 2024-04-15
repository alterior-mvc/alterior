/**
 * Check if the given function is a class constructor.
 * 
 * @see https://stackoverflow.com/a/46759625/1995204
 */
export function isConstructor(f: Function) {
    if (f === Symbol)
        return false;

    try {
        Reflect.construct(String, [], f);
    } catch (e) {
        return false;
    }
    return true;
}