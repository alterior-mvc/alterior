import { MetadataName, NgMetadataName, AngularCompatibleAnnotation } from "annotations";

@NgMetadataName('Inject')
@MetadataName('alterior:Inject')
export class InjectableAnnotation extends AngularCompatibleAnnotation {
}

export const Injectable = InjectableAnnotation.decorator({
    validTargets: ['class']
});


@NgMetadataName('Optional')
@MetadataName('alterior:Optional')
export class OptionalAnnotation extends AngularCompatibleAnnotation {
}

export const Optional = OptionalAnnotation.decorator({
    validTargets: ['parameter']
});

@NgMetadataName('Inject')
@MetadataName('alterior:Inject')
export class InjectAnnotation extends AngularCompatibleAnnotation {
    constructor(
        readonly token : any
    ) {
        super();
    }
}

export const Inject = InjectAnnotation.decorator({
    validTargets: ['parameter']
});