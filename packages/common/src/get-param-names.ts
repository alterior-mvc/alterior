// Originally from https://github.com/goatslacker/get-parameter-names

/**
 * @hidden
 */
let COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
/**
 * @hidden
 */
let DEFAULT_PARAMS = /=[^,)]+/mg;
/**
 * @hidden
 */
let FAT_ARROWS = /=>.*$/mg;
/**
 * @hidden
 */
let SPACES = /\s/mg;
/**
 * @hidden
 */
let BEFORE_OPENING_PAREN = /^[^(]*\(/mg;
  /**
   * @hidden
   */
let AFTER_CLOSING_PAREN = /^([^)]*)\).*$/mg;

/**
 * Get the names of the parameters of the given function.
 * @param fn 
 */
export function getParameterNames(fn): string[] {
  let code = fn.toString()
    .replace(SPACES, '')
    .replace(COMMENTS, '')
    .replace(FAT_ARROWS, '')
    .replace(DEFAULT_PARAMS, '')
    .replace(BEFORE_OPENING_PAREN, '')
    .replace(AFTER_CLOSING_PAREN, '$1');

  return code ? code.split(',') : [];
}
