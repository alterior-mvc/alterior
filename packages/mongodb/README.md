# @alterior/logging

[![Version](https://img.shields.io/npm/v/@alterior/mongodb.svg)](https://www.npmjs.com/package/@alterior/mongodb)

## Overview

Use MongoDB as a first-class citizen in your Alterior app.

## Installation

```
npm install @alterior/mongodb
```

## Usage

First you need to add `MongoDBModule` to your imports. The module needs to be configured with the URL and database n
name of the MongoDB server you want to connect to. Once that's done, you can use the `collection()` function within 
a module, injectable service, or anywhere else `inject()` can be used to obtain a `mongodb.Collection<T>` instance 
that you can use to access a collection.

```typescript
import { MongoDBModule, collection } from '@alterior/mongodb';

interface Widget {
    name: string;
    color: string;
}

@WebService({
    imports: [
        MongoDBModule.configure('mongodb://localhost:27017', 'mydb')
    ]
})
export class MyWebService {
    private widgets = collection<Widget>('widgets');

    async altOnStart() {
        let blueWidgets = await this.widgets.find({ color: 'blue' }).toArray();
    }
}
```

You can also acquire the `MongoClient` and the `MongoDB` directly instance using `inject()` if you need to do something
more complicated.

```typescript
import { Injectable } from '@alterior/di';
import * as mongodb from 'mongodb';

class MyInjectableService {
    private mongoClient = inject(mongodb.MongoClient);
    private db = inject(mongodb.Db);
}

```