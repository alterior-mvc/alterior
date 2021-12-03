import "zone.js";
import "dotenv/config";
import "source-map-support/register";
import "reflect-metadata";

import fetch from "node-fetch";
import WebSocket from 'ws';

if (!globalThis.fetch)
    globalThis.fetch = <typeof globalThis.fetch><unknown>fetch;

if (!globalThis.WebSocket)
    globalThis.WebSocket = WebSocket;