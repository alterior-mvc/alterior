import { MetadataName, NgMetadataName, Annotation, AnnotationDecorator } from "@alterior/annotations";

@NgMetadataName('Inject')
@MetadataName('@alterior/di:Injectable')
export class InjectableAnnotation extends Annotation {
}

export const Injectable = InjectableAnnotation.decorator({
    validTargets: ['class']
});


@NgMetadataName('Optional')
@MetadataName('@alterior/di:Optional')
export class OptionalAnnotation extends Annotation {
}

export const Optional = OptionalAnnotation.decorator({
    validTargets: ['parameter']
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
    validTargets: ['parameter']
});
