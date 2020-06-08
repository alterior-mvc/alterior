import { NgModule, ModuleWithProviders, Optional } from '@angular/core';
import { Application, ExecutionContext, Runtime, ApplicationArgs, RolesService, ApplicationOptionsRef } from '@alterior/runtime';
import { Module, Provider, ClassProvider, InjectAnnotation, OptionalAnnotation } from '@alterior/di';
import { Annotation } from '@alterior/annotations';
import { Environment, Time } from '@alterior/common';

/**
 * Provides support for using Alterior modules within a larger Angular host 
 * application. 
 * 
 * ## Important: `import "reflect-metadata";`
 * Make sure you `import "reflect-metadata";` at the top
 * of your Angular application's entrypoint (usually "main.ts"). If you fail
 * to do so, the necessary metadata for some of your Alterior modules may not 
 * properly load. It is also important to ensure that your overall application 
 * has only one version of "reflect-metadata". Use `npm ls reflect-metadata` and
 * ensure that only one version is present and all are `deduped`.
 * 
 * ## Enable "emitDecoratorMetadata" if you use Alterior in the app project
 * Note: If you define Alterior modules and services within your Angular application,
 * you will also need to ensure `"emitDecoratorMetadata": true` is present in the
 * `compilerOptions` of your `tsconfig.json`. Failure to do so will cause Alterior
 * to be unable to properly resolve the dependency injections within your classes
 * defined in the application project.
 */
export class AngularPlatform {
  /**
   * Bootstraps an Alterior application module and returns a set of Angular
   * compatible dependency injection providers. You should then pass those providers
   * to the `providers` declaration of an `@NgModule` or `@Component` class.
   * 
   * @param entryModule 
   */
  static bootstrap(entryModule) {
    let runtime = new Runtime(entryModule);

    let providers : Provider[] = [
      ApplicationArgs,
      RolesService,
      Environment,
      Time
    ];

    runtime.contributeProviders(providers);
    providers.push(
      {
        provide: ApplicationOptionsRef,
        useValue: new ApplicationOptionsRef({})
      }
    );
    providers.push(Application);

    console.log(`Providers from Alterior:`);
    console.dir(providers);

    // Now we must make the located providers compatible with 
    // StaticInjector...

    providers = providers.map(provider => {
      if (typeof provider === 'function') {
        return {
          provide: provider,
          useClass: provider
        }
      }
      return provider;
    });

    providers = providers.map(provider => {
      if (provider['useClass']) {
        let classProvider : ClassProvider = <any>provider;

        const paramsAnnotations = Annotation.getAllForConstructorParameters(classProvider.useClass);
        let params = Reflect.getOwnMetadata('design:paramtypes', classProvider.useClass);
        let deps = [];

        if (classProvider.useClass.length > 0 && typeof params === 'undefined') {
          console.warn(`Warning: While bootstrapping Alterior dependencies: Could not retrieve parameter type metadata for class ${classProvider.useClass.name}: Ensure at least one decorator is affixed to the class (or add @Injectable()) and ensure that you have "import 'reflect-metadata';" at the top of your Angular project's main.ts! Angular 7+ does not use the Reflect API but Alterior does! If you define Alterior modules within your Angular project you may also need to enable 'emitDecoratorMetadata' in your tsconfig.json.`);
        }

        if (params && params.length > 0) {
          for (let i = 0; i < params.length; ++i) {
            let param = params[i];
            let paramAnnotations = paramsAnnotations[i] || [];

            let injectAnnotation = <InjectAnnotation>paramAnnotations.find(x => x instanceof InjectAnnotation);
            let optionalAnnotation = <OptionalAnnotation>paramAnnotations.find(x => x instanceof OptionalAnnotation);

            let token = param;

            if (injectAnnotation) {
              token = injectAnnotation.token;
            }

            let dep : any = token;

            if (optionalAnnotation) {
              dep = [ Optional, token ];
            } else {
              dep = token;
            }

            deps.push(dep);
          }
        }


        let newProvider = {
          provide: classProvider.provide,
          useClass: classProvider.useClass,
          deps
        }

        return newProvider;
      }

      return provider;
    });

    return providers;
  }

  /**
   * Creates a new dynamic Alterior application module which imports the given 
   * modules and returns a set of Angular-compatible dependency injection 
   * providers. You should pass the result into the `providers` property of 
   * an `@NgModule` or `@Component` to make the services provided by 
   * Alterior available within the scope you are declaring.
   * 
   * @param imports The set of Alterior modules you wish to bootstrap
   */
  static bridge(...imports) {
    @Module({ imports })
    class DynamicEntryModule {}

    return AngularPlatform.bootstrap(DynamicEntryModule);
  }
}