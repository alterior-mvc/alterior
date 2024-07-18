/**
 * (C) 2017-2019 William Lahti
 */

import { Mutator } from './mutator';

/**
 * Seal a class and its instances.
 */
export const Sealed = () => Mutator.create(
    value => [value, value.prototype].forEach(x => Object.seal(x)), 
    { validTargets: ['class'] }
);

/**
 * Freeze a class and its instances.
 */
export const Frozen = Mutator.create(
    value => [value, value.prototype].forEach(x => Object.freeze(x)),
    { validTargets: ['class'] }
);
