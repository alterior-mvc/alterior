/// <reference types="zone.js" />

import "zone.js/node";
import "zone.js/plugins/zone-patch-rxjs";
import "source-map-support/register";
import "reflect-metadata";

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
    let filename = '.env';

    if (process.env['NODE_ENV']) {
        filename = `.env.${process.env['NODE_ENV']}`;
    }

    while (!fileExists(path.join(dir, filename))) {
        let parentDir = path.resolve(dir, '..');
        if (dir === parentDir)
            return undefined;
        dir = parentDir;
    }

    return path.resolve(dir, filename);
}

let dotEnvPath = findDotEnv();
if (dotEnvPath)
    dotenv.config({ path: findDotEnv() });

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