import { Injectable } from './decorators';
import * as dotenv from 'dotenv';

/**
 * 
 */
@Injectable()
export class Environment {
    constructor() {
        // Load configuration from .env if there is one.
        if (typeof process !== 'undefined') {
            dotenv.config();
            this.env = process.env;
        } else {
            this.env = {};
        }
        
    }

    private defaults : any;
    private env : any;

    get raw(): any {
        return this.env;
    }

    setup<T>(defaults : Partial<T>) {
        this.defaults = defaults;
    }

    get<T>() : T {
        return Object.assign(
            this.defaults,
            (typeof process !== 'undefined' ? process.env as any : null) || {}
        );
    }
}