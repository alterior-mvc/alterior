import { deepClone } from "./clone";

interface CacheEntry<T> {
    key: string;
    time: number;
    expiresAt: number;
    lastFetched: number;
    value: T;
}

interface CacheMap<T> {
    [s: string]: CacheEntry<T>;
}

interface CacheFetcher<T> {
    (): Promise<T>;
}

interface FetchOptions {
    /**
     * The time to live to set for a fulfilled item
     */
    timeToLive?: number;

    /**
     * What kind of cache miss strategy should be used here.
     * - "fulfill" [default]: 
     *   If the cache misses for any reason, wait until the new value is fetched and return it.
     * - "stale-revalidate":
     *   If the cache misses due to an expired value, return the expired (stale) value
     *   and call the fetcher to update the value in the background.
     */
    missStrategy?: "fulfill" | "stale-revalidate";
}

/**
 * Provides a generic caching mechanism useful for a number of cases
 */
export class Cache<T> {
    /**
     * 
     * @param timeToLive Time a cached item should live before expiring, in milliseconds
     * @param maxItems Amount of items that can be held in the cache maximum.
     */
    public constructor(private timeToLive: number, private maxItems: number) {
    }

    private entries: CacheMap<T> = {};

    /**
     * Cache cleanup routine run whenever a value is stored in the cache
     */
    private async sliceCleanup() {

        let keys = Object.keys(this.entries);
        if (keys.length < this.maxItems)
            return;

        setTimeout(() => {

            // Refresh the current count, and trim the 
            // cache to the right size, evicting last-fetched item
            // first.

            keys = Object.keys(this.entries);
            let itemCount = keys.length;

            while (itemCount > this.maxItems) {
                let entry = this.getOldestEntry();
                if (!entry)
                    break;

                delete this.entries[entry.key];
                --itemCount;
            }
        }, 100);
    }

    public getOldestEntry() {
        let selectedEntry: CacheEntry<T> | null = null;
        for (let key in this.entries) {
            let entry = this.entries[key];

            if (!selectedEntry || selectedEntry.time > entry.time)
                selectedEntry = entry;
        }

        return selectedEntry;
    }

    /**
     * Insert the specified item into the cache under the given key,
     * optionally specifying a custom time-to-live. If no time-to-live
     * is specified, the class-wide default is used.
     * 
     * @param key The key for the cache entry
     * @param value The value to cache
     * @param timeToLive How long the value should remain valid for before revalidation
     */
    public insertItem(key: string, value: T, timeToLive?: number) {
        if (timeToLive === undefined)
            timeToLive = this.timeToLive;

        // Compute the value
        let now = new Date().getTime();
        let entry = this.entries[key] = { 
            key,
            time: now, 
            expiresAt: now + timeToLive,
            lastFetched: now,
            value: deepClone(value)
        };

        this.sliceCleanup();
    }

    private outstandingFetches = new Map<string, Promise<any>>();

    /**
     * Get the value present in the cache for the given key regardless 
     * of the cache entry's expiration status.
     * 
     * @param key The key to get
     */
    public get(key: string): T | undefined {
        let entry = this.entries[key];
        return entry ? deepClone(entry.value): undefined;
    }

    /**
     * Get the cache entry for the given key.
     * @param key The key to get
     */
    public getEntry(key: string): CacheEntry<T> {
        return this.entries[key];
    }

    /**
     * Fetch a value from the cache, calling the given function to 
     * generate the value if it is not present or it is expired.
     * The result of the function is then cached for future calls.
     * 
     * Use `options.missStrategy` to control the revalidation behavior. The default value ("fulfill") will
     * wait until the fetch operation completes to return a value in the case where a cache miss occurs,
     * even if an expired cache value is present. The "stale-revalidate" option will instead return the 
     * value found in the cache even when expired, executing the fetch operation if the value is expired 
     * and saving the resulting value back into the cache for future calls.
     * 
     * @param key The key to fetch
     * @param fetcher A function to define the value of the key if a cache miss occurs
     * @param options Options for doing the caching.
     */
    public async fetch(key: string, fetcher?: CacheFetcher<T>, options: FetchOptions = {}): Promise<T> {
        let existingFetch = this.outstandingFetches.get(key);
        if (existingFetch)
            return await existingFetch;

        let entry: CacheEntry<T> | undefined;
        let now = Date.now();
        let stale = true;
        
        if (key in this.entries) {
            entry = this.entries[key];
            stale = entry.expiresAt < now;
        }
        
        if (!options.missStrategy)
            options.missStrategy = 'fulfill';
           
        if (options.missStrategy === 'fulfill')
            entry = stale ? undefined : entry;

        let fetchOperation: Promise<any> | undefined;

        if (stale && fetcher) {
            fetchOperation = new Promise(async (resolve, reject) => {
                // Fetch!
                let value: T;
                try {
                    value = await fetcher();

                    if (value !== undefined)
                        this.insertItem(key, value, options.timeToLive);
                    resolve(value);
                } catch (e) {
                    console.error(`Failed to fetch item ${key}:`);
                    console.error(e);
                    debugger;

                    resolve(entry ? deepClone(entry.value): undefined);
                }
            });

            fetchOperation.finally(() => this.outstandingFetches.delete(key));

            this.outstandingFetches.set(key, fetchOperation);
        }

        return entry ? deepClone(entry.value) : await fetchOperation;
    }
}
