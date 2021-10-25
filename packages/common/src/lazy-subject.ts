import { Subject, Observable, ConnectableObservable } from 'rxjs';
import { publish } from 'rxjs/operators';

/**
 * Options for the lazySubject() utility
 */
export interface LazySubjectOptions<T> {
    /**
     * Function that is called when the observable is subscribed to after
     * having no subscribers
     */
    start : (subject : Subject<T>) => void;

    /**
     * Function that is called when the observable moves from having subscribers
     * to having no subscribers.
     */
    stop : () => void;
}

/**
 * Utility for creating a subject observable which can run arbitrary code when the first 
 * subscribe() happens and when the last unsubscribe() happens.
 * @param options 
 */
export function lazySubject<T>(options : LazySubjectOptions<T>): Observable<T> {

    let obs = new Observable(observer => {
        let subject = new Subject<T>();
        let subscription = subject.subscribe(observer);

        options.start(subject);
        return () => {
            subscription.unsubscribe();
            options.stop();
        };
    });
    
    return (<ConnectableObservable<T>>obs.pipe(publish())).refCount();
}