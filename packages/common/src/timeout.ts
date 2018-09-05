import { BehaviorSubject, Subject, Observable } from 'rxjs';

export function timeout(time : number = 0) : Promise<void> {
	return new Promise<void>((resolve, reject) => {
		setTimeout(() => resolve(), time);
	});
}

export function interval(time : number) : Observable<() => void> {
	let observable = new Subject<() => void>();
	let interval;
	
	interval = setInterval(() => observable.next(() => clearInterval(interval)), time);

	return observable;
}