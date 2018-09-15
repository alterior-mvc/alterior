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
     *   If the cache misses for any reason, wait until the new value is fetched and return it
     * - "fallback-refresh":
     *   If the cache misses
     */
    missStrategy? : "fulfill" | "fallback-refresh";
}


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

    public async fetch(key : string, fetcher? : CacheFetcher<T>, options : FetchOptions = {}): Promise<T> {
        let entry : CacheEntry<T>;
        let now = new Date().getTime();
        let availableCachedItem = null;
        let timeToLive = options.timeToLive;

        if (key in this.entries) {
            let hitEntry = this.entries[key];
            availableCachedItem = hitEntry.value;

            if (hitEntry.expiresAt > now) {
                entry = hitEntry;
            }
        }

        if (entry)
            return deepClone(entry.value);

        if (!fetcher)
            return availableCachedItem;
        
        // Fetch!
        let value : T;
        try {
            value = await fetcher();
            this.insertItem(key, value, timeToLive);
        } catch (e) {
            console.error(`Failed to fetch item ${key}:`);
            console.error(e);
            debugger;

            return availableCachedItem;
        }

        return value;
    }
}
