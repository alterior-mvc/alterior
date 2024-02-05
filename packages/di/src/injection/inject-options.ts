
/**
 * Type of the options argument to `inject`.
 *
 * @publicApi
 */
export declare interface InjectOptions {
    /**
     * Use optional injection, and return `null` if the requested token is not found.
     */
    optional?: boolean;
    /**
     * Start injection at the parent of the current injector.
     */
    skipSelf?: boolean;
    /**
     * Only query the current injector for the token, and don't fall back to the parent injector if
     * it's not found.
     */
    self?: boolean;
  }
  