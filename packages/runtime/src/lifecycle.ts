/**
 * Specifies that the implementer understands the Alterior OnInit lifecycle event.
 * Implementing this interface is a best practice to ensure that implementations 
 * are well-formed.
 */
export interface OnInit {
	altOnInit(); 
}

/**
 * Specifies that the implementer understands the Alterior OnStart lifecycle event. 
 * Implementing this interface is a best practice to ensure that implementations 
 * are well-formed.
 */
export interface OnStart {
	altOnStart(); 
}

/**
 * Specifies that the implementer understands the Alterior OnStop lifecycle event.
 * Implementing this interface is a best practice to ensure that implementations 
 * are well-formed.
 */
export interface OnStop {
	altOnStop(); 
}
