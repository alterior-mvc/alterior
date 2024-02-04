import { Annotation, AnnotationDecorator, MetadataName } from '@alterior/annotations';
import { Provider } from '@alterior/di';

export interface ApplicationOptions {
	
	/**
	 * Specify a human readable name for your application.
	 */
	name?: string;

	/**
	 * Version of the service. If not specified, Alterior will try to read this from your package.json, 
	 * if we are in an environment where that's possible.
	 */
	version?: string;
	
	/**
	 * The computer-readable name for your application. Should match your NPM package name.
	 */
	packageName?: string;

	/**
	 * A long-form description for your application, when necessary. If you implement only one,
	 * implement summary instead.
	 */
	description?: string;

	/**
	 * A shorter-form description for your application, when necessary. If you implement only one,
	 * implement this instead of description.
	 */
	summary?: string;

	/**
	 * A set of string tags related to your application.
	 */
	tags?: string[];

	group?: string;
	
	/**
	 * Enable verbose console logging for Alterior
	 */
	verbose?: boolean;

	/**
	 * Whether to start the service immediately on startup.
	 * Defaults to true.
	 */
	autostart?: boolean;

	/**
	 * Turn off all console output
	 */
	silent?: boolean;

	/**
	 * Additional dependency injection providers to include in the application's injector.
	 */
	providers?: Provider[];
}

/**
 * Used to attach an ApplicationOptions object onto a class definition.
 */
@MetadataName('@alterior/di:Application')
export class AppOptionsAnnotation extends Annotation {
	constructor(readonly options?: ApplicationOptions) {
		super();
	}
}

/**
 * Use this decorator to define the options for your application, 
 * either on the entry module, or service class when using `@alterior/web-server`.
 */
export const AppOptions = AppOptionsAnnotation.decorator({
	validTargets: ['class']
});
