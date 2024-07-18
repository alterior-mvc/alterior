import { Annotation, MetadataName } from "@alterior/annotations";

import * as conduit from '@astronautlabs/conduit';

export interface PublicOptions {
	description?: string;
	summary?: string;
}

@MetadataName('@alterior/web-server:Public')
export class PublicAnnotation extends Annotation {
	constructor(readonly options?: PublicOptions) {
		super();
	}
}

/**
 * Mark a method as available via remote procedure call. 
 * Automatically applied by the `@Route` family of decorators.
 */
export const Public = PublicAnnotation.decorator({
	factory(site, options) {
        const { target, propertyKey } = site;
		if (typeof propertyKey !== 'string')
			throw new Error(`Symbol methods cannot be marked as @Public()`);

		conduit.Method()(site.target, site.propertyKey);
        
		if (options?.description)
            conduit.Description(options?.description)(target, propertyKey);

		return new PublicAnnotation();
	},
});
