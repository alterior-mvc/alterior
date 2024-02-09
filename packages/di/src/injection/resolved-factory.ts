import { Dependency } from "./dependency";
import { NoAnnotationError } from "./errors";
import { resolveForwardRef } from "./forward-ref";
import { InjectionToken } from "./injection-token";
import { Key } from "./key";
import { InjectAnnotation, OptionalAnnotation, SelfAnnotation, SkipAnnotation, SkipSelfAnnotation } from "./metadata";
import { NormalizedProvider } from "./normalized-provider";
import { Reflector } from "./reflector";
import { Type } from "./type";


const _EMPTY_LIST: any[] = [];

/**
 * An internal resolved representation of a factory function created by resolving {@link
 * Provider}.
 * @experimental
 */
export class ResolvedFactory {
  constructor(
    /**
     * Factory function which can return an instance of an object represented by a key.
     */
    public factory: Function,
    /**
     * Arguments (dependencies) to the `factory` function.
     */
    public dependencies: Dependency[]
  ) { }

  /**
   * Resolve a single provider.
   */
  static from(provider: NormalizedProvider): ResolvedFactory {
    let factoryFn: Function;
    let resolvedDeps: Dependency[];
    if (provider.useClass) {
      const useClass = resolveForwardRef(provider.useClass);
      factoryFn = Reflector.instance.factory(useClass);
      resolvedDeps = this.dependenciesFor(useClass);
    } else if (provider.useExisting) {
      factoryFn = (aliasInstance: any) => aliasInstance;
      resolvedDeps = [Dependency.fromKey(Key.get(provider.useExisting))];
    } else if (provider.useFactory) {
      factoryFn = provider.useFactory;
      resolvedDeps = this.constructDependencies(provider.useFactory, provider.deps);
    } else {
      factoryFn = () => provider.useValue;
      resolvedDeps = _EMPTY_LIST;
    }
    return new ResolvedFactory(factoryFn, resolvedDeps);
  }

  private static constructDependencies(typeOrFunc: any, dependencies?: any[]): Dependency[] {
    if (!dependencies) {
      return this.dependenciesFor(typeOrFunc);
    } else {
      const params: any[][] = dependencies.map(t => [t]);
      return dependencies.map(t => this.extractToken(typeOrFunc, t, params));
    }
  }

  private static dependenciesFor(typeOrFunc: any): Dependency[] {
    const params = Reflector.instance.parameters(typeOrFunc);

    if (!params) return [];
    if (params.some(p => p == null)) {
      console.error(`Some parameters for ${typeOrFunc.name || typeOrFunc} are null:`);
      console.dir(params);

      throw new NoAnnotationError(typeOrFunc, params);
    }
    return params.map(p => this.extractToken(typeOrFunc, p, params));
  }

  private static extractToken(typeOrFunc: any, metadata: any[] | any, params: any[][]): Dependency {
    let token: any = null;
    let optional = false;
    let skip = false;

    if (!Array.isArray(metadata)) {
      if (metadata instanceof InjectAnnotation) {
        return this.createDependency(metadata['token'], optional, null, false);
      } else {
        return this.createDependency(metadata, optional, null, false);
      }
    }

    let visibility: SelfAnnotation | SkipSelfAnnotation | null = null;

    for (let i = 0; i < metadata.length; ++i) {
      const paramMetadata = metadata[i];

      if (paramMetadata instanceof InjectAnnotation) {
        token = paramMetadata['token'];
      } else if (paramMetadata instanceof SkipAnnotation) {
        skip = true;
      } else if (paramMetadata instanceof OptionalAnnotation) {
        optional = true;
      } else if (paramMetadata instanceof SelfAnnotation || paramMetadata instanceof SkipSelfAnnotation) {
        visibility = paramMetadata;
      } else if (paramMetadata instanceof InjectionToken) {
        token = paramMetadata;
      } else if (paramMetadata instanceof Type) {
        token = paramMetadata;
      }
    }

    token = resolveForwardRef(token);

    if (token != null) {
      return this.createDependency(token, optional, visibility, skip);
    } else {
      // console.error(`Failed to find token ${typeOrFunc.name || typeOrFunc}:`);
      // console.dir(params);
      throw new NoAnnotationError(typeOrFunc, params);
    }
  }

  private static createDependency(token: any, optional: boolean, visibility: SelfAnnotation | SkipSelfAnnotation | null, skip: boolean): Dependency {
    return new Dependency(Key.get(token), optional, visibility, skip);
  }
}

