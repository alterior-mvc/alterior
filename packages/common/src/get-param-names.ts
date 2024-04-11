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
export function getParameterNames(fn: Function): string[] {

  // Sometimes the user may want to transform or replace a function, which may cause us to lose access to 
  // the parameter names. To provide an escape hatch for that use case, we'll check if the given function
  // has been annotated with parameter names already.

  if ('__parameterNames' in fn) {
    return fn['__parameterNames'] as string[];
  }

  let code = fn.toString()
    .replace(SPACES, '')
    .replace(COMMENTS, '')
    .replace(FAT_ARROWS, '')
    .replace(DEFAULT_PARAMS, '')
    .replace(BEFORE_OPENING_PAREN, '')
    .replace(AFTER_CLOSING_PAREN, '$1');

  return code ? code.split(',') : [];
}
