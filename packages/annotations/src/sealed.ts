/**
 * (C) 2017-2019 William Lahti
 */

import { AnnotationDecorator } from "./annotations";
import { Mutator } from './mutator';

/**
 * Seal a class and its instances.
 */
export const Sealed = Mutator.create(
    site => [site.target, site.target.prototype].forEach(x => Object.seal(x)), 
    { validTargets: ['class'] }
);

/**
 * Freeze a class and its instances.
 */
export const Frozen = Mutator.create(
    site => [site.target, site.target.prototype].forEach(x => Object.freeze(x)), 
    { validTargets: ['class'] }
);
