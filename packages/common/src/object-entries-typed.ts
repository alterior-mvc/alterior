export function objectEntriesTyped<T extends object>(object: T): [keyof T, T[keyof T]][] {
    return Object.entries(object) as any;
}

export function objectKeysTyped<T extends object>(object: T): (keyof T)[] {
    return Object.keys(object) as (keyof T)[];
}