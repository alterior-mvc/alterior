import { inject } from "@alterior/di";
import { ConfiguredModule, Module } from "@alterior/runtime";
import * as mongodb from 'mongodb';

@Module()
export class MongoDBModule {
    static configure(url: string, dbName: string) {
        let client: mongodb.MongoClient;
        let db: mongodb.Db;

        return <ConfiguredModule>{
            $module: MongoDBModule,
            prepare: async () => {
                client = await new mongodb.MongoClient(url).connect();
                db = client.db(dbName);
            },
            providers: [
                { provide: mongodb.MongoClient, useFactory: () => client },
                { provide: mongodb.Db, useFactory: () => db }
            ]
        }
    }
}

export function collection<T extends object>(name: string, options?: mongodb.CollectionOptions) {
    return inject(mongodb.Db).collection<T>(name, options);
}