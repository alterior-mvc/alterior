/**
 * Pad the given string until its at least `length` characters long by adding spaces to the end.
 * 
 * @param str 
 * @param length 
 * @returns 
 */
export function rightPad(str: string, length: number) {
    str = String(str);

    while (str.length < length)
        str += ' ';

    return str;
}

/**
 * Pad the given string until its at least `length` characters long by adding spaces to the beginning.
 * @param str 
 * @param length 
 * @returns 
 */
export function leftPad(str: string, length: number) {
    str = String(str);

    while (str.length < length)
        str = ' ' + str;

    return str;
}

/**
 * Pad the given number (creating a string) until its at least `length` digits long by adding zeros to the beginning.
 * @param number 
 * @param digits 
 * @returns 
 */
export function zeroPad(number: any, digits = 2) {
    let str = `${number}`;
    while (str.length < digits)
        str = '0' + str;

    return str;
}
