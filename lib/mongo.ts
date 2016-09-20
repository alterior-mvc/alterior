import { ValueProvider } from '@angular/core';

import * as mongodb from 'mongodb';

export function mongoProvider(dbClass : any, url? : string): Promise<ValueProvider> {
	if (!url)
		url = "mongodb://localhost:27017/db";
	return <Promise<any>>mongodb.MongoClient.connect(url)
		.then(db => { return <ValueProvider>{
			provide: dbClass,
			useValue: db
		}; });
}

export class MongoClientFactory {
	public static connect(mongoURL : string): Promise<mongodb.Db> {
		return <any>mongodb.MongoClient.connect(mongoURL);
	}
}