import { getParameterNames } from '@alterior/common';
import { DecoratorSite, AnnotationDecoratorOptions, Annotation } from './annotations';

export type MutatorOptions = Omit<AnnotationDecoratorOptions<any, any>, 'factory'>;

export interface MutatorDefinition {
    invoke: (site: DecoratorSite) => void;
    options?: MutatorOptions;
}

/**
 * Mutators are a way to define "mutation decorators" which in some way change the value
 * of the elements they are applied to, as opposed to "annotation decorators", which primarily
 * attach metadata.
 *
 * Create a mutator with Mutator.create().
 */
export class Mutator {
    /**
     * Low-level method to ceate a new mutation decorator (mutator) based on the given function.
     * Use `Mutator.define()` instead.
     * 
     * @internal
     */
    public static create<Args extends any[]>(
        mutator: (target: DecoratorSite & { propertyDescriptor: PropertyDescriptor }, ...args: Args) => void, 
        options?: MutatorOptions
    ) {
        return Annotation.decorator(
            {
                ...(options ?? {}),
                factory: (target: DecoratorSite, ...args: any[]) => {
                    let paramNames: string[] | undefined;
                    let orig = target.propertyDescriptor!.value;
    
                    if (typeof orig === 'function') {
                        paramNames = getParameterNames(target.propertyDescriptor!.value);
                    }
    
                    mutator(target as DecoratorSite & { propertyDescriptor: PropertyDescriptor }, ...(args as Args));
    
                    let replacement = target.propertyDescriptor!.value;
                    if (orig !== replacement && paramNames !== undefined && !Object.hasOwn(replacement, '__parameterNames')) {
                        Object.defineProperty(replacement, '__parameterNames', {
                            value: paramNames
                        });
                    }

                    return undefined;
                }
            }
        );
    }

    /**
     * Define a new mutation decorator (mutator).
     * This should be called and returned from a
     * function definition. For example:
     *
```
function Name() {
    return Mutator.define({
        invoke(site) {
            // ...
        }
    })
}
```
     *
     * The `invoke()` function takes a DecoratorSite object which describes the particular
     * invocation that is being run, and importantly, access to the property descriptor
     * for the property being defined. If you wish to completely replace (or wrap) the
     * default value of the property or method you are replacing, set the `value`
     * property of the property descriptor with `site.propertyDescriptor.value`
     *
     * For example:
     * ```
export function RunTwice() {
  return Mutator.create(
    site => {
      let prop = site.propertyDescriptor;
      let original = prop.value;
      let replacement = function(...args) {
        original.apply(this, args);
        original.apply(this, args);
      }
      prop.value = replacement;
    }
)
     * ```
     */
    public static define(definition: MutatorDefinition) {
        return this.create(definition.invoke, definition.options)();
    }
}
