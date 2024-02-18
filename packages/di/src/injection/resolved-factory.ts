import { isConstructor } from "@alterior/functions";
import { inject } from "./inject";
import { NormalizedProvider } from "./normalized-provider";
import { ConcreteType } from "./type";

/**
 * An internal resolved representation of a factory function created by resolving {@link
 * Provider}.
 */
export class ResolvedFactory {
  constructor(
    /**
     * Factory function which can return an instance of an object represented by a key.
     */
    public factory: Function
  ) { }

  /**
   * Resolve a single provider.
   */
  static from(provider: NormalizedProvider): Function {
    if (provider.useClass) {
      const ctor = provider.useClass;
      return () => new ctor();
    }
    
    if (provider.useExisting)
      return () => inject(provider.useExisting!);
    else if (provider.useFactory)
      return provider.useFactory;
    else
      return () => provider.useValue;
  }
}

