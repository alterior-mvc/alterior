/**
 * Check if the given function is constructable. Note that this is not the same as a *class*. In Ecmascript, normal
 * functions are also constructable. Use isClass() if you want to check if a function is a class.
 * 
 * @see https://stackoverflow.com/a/46759625
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

/**
 * Check if the given function is a class. Note that this only works for Ecmascript standard classes, the older 
 * prototype style constructor functions will return false here.
 */
export function isClass(f: Function) {
    return f.toString().startsWith('class ');
}