import { Annotation, AnnotationDecorator } from "./annotations";

/**
 * Represents whether an element should be treated visible or not.
 * To apply, use @Expose() or @Hide()
 */
export class VisibilityAnnotation extends Annotation {
    constructor(readonly visible : boolean) {
        super();
    }
}

export const Visibility = VisibilityAnnotation.decorator();

/**
 * Declare that this element should be exposed. The meaning of this 
 * depends on the context in which it is used.
 */
export const Expose = () => target => Visibility(true)(target);
export const Hide = () => target => Visibility(false)(target);