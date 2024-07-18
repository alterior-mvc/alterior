/**
 * A DI service to get the current time. 
 * Useful if you need to mock or redfine 
 * the concept of "current time"
 */
export class Time {
    now(): number {
        return Date.now();
    }

    current(): Date {
        return new Date();
    }
}