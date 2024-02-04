import { Application } from '@alterior/runtime';
import { Module, ModuleLike } from '@alterior/di';
import { Provider as AngularProvider } from '@angular/core';

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
  static async bootstrap(entryModule: Function): Promise<AngularProvider[]> {
    let app = await Application.bootstrap(entryModule);
    return app.runtime.providers.map(provider => {
      let token = 'provide' in provider ? provider.provide : provider;
      return { 
        provide: token, 
        useValue: app.injector.get(token)
      }
    });
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
  static bridge(...imports: ModuleLike[]) {
    @Module({ imports })
    class DynamicEntryModule {}

    return AngularPlatform.bootstrap(DynamicEntryModule);
  }
}