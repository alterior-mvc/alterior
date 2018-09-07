
export interface OnSanityCheck {
	/**
	 * Perform a sanity check to see that this service would be healthy, if started.
	 */
	altOnSanityCheck() : Promise<boolean>;
}

export interface OnInit {
	altOnInit(); 
}

export interface OnStart {
	altOnStart(); 
}

export interface OnStop {
	altOnStop(); 
}
