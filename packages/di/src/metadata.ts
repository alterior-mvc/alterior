import { MetadataName, NgMetadataName, Annotation } from "@alterior/annotations";

@NgMetadataName('Inject')
@MetadataName('alterior:Inject')
export class InjectableAnnotation extends Annotation {
}

export const Injectable = InjectableAnnotation.decorator({
    validTargets: ['class']
});


@NgMetadataName('Optional')
@MetadataName('alterior:Optional')
export class OptionalAnnotation extends Annotation {
}

export const Optional = OptionalAnnotation.decorator({
    validTargets: ['parameter']
});

@NgMetadataName('Inject')
@MetadataName('alterior:Inject')
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