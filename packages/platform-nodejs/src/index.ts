import "zone.js";
import "dotenv/config";
import "source-map-support/register";
import "reflect-metadata";

import fetch from "node-fetch";

if (!globalThis.fetch)
    globalThis.fetch = <typeof globalThis.fetch><unknown>fetch;