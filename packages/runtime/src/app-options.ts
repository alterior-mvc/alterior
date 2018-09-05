import { Annotation, MetadataName } from '@alterior/annotations';

export interface ApplicationOptions {
	
	name? : string;
	description? : string;
	summary? : string;
	tags? : string[];
	group? : string;
	
	/**
	 * Enable verbose console logging for Alterior
	 */
	verbose? : boolean;

	/**
	 * Whether to start the service immediately on startup.
	 * Defaults to true.
	 */
	autostart? : boolean;

	/**
	 * Turn off all console output
	 */
	silent? : boolean;
}

@MetadataName('alterior:Application')
export class AppOptionsAnnotation extends Annotation {
	constructor(readonly options? : ApplicationOptions) {
		super();
	}
}

export const AppOptions = AppOptionsAnnotation.decorator({
	validTargets: ['class']
});
