/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 * Copyright William Lahti
 *
 */

import { InjectableAnnotation, SelfAnnotation, HostAnnotation, InjectAnnotation, 
         OptionalAnnotation, SkipSelfAnnotation } from './annotations';

/**
 * @whatItDoes A marker metadata that marks a class as available to {@link Injector} for creation.
 * @howToUse
 * ```
 * @Injectable()
 * class Car {}
 * ```
 *
 * @description
 * For more details, see the {@linkDocs guide/dependency-injection "Dependency Injection Guide"}.
 *
 * ### Example
 *
 * {@example core/di/ts/metadata_spec.ts region='Injectable'}
 *
 * {@link Injector} will throw {@link NoAnnotationError} when trying to instantiate a class that
 * does not have `@Injectable` marker, as shown in the example below.
 *
 * {@example core/di/ts/metadata_spec.ts region='InjectableThrows'}
 *
 * @stable
 */
export const Injectable = InjectableAnnotation.decorator({
    validTargets: ['class'],

    /**
     * Allow multiple because this decorator is usually applied to both superclasses
     * and subclasses. TODO: if we change semantics on super/subclass duplicate definitions
     * this should be revisited and probably removed.
     */
    allowMultiple: true
});

/**
 * @whatItDoes A parameter metadata that marks a dependency as optional.
 * {@link Injector} provides `null` if the dependency is not found.
 * @howToUse
 * ```
 * @Injectable()
 * class Car {
 *   constructor(@Optional() public engine:Engine) {}
 * }
 * ```
 *
 * @description
 * For more details, see the {@linkDocs guide/dependency-injection "Dependency Injection Guide"}.
 *
 * ### Example
 *
 * {@example core/di/ts/metadata_spec.ts region='Optional'}
 *
 * @stable
 */
export const Optional = OptionalAnnotation.decorator({
  validTargets: ['parameter']
});

/**
 * @whatItDoes A parameter decorator that specifies a dependency.
 * @howToUse
 * ```
 * @Injectable()
 * class Car {
 *   constructor(@Inject("MyEngine") public engine:Engine) {}
 * }
 * ```
 *
 * @description
 * For more details, see the {@linkDocs guide/dependency-injection "Dependency Injection Guide"}.
 *
 * ### Example
 *
 * {@example core/di/ts/metadata_spec.ts region='Inject'}
 *
 * When `@Inject()` is not present, {@link Injector} will use the type annotation of the
 * parameter.
 *
 * ### Example
 *
 * {@example core/di/ts/metadata_spec.ts region='InjectWithoutDecorator'}
 *
 * @stable
 */
export const Inject = InjectAnnotation.decorator({
  validTargets: ['parameter']
});

/**
 * @whatItDoes Specifies that an {@link Injector} should retrieve a dependency only from itself.
 * @howToUse
 * ```
 * @Injectable()
 * class Car {
 *   constructor(@Self() public engine:Engine) {}
 * }
 * ```
 *
 * @description
 * For more details, see the {@linkDocs guide/dependency-injection "Dependency Injection Guide"}.
 *
 * ### Example
 *
 * {@example core/di/ts/metadata_spec.ts region='Self'}
 *
 * @stable
 */
export const Self = SelfAnnotation.decorator({
    validTargets: ['parameter']
});

/**
 * @whatItDoes Specifies that the dependency resolution should start from the parent injector.
 * @howToUse
 * ```
 * @Injectable()
 * class Car {
 *   constructor(@SkipSelf() public engine:Engine) {}
 * }
 * ```
 *
 * @description
 * For more details, see the {@linkDocs guide/dependency-injection "Dependency Injection Guide"}.
 *
 * ### Example
 *
 * {@example core/di/ts/metadata_spec.ts region='SkipSelf'}
 *
 * @stable
 */
export const SkipSelf = SkipSelfAnnotation.decorator({
    validTargets: ['parameter']
});

/**
 * @whatItDoes Specifies that an injector should retrieve a dependency from any injector until
 * reaching the host element of the current component.
 * @howToUse
 * ```
 * @Injectable()
 * class Car {
 *   constructor(@Host() public engine:Engine) {}
 * }
 * ```
 *
 * @description
 * For more details, see the {@linkDocs guide/dependency-injection "Dependency Injection Guide"}.
 *
 * ### Example
 *
 * {@example core/di/ts/metadata_spec.ts region='Host'}
 *
 * @stable
 */
export const Host = HostAnnotation.decorator({
    validTargets: ['parameter']
});