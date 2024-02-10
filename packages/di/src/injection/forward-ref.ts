import { isConstructor } from "@alterior/functions";

export function resolveForwardRef<T>(ref: T | (() => T)): T {
    if (typeof ref === 'function' && !isConstructor(ref))
        return (ref as (() => T))();
    
    return ref as T;
}