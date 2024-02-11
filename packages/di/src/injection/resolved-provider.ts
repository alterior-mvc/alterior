import { Type } from './type';

import { InvalidProviderError, MixingMultiProvidersWithRegularProvidersError } from './errors';
import { inject } from './inject';
import { Key } from './key';
import { NormalizedProvider } from './normalized-provider';
import { Provider } from './provider';
import { resolveForwardRef } from './forward-ref';

/**
 * An internal resolved representation of a {@link Provider} used by the {@link Injector}.
 *
 * It is usually created automatically by `Injector.resolveAndCreate`.
 *
 * It can be created manually, as follows:
 *
 * ### Example ([live demo](http://plnkr.co/edit/RfEnhh8kUEI0G3qsnIeT?p%3Dpreview&p=preview))
 *
 * ```typescript
 * var resolvedProviders = Injector.resolve([{ provide: 'message', useValue: 'Hello' }]);
 * var injector = Injector.fromResolvedProviders(resolvedProviders);
 *
 * expect(injector.get('message')).toEqual('Hello');
 * ```
 */
export class ResolvedProvider {
  constructor(
    /**
     * A key, usually a `Type<any>`.
     */
    public key: Key,

    /**
     * Factory function which can return an instance of an object represented by a key.
     */
    public resolvedFactories: (() => any)[],

    /**
     * Indicates if the provider is a multi-provider or a regular provider.
     */
    public multi: boolean,

    /**
     * Indicates if the provider is unique (instantiated once) or non-unique (instantiated each time it is used)
     */
    public unique: boolean
  ) { }

  get resolvedFactory(): Function {
    return this.resolvedFactories[0];
  }

  /**
   * Converts the {@link Provider} into {@link ResolvedProvider}.
   *
   * {@link Injector} internally only uses {@link ResolvedProvider}, {@link Provider} contains
   * convenience provider syntax.
   */
  static from(provider: NormalizedProvider): ResolvedProvider {
    return new ResolvedProvider(
      Key.get(provider.provide),
      [this.resolveFactory(provider)],
      provider.multi ?? false,
      provider.unique ?? true
    );
  }

  private static resolveFactory(provider: NormalizedProvider) {
    if (provider.useClass) {
      const klass = resolveForwardRef(provider.useClass);
      return () => new klass();
    }
    
    if (provider.useExisting)
      return () => inject(provider.useExisting);
    else if (provider.useFactory)
      return provider.useFactory;
    else
      return () => provider.useValue;
  }

  /**
   * Resolve a list of Providers.
   */
  static fromArray(providers: Provider[]): ResolvedProvider[] {
    const normalized = this.normalizeProviders(providers, []);
    const resolved = normalized.map(provider => ResolvedProvider.from(provider));
    const resolvedProviderMap = this.merge(resolved, new Map());
    return Array.from(resolvedProviderMap.values());
  }

  /**
   * Merges a list of ResolvedProviders into a list where
   * each key is contained exactly once and multi providers
   * have been merged.
   */
  private static merge(
    providers: ResolvedProvider[],
    normalizedProvidersMap: Map<number, ResolvedProvider>
  ): Map<number, ResolvedProvider> {
    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i];
      const existing = normalizedProvidersMap.get(provider.key.id);
      if (existing) {
        if (provider.multi !== existing.multi) {
          throw new MixingMultiProvidersWithRegularProvidersError(existing, provider);
        }
        if (provider.multi) {
          for (let j = 0; j < provider.resolvedFactories.length; j++) {
            existing.resolvedFactories.push(provider.resolvedFactories[j]);
          }
        } else {
          normalizedProvidersMap.set(provider.key.id, provider);
        }
      } else {
        let resolvedProvider: ResolvedProvider;
        if (provider.multi) {
          resolvedProvider = new ResolvedProvider(
            provider.key, 
            provider.resolvedFactories.slice(), 
            provider.multi,
            provider.unique
          );
        } else {
          resolvedProvider = provider;
        }
        normalizedProvidersMap.set(provider.key.id, resolvedProvider);
      }
    }
    return normalizedProvidersMap;
  }

  /**
   * Ensure all providers have the same shape ({ provide: any, ... }) by creating useClass providers
   * for TypeProvider (bare constructor) and flattening array providers.
   * @param providers 
   * @param res 
   * @returns 
   */
  private static normalizeProviders(providers: Provider[], res: Provider[]): NormalizedProvider[] {
    providers.forEach(b => {
      if (b instanceof Function) {
        let type = resolveForwardRef(b);
        res.push({ provide: type, useClass: type });
      } else if (b && typeof b === 'object' && (b as any).provide !== undefined) {
        res.push(b as NormalizedProvider);
      } else if (b instanceof Array) {
        this.normalizeProviders(b as Provider[], res);
      } else {
        throw new InvalidProviderError(b);
      }
    });

    return res as NormalizedProvider[];
  }
}




