import { Constructor, getParameterNames } from '@alterior/common';
import { AnnotationDecoratorTarget, DecoratorSite, DecoratorTypeForValidTargets } from './annotations';

export type MutatorOptions = {
    validTargets? : Exclude<AnnotationDecoratorTarget, 'parameter' | 'property'>[];
}

type ValueTypeForValidTargets<Targets, P = unknown> = 
      Targets extends 'class' ? Constructor<any> 
    : Targets extends 'method' ? Function
    : never;
;

/**
 * Mutators are a way to define "mutation decorators" which in some way change the value
 * of the elements they are applied to, as opposed to "annotation decorators", which attach metadata.
 *
 * Create a mutator with Mutator.create().
 */
export class Mutator {
    /**
     * Create a new mutation decorator (mutator).
     * 
     * The passed function takes a DecoratorSite object which describes the particular
     * invocation that is being run, and importantly, access to the property descriptor
     * for the property being defined. If you wish to completely replace (or wrap) the
     * default value of the property or method you are replacing, set the `value`
     * property of the property descriptor with `site.propertyDescriptor.value`
     * 
     * For example:
     * ```
     * export const RunTwice = Mutator.define(site => {
     *     let prop = site.propertyDescriptor;
     *     let original = prop.value;
     *     let replacement = function(...args) {
     *       original.apply(this, args);
     *       original.apply(this, args);
     *     }
     *     prop.value = replacement;
     * });
     * ```
     */
    public static create<U extends Exclude<AnnotationDecoratorTarget, 'parameter'>, P>(
        mutator: (value: ValueTypeForValidTargets<U, P>, target: DecoratorSite) => void, 
        options?: { validTargets: U[] }
    ): DecoratorTypeForValidTargets<U> {
        const validTargets = options?.validTargets ?? ['class', 'method', 'property'];

        return <DecoratorTypeForValidTargets<U>> function (target: any, propertyKey?: string | symbol, propertyDescriptor?: PropertyDescriptor): any {
            let value: any;
            let type: "class" | "method";
            let paramNames: string[] | undefined;

            if (propertyDescriptor) {
                value = propertyDescriptor.value;
                type = "method";
                if (typeof value === 'function') {
                    paramNames = getParameterNames(value);
                }
            } else {
                value = target;
                type = "class";
            }

            if (!validTargets.includes(type))
                throw new Error(`You cannot decorate a ${type} with this mutator`);

            let newValue: any = mutator(value, {
                target,
                propertyKey,
                propertyDescriptor,
                type
            });

            if (value !== newValue && paramNames !== undefined && !Object.hasOwn(newValue, '__parameterNames')) {
                Object.defineProperty(newValue, '__parameterNames', {
                    value: paramNames,
                    enumerable: false
                });
            }

            if (propertyDescriptor) {
                propertyDescriptor.value = newValue;
            } else {
                return propertyDescriptor;
            }
        };
    }
}
