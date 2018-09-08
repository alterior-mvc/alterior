# @alterior/annotations

[![npm version](https://badge.fury.io/js/%40alterior%2Fannotations.svg)](https://www.npmjs.com/package/@alterior/annotations)

Provides a standardized way to define metadata on programmatic elements of a Typescript application by using classes and decorators. The data being attached is called an "annotation" and is represented as an instance of an Annotation class, and the functions which attach the metadata are called "decorators".

Annotations are stored directly on the object using `Object.defineProperty` to avoid annotations applied to superclasses from appearing on their subclasses.

## Creating annotations

First, create a subclass of Annotation. You will need to assign the annotation a "metadata name", which should be of the form `package-name:decorator-name` as shown below. Omitting `@MetadataName()` is an error.

```typescript
@MetadataName('@myorg/mypackage:Color')
export class ColorAnnotation extends Annotation {
    constructor(readonly color : string) {
        super();
    }
}
```

Next, export your new Annotation's decorator:

```typescript
export const Color = ColorAnnotation.decorator();
```

## Retrieving annotations

You can extract the annotations for a target by using the appropriate static method on your Annotation subclass. For instance, to get all `ColorAnnotations` on class `Cat`, use:

```typescript
let annotations : ColorAnnotation[] = ColorAnnotation.getAllForClass(Cat);
```

If you are not expecting more than one of the same annotation, use `getForClass()` to get the first matching annotation:

```typescript 
let annotation : ColorAnnotation = ColorAnnotation.getForClass(Cat);
```

You can attach and retrieve annotations on classes, methods, properties,
constructor parameters and method parameters. 

## Limiting the decorator's allowed targets

You can enforce that your annotation's decorator can only be used on the decoration targets you expect:

```typescript 
export const Color = ColorAnnotation.decorator({
    validTargets: [ 'class', 'method' ]
});
```

Valid targets are `class`, `method`, `property`, `constructorParameter` and `parameter`. If a developer tries to decorate an invalid target with your decorator, an `AnnotationTargetError` is thrown.

## Limit decorator to a single use per target

Sometimes it is desirable to prevent users from applying your decorator to a target more than once. Typically doing this is not an error, and Alterior can return all the annotation instances created by multiple decorators on a given target. However, Alterior can generate an error if a decorator for an annotation is used when an annotation of that type is already attached to the target, using the `allowMultiple: false` option:

```typescript 
export const Color = ColorAnnotation.decorator({
    allowMultiple: false
});
```

By default `allowMultiple` is true and the library allows the annotation decorator to be used as many times as the user desires.

## Decorator Factories

Sometimes you may want to add additional behavior to be run when the decorator is being applied. To do that, you can provide a `factory` option to your decorator:

```typescript 
export const Color = ColorAnnotation.decorator({
    factory: (name : string) => {
        // do special stuff here before 
        // returning the annotation to be attached.
        return new Color(name);
    }
})
```

## Multiple decorators for a single Annotation class

Sometimes you have multiple decorators that are storing the same type of metadata. For instance, perhaps many of your users use 'red' and 'blue' with your `@Color()` decorator, so you decide to make it so your users can use `@Red()` and `@Blue()` instead. One way you might accomplish this is:

```typescript 
    export const Color = ColorAnnotation.decorator();
    export const Red = () => Color('red');
    export const Blue = () => Color('red');
```

## Angular

(This is probably only useful inside Alterior; it is used to provide Angular compatibility for `@alterior/di`)

This library stores annotations the same way that Angular does, and does it in a compatible manner. However, all Alterior annotations will be ignored by Angular unless an Angular-specific metadata name is applied to the annotation. This can be done using the `@NgMetadataName()` decorator. The decorator causes the annotation instances to have their `ngMetadataName` property set to the string passed to the decorator.