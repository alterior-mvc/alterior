import { deepClone } from "./clone";

interface CacheEntry<T> {
    key : string;
    time : number;
    expiresAt : number;
    lastFetched : number;
    value : T;
}

interface CacheMap<T> {
    [s : string] : CacheEntry<T>;
}

interface CacheFetcher<T> {
    (): Promise<T>;
}

interface FetchOptions {
    /**
     * The time to live to set for a fulfilled item
     */
    timeToLive? : number;

    /**
     * What kind of cache miss strategy should be used here.
     * - "fulfill": 
     *   If the cache misses for any reason, wait until the new value is fetched and return it.
     * - "stale-revalidate":
     *   If the cache misses due to an expired value, return the expired (stale) value
     *   and call the fetcher to update the value in the background.
     */
    missStrategy? : "fulfill" | "stale-revalidate";
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
    public constructor(private timeToLive : number, private maxItems : number) {
    }

    private entries : CacheMap<T> = {};

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
                delete this.entries[entry.key];
                --itemCount;
            }
        }, 100);
    }

    public getOldestEntry() {
        let selectedEntry : CacheEntry<T> = null;
        for (let key in this.entries) {
            let entry = this.entries[key];

            if (!selectedEntry || selectedEntry.time > entry.time)
                selectedEntry = entry;
        }

        return selectedEntry;
    }

    public insertItem(key : string, value : T, timeToLive? : number) {
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

    public async fetch(key : string, fetcher? : CacheFetcher<T>, options : FetchOptions = {}): Promise<T> {
        let existingFetch = this.outstandingFetches.get(key);
        if (existingFetch)
            return await existingFetch;

        let entry : CacheEntry<T>;
        let now = Date.now();
        let stale = true;
        
        if (key in this.entries) {
            entry = this.entries[key];
            stale = entry.expiresAt < now;
        }
        
        if (options.missStrategy === 'fulfill')
            entry = stale ? undefined : entry;

        let fetchOperation : Promise<any>;

        if (stale && fetcher) {
            fetchOperation = new Promise(async (resolve, reject) => {
                // Fetch!
                let value : T;
                try {
                    value = await fetcher();
                    this.insertItem(key, value, options.timeToLive);
                    resolve(value);
                } catch (e) {
                    console.error(`Failed to fetch item ${key}:`);
                    console.error(e);
                    debugger;

                    resolve(entry ? deepClone(entry.value) : undefined);
                }
            });

            fetchOperation.finally(() => this.outstandingFetches.delete(key));

            this.outstandingFetches.set(key, fetchOperation);
        }

        return entry ? deepClone(entry.value) : await fetchOperation;
    }
}
