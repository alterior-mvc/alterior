import { Annotation, MetadataName } from "@alterior/annotations";
import { Reflector } from "./reflector";
import { RuntimeLogger } from "./runtime-logger";

@MetadataName('@alterior/runtime:LifecycleEvent')
export class LifecycleEventAnnotation extends Annotation {
	constructor(readonly name: symbol) {
		super();
	}
}

/**
 * When applied to a method in an eligible class (for instance a `@Module()`, 
 * `@WebService()`, or `@Controller()`) the method will be automatically called
 * when the given lifecycle event is fired via `Runtime.fireEvent()`.
 */
export const LifecycleEvent = LifecycleEventAnnotation.decorator({
	validTargets: ['method']
});

export const ALT_ON_INIT: unique symbol = Symbol.for('@alterior/runtime:onInit');
export const ALT_AFTER_INIT: unique symbol = Symbol.for('@alterior/runtime:afterInit');
export const ALT_ON_START: unique symbol = Symbol.for('@alterior/runtime:onStart');
export const ALT_ON_STOP: unique symbol = Symbol.for('@alterior/runtime:onStop');
export const ALT_AFTER_START: unique symbol = Symbol.for('@alterior/runtime:afterStart');
export const ALT_AFTER_STOP: unique symbol = Symbol.for('@alterior/runtime:afterStop');

export const OnInit = () => LifecycleEvent(ALT_ON_INIT);
export const AfterInit = () => LifecycleEvent(ALT_AFTER_INIT);
export const OnStart = () => LifecycleEvent(ALT_ON_START);
export const OnStop = () => LifecycleEvent(ALT_ON_STOP);
export const AfterStart = () => LifecycleEvent(ALT_AFTER_START);
export const AfterStop = () => LifecycleEvent(ALT_AFTER_STOP);

/**
 * An object containing the well-known symbols for the lifecycle events built-in to `@alterior/runtime`
 * and made available to modules, controllers, etc.
 */
export const BuiltinLifecycleEvents = {
	/**
	 * Well-known name for a method which is executed when an Alterior element is initialized, such as 
	 * when an application is being bootstrapped.
	 */
	onInit: ALT_ON_INIT,

	/**
	 * Well-known name for a method which is executed after all `onInit` events have completed executing.
	 */
	afterInit: ALT_AFTER_INIT,

	/**
	 * Well-known name for a method which is executed when the Alterior application is started.
	 */
	onStart: ALT_ON_START,

	/**
	 * Well-known name for a method which is executed when the Alterior application is stopped.
	 */
	onStop: ALT_ON_STOP,

	/**
	 * Well-known name for a method which is executed after all parts of an Alterior application 
	 * have been started.
	 */
	afterStart: ALT_AFTER_START,

	/**
	 * Well-known name for a method which is executed after all parts of an Alterior application
	 * have been stopped.
	 */
	afterStop: ALT_AFTER_STOP
} as const;

/**
 * Adds the properties of the `BuiltinLifecycleEvents` object (ie `onInit`, `onStart`) to the given 
 * object in a type-safe way. Used to annotate Alterior's class decorators (`@Module`, `@Controller`, 
 * etc) with the well-known lifecycle method name symbols for convenient access (so that you can declare 
 * your init method as `[Module.onInit]()`).
 * 
 * Exported to allow third-party Alterior apps and libraries to provide a similar developer experience
 * if needed.
 * 
 * @param value The value to decorate
 * @returns The input value after attaching the properties of `BuiltinLifecycleEvents`
 */
export function withBuiltinLifecycleSymbols<T>(value: T): T & typeof BuiltinLifecycleEvents {
	let decorated = <T & typeof BuiltinLifecycleEvents>value;
	Object.assign(decorated, BuiltinLifecycleEvents);
	return decorated;
}

/**
 * Fire the given lifecycle event on the given target object. 
 * @param target 
 * @param eventName 
 */
export async function fireLifecycleEvent(target: any, eventName: symbol) {
	let reflector = new Reflector();

	if (eventName in target && typeof (target as any)[eventName] === 'function')
		await (target as any)[eventName]?.();

	let type = reflector.getTypeFromInstance(target);
	let matches = type.methods
		.map(m => [m, m.annotationsOfType(LifecycleEventAnnotation)] as const)
		.filter(([_, a]) => a.length > 0);

	let matchedMethodNames: string[] = [];

	for (let [method, annotations] of matches) {
		if (!annotations.some(x => x.name === eventName))
			continue;

		matchedMethodNames.push(method.name);
		await method.invoke(target);
	}
}

/**
 * Used internally by Alterior.
 */
export function handleLegacyLifecycleEvent(logger: RuntimeLogger, target: any, eventName: symbol) {
    // Handle legacy altOnInit/altOnStart/altOnStop/altAfterStart
    if (!eventName.description?.startsWith('@alterior/'))
		return;

    const shortName = eventName.description.replace(/^@alterior\/[^:]+?:/, '');

    if (!['onInit', 'onStart', 'onStop', 'afterStart'].includes(shortName))
		return;

    let capitalized = shortName.replace(/^./, v => v.toUpperCase());
    let legacyName = `alt${capitalized}`;
    let hasAnnotation = !!LifecycleEventAnnotation.getForMethod(target.constructor, legacyName);

    if (hasAnnotation || !legacyName || !target[legacyName])
		return;

    logger.fatal(
        `Error: Legacy lifecycle event ${target.constructor?.name ?? 'Object'}#${legacyName}() `
        + `is no longer supported. Apply the @${capitalized}() decorator instead (you may also rename `
        + `the method to whatever you want).`
    );

    throw new Error(`Legacy lifecycle events are not supported. Please migrate to Alterior 4 compatible lifecycle events.`);
    //await modInstance.instance[legacyName]();
}