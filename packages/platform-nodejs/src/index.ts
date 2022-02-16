import "zone.js";
import "dotenv/config";
import "source-map-support/register";
import "reflect-metadata";

import fetch from "node-fetch";
import WebSocket from 'ws';

if (!globalThis.fetch) {
    globalThis.fetch = <typeof globalThis.fetch><unknown>fetch;
    if (!globalThis.Response)
        globalThis.Response = fetch.Response;
    else
        console.warn(`While polyfilling fetch(): globalThis.Response is already defined! Some features of Alterior may not work correctly.`);
}

if (!globalThis.WebSocket)
    globalThis.WebSocket = WebSocket;