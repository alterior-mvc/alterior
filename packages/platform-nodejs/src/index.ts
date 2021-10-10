import "zone.js";
import "dotenv/config";
import "source-map-support/register";
import "reflect-metadata";

if (!globalThis.fetch)
    globalThis.fetch = require('node-fetch');