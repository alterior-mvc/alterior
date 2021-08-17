// Originally from https://github.com/goatslacker/get-parameter-names

let COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
let DEFAULT_PARAMS = /=[^,)]+/mg;
let FAT_ARROWS = /=>.*$/mg;
let SPACES = /\s/mg;
let BEFORE_OPENING_PAREN = /^[^(]*\(/mg;
let AFTER_CLOSING_PAREN = /^([^)]*)\).*$/mg;

export function getParameterNames(fn) {
  let code = fn.toString()
    .replace(SPACES, '')
    .replace(COMMENTS, '')
    .replace(FAT_ARROWS, '')
    .replace(DEFAULT_PARAMS, '')
    .replace(BEFORE_OPENING_PAREN, '')
    .replace(AFTER_CLOSING_PAREN, '$1');

  return code ? code.split(',') : [];
}
