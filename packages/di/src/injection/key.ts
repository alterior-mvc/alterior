import { stringify } from './stringify';
import { resolveForwardRef } from './forward-ref';
import { KeyRegistry } from './key-registry';

/**
 * A unique object used for retrieving items from the {@link Injector}.
 *
 * Keys have:
 * - a system-wide unique `id`.
 * - a `token`.
 *
 * `Key` is used internally by {@link Injector} because its system-wide unique `id` allows
 * the
 * injector to store created objects in a more efficient way.
 *
 * `Key` should not be created directly. {@link Injector} creates keys automatically when
 * resolving
 * providers.
 * @experimental
 */
export class Key {
  /**
   * Private
   */
  constructor(public token: Object, public id: number) {
    if (!token) {
      throw new Error('Token must be defined!');
    }
  }

  /**
   * Returns a stringified token.
   */
  get displayName(): string {
    return stringify(this.token);
  }

  static registry = new KeyRegistry();

  /**
   * Retrieves a `Key` for a token.
   */
  static get(token: Object): Key {
    // tslint:disable-next-line:no-use-before-declare
    return this.registry.get(resolveForwardRef(token));
  }

  /**
   * @returns the number of keys registered in the system.
   */
  static get numberOfKeys(): number {
    // tslint:disable-next-line:no-use-before-declare
    return this.registry.numberOfKeys;
  }
}
