import "zone.js";
import dotenv from "dotenv";
import fs from 'fs';
import path from 'path';

function fileExists(file: string): boolean {
    try {
        let stat = fs.statSync(file);
        return stat.isFile();
    } catch (e) {
        return false;
    }
}

function findDotEnv() {
    let dir = process.cwd();
    while (!fileExists(path.join(dir, '.env'))) {
        let parentDir = path.resolve(dir, '..');
        if (dir === parentDir)
            return undefined;
        dir = parentDir;
    }

    return path.resolve(dir, '.env');
}

let dotEnvPath = findDotEnv();
if (dotEnvPath)
    dotenv.config({ path: findDotEnv() });

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
    globalThis.WebSocket = <any>WebSocket;