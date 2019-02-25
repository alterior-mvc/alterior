import { Annotation } from "@alterior/annotations";
import { Injectable, InjectionToken, Optional } from "@alterior/di";
import { Module } from "@alterior/di";
import * as Queue from "bull";
import { Inject } from "injection-js";

export interface TaskModuleOptions {
    queueName? : string;
    queueOptions? : Queue.QueueOptions;
}


/**
 * This injectable allows configuration of the task system. 
 * Include a provider for the injection token `QUEUE_OPTIONS`
 * which provides an instance of this class. 
 * 
 * For instance: `[ provide: QUEUE_OPTIONS, useValue: new TaskClientOptionsRef({ optionsHere }) ]`
 * 
 */
@Injectable()
export class TaskModuleOptionsRef {
    constructor(options : TaskModuleOptions) {
        this.options = options;
    }

    public options : TaskModuleOptions;
}

export interface TaskJob {
    id : string;
    method : string;
    args : any[];
}

export const QUEUE_OPTIONS = new InjectionToken<Queue.QueueOptions>('QueueOptions');

export class TaskAnnotation extends Annotation {
    constructor(readonly id? : string) {
        super();
    }
}

export const Task = TaskAnnotation.decorator();