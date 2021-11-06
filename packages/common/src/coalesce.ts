/**
 * Return the first value that is not undefined of the passed parameters.
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