
/**
 * Represents a constructor. Useful for type gymnastics.
 */
export interface Constructor<T> {
    new(...args: any[]) : T;
}
