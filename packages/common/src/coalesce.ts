/**
 * Return the first defined value out of the passed parameters.
 * @param values 
 */
export function coalesce(...values: any[]) {
    for (let value of values) {
        if (value === undefined)
            continue;
        return value;
    }

    return undefined;
}