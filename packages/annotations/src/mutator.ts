import { getParameterNames } from '@alterior/common';
import { DecoratorSite, AnnotationDecoratorOptions, Annotation, AnnotationDecorator, ClassDecoratorSite, 
    MethodDecoratorSite, ParameterDecoratorSite, PropertyDecoratorSite, Decorator } from './annotations';

/**
 * Mutators are a way to define "mutation decorators" which in some way change the value
 * of the elements they are applied to, as opposed to "annotation decorators", which primarily
 * attach metadata.
 *
 * Create a mutator with Mutator.create().
 */

type MutatorFunction<SiteType extends DecoratorSite = DecoratorSite, Args extends any[] = any[]> = 
    (target: SiteType, ...args: Args) => void;

export interface MutatorDefinition<SiteType extends DecoratorSite = DecoratorSite, Args extends any[] = any[]> {
    invoke: (site: SiteType, ...args: Args) => void;
    options?: AnnotationDecoratorOptions<void>;
}

export class Mutator {
    /**
     * Low-level method to ceate a new mutation decorator (mutator) based on the given function.
     * Use `Mutator.define()` instead.
     */
    public static create<Args extends any[]>(
        mutator: MutatorFunction<ClassDecoratorSite, Args>, 
        options?: AnnotationDecoratorOptions<void> & { validTargets: ['class'] }
    ): AnnotationDecorator<Args>;
    public static create<Args extends any[]>(
        mutator: MutatorFunction<MethodDecoratorSite, Args>, 
        options?: AnnotationDecoratorOptions<void> & { validTargets: ['method'] }
    ): AnnotationDecorator<Args>;
    public static create<Args extends any[]>(
        mutator: MutatorFunction<PropertyDecoratorSite, Args>, 
        options?: AnnotationDecoratorOptions<void> & { validTargets: ['property'] }
    ): AnnotationDecorator<Args>;
    public static create<Args extends any[]>(
        mutator: MutatorFunction<ParameterDecoratorSite, Args>, 
        options?: AnnotationDecoratorOptions<void> & { validTargets: ['parameter'] }
    ): AnnotationDecorator<Args>;
    public static create<Args extends any[]>(
        mutator: MutatorFunction<DecoratorSite, Args>, 
        options?: AnnotationDecoratorOptions<void>
    ): AnnotationDecorator<Args>;
    public static create<Args extends any[]>(
        mutator: MutatorFunction<any, Args>, 
        options?: AnnotationDecoratorOptions<void>
    ): AnnotationDecorator<Args> {
        return <AnnotationDecorator<any[]>> Annotation.decorator(Object.assign({}, options || {}, {
            factory: (target: DecoratorSite, ...args: Args) => {
                let paramNames: string[] | undefined;
                let value = (target as any).propertyDescriptor?.value;

                if (typeof value === 'function') {
                    paramNames = getParameterNames(value);
                }

                mutator(target, ...args);

                let replacement = (target as any).propertyDescriptor?.value;
                if (value !== replacement && paramNames !== undefined && !Object.hasOwn(replacement, '__parameterNames')) {
                    Object.defineProperty(replacement, '__parameterNames', {
                        value: paramNames
                    });
                }
            }
        }));
    }

    /**
     * Define a new mutation decorator (mutator).
     * This should be called and returned from a
     * function definition. For example:
     *
     * ```
     * function Name() {
     *     return Mutator.define({
     *         invoke(site) {
     *             // ...
     *         }
     *     })
     * }
     * ```
     *
     * The `invoke()` function takes a DecoratorSite object which describes the particular
     * invocation that is being run, and importantly, access to the property descriptor
     * for the property being defined. If you wish to completely replace (or wrap) the
     * default value of the property or method you are replacing, set the `value`
     * property of the property descriptor with `site.propertyDescriptor.value`
     *
     * For example:
     * ```
     * export function RunTwice() {
     *     return Mutator.define(
     *         invoke(site) {
     *             let prop = site.propertyDescriptor;
     *             let original = prop.value;
     *             let replacement = function(...args) {
     *                 original.apply(this, args);
     *                 original.apply(this, args);
     *             }
     *             prop.value = replacement;
     *         }
     *     );
     * }
     * ```
     */
    public static define(definition: MutatorDefinition<ClassDecoratorSite> & { options: { validTargets: ['class'] }}): Decorator;
    public static define(definition: MutatorDefinition<MethodDecoratorSite> & { options: { validTargets: ['method'] }}): Decorator;
    public static define(definition: MutatorDefinition<PropertyDecoratorSite> & { options: { validTargets: ['property'] }}): Decorator;
    public static define(definition: MutatorDefinition<ParameterDecoratorSite> & { options: { validTargets: ['parameter'] }}): Decorator;
    public static define(definition: MutatorDefinition): Decorator;
    public static define(definition: MutatorDefinition<any, any[]>): Decorator {
        return this.create(definition.invoke, definition.options)();
    }
}