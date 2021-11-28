import { lazySubject } from './lazy-subject';
import { BehaviorSubject, Subject, Observable } from 'rxjs';

/**
 * Wait a specified amount of time before resolving.
 * @param time 
 */
export function timeout(time : number = 0) : Promise<void> {
	return new Promise<void>((resolve, reject) => {
		setTimeout(() => resolve(), time);
	});
}

/**
 * Return an observable that fires at regular intervals as long as 
 * it has subscribers. To stop the interval, remove all subscribers.
 * 
 * @param time 
 */
export function interval(time : number) : Observable<void> {
	let interval;
	return lazySubject({
		start: subject => interval = setInterval(() => subject.next()),
		stop: () => clearInterval(interval)
	});
}