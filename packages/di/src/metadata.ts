import { MetadataName, NgMetadataName, Annotation, AnnotationDecorator } from "@alterior/annotations";
import { Optional as ijsOptional, Injectable as ijsInjectable, Inject as ijsInject } from "injection-js";

@NgMetadataName('Inject')
@MetadataName('@alterior/di:Injectable')
export class InjectableAnnotation extends Annotation {
}

export const Injectable = InjectableAnnotation.decorator({
    validTargets: ['class'],
    factory(target) {
        ijsInjectable()(target.target);
        return new InjectableAnnotation();
    }
});


@NgMetadataName('Optional')
@MetadataName('@alterior/di:Optional')
export class OptionalAnnotation extends Annotation {
}

export const Optional = OptionalAnnotation.decorator({
    validTargets: ['parameter'],
    factory(target) {
        ijsOptional()(target.target, target.propertyKey, target.index);
        return new OptionalAnnotation();
    }
});

@NgMetadataName('Inject')
@MetadataName('@alterior/di:Inject')
export class InjectAnnotation extends Annotation {
    constructor(
        readonly token : any
    ) {
        super();
    }
}

export const Inject = InjectAnnotation.decorator({
    validTargets: ['parameter'],
    factory(target, token) {
        ijsInject(token)(target.target, target.propertyKey, target.index);
        return new InjectAnnotation(token);
    }
});
