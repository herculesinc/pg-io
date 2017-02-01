# pg-io

Promise-based PostgreSQL client for node.js written in TypeScript

## Usage

pg-io is designed for scenarios when connection to the database is needed for a series of short and relatively simple requests. If you need a connection to execute long running queries (or queries that return large amounts of data) or require complex transaction logic, pg-io is probably not for you.

Key principals for pg-io are:
  * __Single transaction__ - only one transaction is allowed per connection session. A transaction can be started at any point during the session, but can be committed (or rolled back) only at the end of the session
  * __Low error tolerance__ - any error in query execution will terminate the session and release the connection back to the pool

The above would work well for many web-server scenarios when connection is needed to process a single user request. If an error is encountered, all changes are rolled back, an error is returned to the user, and the connection is released to handle the next request. 

## Requirements
pg-io is written in TypeScript and uses many new features of ES6. As such, it will only work with the latest releases of Node.js which support such features. Specifically, the most recent version of pg-io __requires Node.js 6.0 or later__.

## Install

```sh
$ npm install --save pg-io
```

## Example

```JavaScript
import { Database } from 'pg-io';

// create a database object
const db = new Database({ /* database options */ });

// get a connection session
db.connect().then((session) => {

    // create a query object
    var query = {
        text: 'SELECT * FROM users WHERE status = {{status}};',
        params: {
            status: 'active'
        },
        mask: 'list'
    };
	
    // execute the query
    return session.execute(query)
        .then((results) => {
            // result is an array of user objects
        })
        // close the session to release the connection back to the pool
        .then(() => session.close());
});
```

# API

**Breaking changes**
* Many interfaces have changed signficantly between 0.6 and 0.7
* Query `mask` values have been redefined in version 0.8

## Obtaining Database Connection

pg-io exposes a `Database` class which can be created like so:

```JavaScript
const db = new Database(options, logger?);
```
where `options` should have the following form:
```TypeScript
{
    name?               : string;   // defaults to 'database', used for logging
    pool?: {                        // optional connection pool settings
        maxSize?        : number;   // defaults to 20   
        idleTimeout?    : number;   // defaults to 30000 milliseconds
        reapInterval?   : number;   // defaults to 1000 milliseconds
    };
    connection: {                   // required connection settings
        host            : string;
        port?           : number;   // optional, default 5432
        ssl?            : boolean;  // optional, defaults to false
        user            : string;
        password        : string;
        database        : string;
    };
    session: {                        // optional default session options
      startTransaction? : boolean;    // defaults to false
      logQueryText?     : boolean;    // defaults to false
    };
}
```
and, if provided, `logger` must comply with the following interface:
```TypeScript
interface Logger {
    debug(message: string, source?: string);
    info(message: string, source?: string);
    warn(message: string, source?: string);
    trace(source: string, command: string, time: number, success?: boolean);
}
```

Creation of the database object does not establish a database connection but rather allocates a pool to hold connections to the database specified by the options object.

### Database
Once a Database object is created, it can be used to acquire connection sessions from the pool like so:

```JavaScript
database.connect(options?) : Promise<Session>;
```
The method returns a promise for a `Session` object which represents a connection session. The optional `options` object has the following form:
```TypeScript
{
  startTransaction? : boolean;    // defaults to false
  logQueryText?     : boolean;    // defaults to false
}
```
The `startTransaction` option specifies whether a transaction should be started on the connection (more on this below).

Additionally, Database object exposes a method for checking connection pool state:

```JavaScript
database.getPoolState() : PoolState;
```

Where `PoolState` has the following form:
```TypeScript
{
    size      : number; // current size of the connection pool
    available : number; // number of available connections in the pool
}
```

**Connections must always be released** back to the pool after they are no longer needed by calling `session.close()` method (more on this below). If you do not release connections, connection pool will be exhausted and bad things will happen.

## Managing Transactions
pg-io supports a simple transactions mechanism. Only one transaction is allowed per connection session. A transaction can be started at any point during the session, and must be committed or rolled back when the session is closed.

### Entering Transaction Mode
Starting a transaction can be done via the following method:

```TypeScript
connection.startTransaction(lazy?: boolean) : Promise<void>;
```

If an optional `lazy` parameter is set to true (the default), the transaction will be started upon the first call to `session.execute()` method. If `lazy` is set to false, the transaction will be started immediately.

It is also possible to start a transaction at the time of session creation by passing an options object to `database.connect()` method.

```TypeScript
import { Database } from 'pg-io';

const db = new Database({ /* database settings */ });

db.connect({ stratTransaction: true }).then((session) => {

  // session is now in transaction and all queries executed
  // through this session will be executed in a single transaction 
	
  return session.release('commit');
});
```
In the above example, the transaction is actually not started immediately but is delayed until the first call to `session.execute()` method (this is basically equivalent to starting a transaction in `lazy` mode).

Do not start transactions manually by executing `BEGIN` commands. Doing so will confuse the session object and bad things may happen.

### Exiting Transaction Mode
Transactions can be committed or rolled back by using the following method:

```TypeScript
session.close(action?: 'commit' | 'rollback') : Promise<void>;
```
where `action` can be one of the following values:

  * 'commit' - if there is an active transaction it will be committed
  * 'rollback' - if there is an active transaction it will be rolled back
  * undefined - if no transaction was started during the session, `close()` method can be called without `action` parameter. However, if the transaction is in progress, and `action` parameter is omitted, an error will be thrown and the active transaction will be rolled back before the connection is released back to the pool

Always call the `session.close()` method after session object is no longer needed. This will release the connection for use by other requests. If you do not release the connection, the connection pool will become exhausted and bad things will happen.  

In the example below, query1 and query2 are executed in the context of the same transaction, then transaction is committed and connection is released back to the pool.
```TypeScript
session.startTransaction()
  .then(() => {
    const query1 = { ... };
    return session.execute(query1);
  })
  .then((query1Result) => {
    // do something with the results of the first query
    const query2 = { ... };
    return session.execute(query);
  })
  .then((query2Result) => {
    // do something with the results of the second query
  })
  .then(() => session.close('commit'));
```

Do not commit or roll back transactions manually by executing `COMMIT` or `ROLLBACK` commands. This will confuse the session object and bad things may happen.

#### Checking Connection State
To check whether a session is active, the following property can be used:
 ```TypeScript
session.isActive : boolean;
```
A session is considered to be active from the point it is created (via `database.connect()` method), and until it is closed (via `session.close()` method).

To check whether a session is in transaction, the following property can be used:

 ```TypeScript
session.inTransaction : boolean;
```
A session is considered to be in transaction from the point `session.startTransaction()` method is called, and until it is closed via the `session.close()` method.

## Querying the Database
Once a reference to a `Session` object is obtained, it can be used to execute queries against the database using `session.execute()` method:

```TypeScript
// executes a single query - and return a promise for the result
connection.execute(query) : Promise<any>;

// execute multiple queries and return a map of results
connection.execute([query1, query2]) : Promise<Map>;
```

A query object passed to the `execute()` method should have the following form:

```TypeScript
{
    text    : string;
    mask?   : 'list' | 'single';
    mode?   : 'object' | 'array';
    name?   : string;
    params? : any;
    handler?: ResultHandler;
}
```

The only required property for a query is `text`, however, the behavior of the `execute()` method is directly controlled by other query properties. The meaning of the properties is as follows:

| Property | Type    | Description |
| -------  | ------- | ----------- |
| text     | string  | SQL code to be executed against the database |
| mask     | enum?   | Optional result mask; can be one of the following values: [`list`, `single`]. If `mask` is not provided, no results will be returned to the caller (even for SELECT statements).<br/><br/>When `mask=list`,  an array of rows retrieved from the database will be returned to the caller (or [] if no rows were returned).<br/><br/>When `mask=single`, first row retrieved from the database will be returned to the caller (or `undefined` if no rows were returned). |
| mode     | enum?   | Optional row mode; can be one of the following values: [`object`, `array`]; default is `object`.<br/><br/>When `mode=object`, each row will be returned as an object with property keys being field names.<br/><br/>When `mode=array` each row will be returned as an array of values (without the field names). |
| name     | string? | Optional query name; used for logging. Also, when `execute()` is called with an array of queries, the returned map of results will be indexed by query name. For queries which don't have a name, the results will be held under the `undefined` key. If several executed queries have the same name, an array of results will be stored under the key for that name |
| params   | object? | Optional parameters to apply to to the query (see [parameterized queries](#parameterized-queries)) 
| handler  | <ResultHandler>? | Optional result handler to apply custom parsing logic (see [result parsing](#result-parsing) ) | 

A few examples of executing different queries:

```TypeScript
var query1 = {
	text: `UPDATE users SET username = 'User1' WHERE id = 1;`
};
session.execute(query1).then((result) => {
  // query is executed, and the result object is undefined
});

var query2 = {
	text: 'SELECT * FROM users;',
	mask: 'list'
};
session.execute(query2).then((result) => {
  // result is an array of user objects
  var user1 = result[0];
});

var query3 = {
	text: 'SELECT * FROM users WHERE id = 1;',
	mask: 'single'
};
session.execute(query3).then((result) => {
  // result is a single user object
  var user1 = result;
});

session.execute([query1, query2, query3]).then((result) => {
  // result is a map layed out as follows:
  // result.get(undefined)[0] contains results from query2
  var user1 = result.get(undefined)[0][0];
  
  // result.get(undefined)[1] contains results from query3
  var user2 = result.get(undefined)[1];
  
  // results from query1 are not in the map
});

var query4 = {
	text: 'SELECT * FROM users;',
	mask: 'list',
	name: 'q1'
};

var query5 = {
	text: 'SELECT * FROM users WHERE id = 1;',
	mask: 'single',
	name: 'q2'
};

session.execute([query4, query5]).then((result) => {
  // result is a map laid out as follows:
  // result.get(query4.name) contains results from query4
  var user1 = result.get(query4.name)[0];
  
  // result.get(query5.name) contains results from query5
  var user2 = result.get(query5.name);
});
```
#### Parameterized Queries

Queries can be parametrized using named parameters. Parameters must be enclosed in `{{}}` brackets and `params` object should be provided with parameter values. 

```JavaScript
var query = {
  text: 'UPDATE users SET username = {{username}} WHERE id = {{id}};',
  params: {
    username: 'joe',
    id: 1
  }
};

session.execute(query).then(() => {
  // the query is executed as
  // UPDATE users SET username = 'joe' WHERE id = 1;
});
```

Safe parameters (e.g. booleans, numbers, safe strings) are inlined into the query text before the query is sent to the database. If one of the parameters is an unsafe string, the query is executed as a parametrized query on the database to avoid possibility of SQL-injection. In general, properties in the `params` object are treated as follows:

  * __boolean__ - always inlined
  * __number__ - always inlined
  * __Date__ - converted to ISO string and always inlined
  * __string__ - if the string is safe, it is inlined, otherwise the query is executed as a parametrized query
  * __object__ - object parameters are treated as follows:
    - `valueOf()` method is called on the object and if it returns a number, a boolean, a safe string, or a date, the value is inlined; if the returned value is an unsafe string, the query is executed as parametrized query
    - if `valueOf()` method returns an object, the parameter is converted to string using `JSON.stringify()` and if the resulting string is safe, inlined; otherwise the query is executed as parametrized query
  * __arrays__ - arrays are parametrized same as objects
  * __null__ or __undefined__ - always inlined as 'null'
  * __functions__ - functions are parametrized as follwos:
    - `valueOf()` mehtod is called on the function, and if it returns a primitive value, the value is inlined
    - otherwise QueryError will be thrown

It is also possible to parametrize arrays of primitives in a special way to make them useful for `IN` clauses. This can be done by using `[[]]` brackets. In this case, the parameterization logic is as follows:

 * arrays of numbers are always inlined using commas as a separator
 * arrays of strings are either inlined (if the strings are safe) or sent to the database as parametrized queries (if strings are unsafe)
 * all other array types (and arrays of mixed numbers and strings) are not supported and will throw QueryError

Examples of array parametrization:
```TypeScript
var query1 = {
  text: 'SELECT * FROM users WHERE id IN ([[ids]]);',
  params: {
    ids: [1, 2]
  }
};
// query1 will be executed as:
// SELECT * FROM users WHERE id IN (1,2);

// if {{}} was used instead, the query would have been: 
// SELECT * FROM users WHERE id IN ('[1,2]'); 

var query2 = {
  text: 'SELECT * FROM users WHERE type IN ([[types]]);',
  params: {
    types: ['personal', 'business']
  }
};
// query2 will be executed as:
// SELECT * FROM users WHERE type IN ('personal','business');

// if {{}} was used instead, the query would have been: 
// SELECT * FROM users WHERE type IN ('["personal","business"]');

var query3 = {
  text: 'SELECT * FROM users WHERE name IN ([[names]]);',
  params: {
    names: [`Test`, `T'est`, `Test2` ]
  }
};

// query3 will be executed as:
// SELECT * FROM users WHERE firstName IN ('Test',$1,'Test2');
```
  
#### Result Parsing

It is possible to parse query results using custom logic by providing a `ResultHandler` object for a query. The handler object must have a single `parse()` method which takes a row as input and produces custom output. For example:

 ```JavaScript
var query = {
  text: 'SELECT * FORM users;',
  handler: {
    parse: (row) => row.id
  }
};

session.execute(query).then((result) => {
  // the result will contain an array of user IDs
});
```

### Errors

pg-io provides several customized errors which extend the built-in Error object (via base PgError class). These errors are:

  * __ConnectionError__, thrown when:
    - establishing a database connection fails
    - an attempt to use an already closed session is made
    - an attempt to close an already closed session is made
  * __TransactionError__, thrown when:
    - an attempt is made to start a transaction on in a session which is already in transaction
    - a session is closed without committing or rolling back an active transaction
  * __QueryError__, thrown when:
    - executing of a query fails
  * __ParseError__, thrown when
    - parsing of query results fails

If an error is thrown during query execution or query result parsing, the session will be immediately closed. If a session is in transaction, then the transaction is rolled back. Basically, any error generated within `session.execute()` method will render the session object useless and no further communication with the database through this sessiont will be possible. The underlying connection will be released to the pool so that it can be used by other clients.

## License
Copyright (c) 2016 Hercules Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
