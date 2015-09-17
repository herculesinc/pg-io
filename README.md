# pg-io

Promise-based PostgreSQL client for node.js written in TypeScript

## Usage

pg-io is designed for scenarios when connection to the database is needed for a series of short and relatively simple requests. If you need a connection to execute long running queries (or queries that return large amounts of data) or require complex transaction logic, pg-io is probably not for you.

Key principals for pg-io are:
  * __Single transaction__ - only one transaction is allowed per connection session. A transaction can be started at any point during the session, but can be committed (or rolled back) only at the end of the session
  * __Low error tolerance__ - any error in query execution will terminate the session and release the connection back to the pool

The above would work well for many web-server scenarios when connection is needed to process a single user request. If an error is encountered, all changes are rolled back, an error is returned to the user, and the connection is release to handle the next request. 

## Requirements
pg-io is written in TypeScript and uses many new features of ES6 (classes, built-in promises etc.). As such, it will only work with the latest releases of Node.js which support such features. Specifically, the most recent version of pg-io __requires Node.js 4.1 or later__.

## Install

```sh
$ npm install --save pg-io
```

## Example

```JavaScript
import * as pg from 'pg-io';

var settings = { /* connections settings */ };

pg.db(settings).connect().then((connection) => {

    // create a query object
    var query = {
        text: 'SELECT * FROM users WHERE status = {{status}};',
        params: {
            status: 'active'
        },
        mask: 'list'
    };
	
    // execute the query
    return connection.execute(query)
        .then((results) => {
            // result is an array of user objects
        })
        // release the connection back to the pool
        .then(() => connection.release());
});
```

# API

## Obtaining Database Connection

pg-io exposes a single function at the root level which can be used to obtain a reference to a database object:

```JavaScript
function db(settings) : Database;
```
where `settings` should have the following form:
```
{
    host        : string;
    port?       : number;  // optional, default 5432
    user        : string;
    password    : string;
    database    : string;
    poolSize?   : number;  // optional, default 10
}
```
The returned Database object can be used further to establish a connection to the database. Creation of the database object does not establish a database connection but rather allocates a pool to hold connections to the database specified by the settings object.

Calling `db()` method multiple times with the same settings will return the same Database object. However, if different settings are supplied, different connection pools will be created.

### Database
Once a reference to a Database object is obtained, it can be used to establish a connection session using the following method:

```JavaScript
database.connect(options?) : Promise<Connection>;
```
The method returns a promise for a Connection object which represents a connection session. The optional `options` object has the following form:
```
{
  startTransaction?: boolean // optional, default false
}
```
The `startTransaction` option specifies whether a transaction should be started on the connection (more on this below).

Additionally, Database object exposes a method for checking connection pool state:

```JavaScript
database.getPoolState() : PoolState;
```

Where PoolState has the following form:
```
{
    size      : number; // current size of the connection pool
    available : number; // number of available connections in the pool
}
```

Database **connections must always be released** after they are no longer needed by calling `connection.release()` method (more on this below). If you do not release connections, connection pool will be exhausted and bad things will happen.

## Managing Transactions
pg-io supports a simple transactions mechanism. Only one transaction is allowed per connection session. A transaction can be started at any point during the connection, and must be committed or rolled back when the connection is released back to the pool.

### Entering Transaction Mode
Starting a transaction can be done via the following method:

```JavaScript
connection.startTransaction(lazy?) : Promise<void>;
```

If an optional `lazy` parameter is set to true (the default), the transaction will be started upon the first call to `connection.execute()` method. If `lazy` is set to false, the transaction will be started immediately.

It is also possible to start a transaction at the time of connection creation by passing an options object to `database.connect()` method.

```JavaScript
import * as pg from 'pg-io';

var settings = { /* connections settings */ };

pg.db(settings).connect({ stratTransaction: true }).then((connection) => {

  // connection is now in transaction and all queries executed
  // through this connection will be executed in a single transaction 
	
  return connection.release('commit');
});
```
In the above example, the transaction is actually not started immediately but is delayed until the first call to `connection.execute()` method (this is basically equivalent to starting a transaction in `lazy` mode).

Do not start transactions manually by executing `BEGIN` commands. Doing so will confuse the connection object and bad things may happen.

### Existing Transaction Mode
Transactions can be committed or rolled back by using the following method:

```JavaScript
connection.release(action?) : Promise<void>;
```
where `action` can be one of the following values:

  * 'commit' - if there is an active transaction it will be committed
  * 'rollback' - if there is an active transaction it will be rolled back
  * undefined - if no transaction was started on the connection, `release()` method can be called without `action` parameter. However, if the transaction is in progress, and `action` parameter is omitted, an error will be thrown and the active transaction will be rolled back before the connection is released back to the pool

Always call the `connection.release()` method after connection object is no longer needed. This will release the connection for use by other requests. If you do not release the connection, the connection pool will become exhausted and bad things will happen.  

In the example below, query1 and query2 are executed in the context of the same transaction, then transaction is committed and connection is released back to the pool.
```JavaScript
connection.startTransaction()
  .then(() => {
    var query1 = { ... };
    return connection.execute(query1);
  })
  .then((query1Result) => {
    // do something with the results of the first query
    var query2 = { ... };
    return connection.execute(query);
  })
  .then((query2Result) => {
    // do something with the results of the second query
  })
  .then(() => connection.release('commit'));
```

Do not commit or roll back transactions manually by executing `COMMIT` or `ROLLBACK` commands. This will confuse the connection object and bad things may happen.

#### Checking Connection State
To check whether a connection is active, the following property can be used:
 ```JavaScript
connection.isActive : boolean;
```
A connection is considered to be active from the point it is created, and until the point it is released.

To check whether a connection is in transaction, the following property can be used:

 ```JavaScript
connection.inTransaction : boolean;
```
A connection is considered to be in transaction from the point `startTransaction()` method is called, and until the point it is released via the `release()` method.

## Querying the Database
Once a reference to a Connection object is obtained, it can be used to execute queries against the database using `dao.execute()` method:

```JavaScript
// executes a single query - and return a promise for the result
connection.execute(query) : Promise<any>;

// execute multiple queries and return a map of results
connection.execute([query1, query2]) : Promise<Map>;
```

A query object passed to the execute method should have the following form:

```
{
    text    : string;
    mask?   : string;
    name?   : string;
    params? : any;
    handler?: ResultHandler;
}
```

The only required property for a query is `text`, however, the behavior of the `execute()` method is directly controlled by other query properties. The behaviors are as follows:

  * If only `text` property is provided: query will be executed against the database but no results will be returned to the user (even for SELECT statements). This is suitable for executing most INSERT, UPDATE, and DELTE commands
  * `mask` property is provided: query will be executed and the results will be returned to the user. This is suitable for executing most SELECT commands. `mask` property can have one of the following values:
    * 'list' - an array of rows retrieved from the database will be returned to the user (or `[]` if no rows were returned)
    * 'object' - first row retrieved from the database will be returned to the user (or `undefined` if no rows were returned)
  * `name` property is provided: when `execute()` is called with an array of queries, the returned map of results will be indexed by query name. For queries which don't have a name, the results will be held under the `undefined` key. If several executed queries have the same name, an array of results will be stored under the key for that name
  * `params` - query will be parametrized with the provided object (more info below)
  * `handler` - query results will be parsed using custom logic (more info below)

A few examples of executing different queries:

```JavaScript
var query1 = {
	text: `UPDATE users SET username = 'User1' WHERE id = 1;`
};
connection.execute(query1).then((result) => {
  // query is executed, and the result object is undefined
});

var query2 = {
	text: 'SELECT * FROM users;',
	mask: 'list'
};
connection.execute(query2).then((result) => {
  // result is an array of user objects
  var user1 = result[0];
});

var query3 = {
	text: 'SELECT * FROM users WHERE id = 1;',
	mask: 'object'
};
connection.execute(query3).then((result) => {
  // result is a single user object
  var user1 = result;
});

connection.execute([query1, query2, query3]).then((result) => {
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
	mask: 'object',
	name: 'q2'
};

connection.execute([query4, query5]).then((result) => {
  // result is a map laid out as follows:
  // result.get(query4.name) contains results from query4
  var user1 = result.get(query4.name)[0];
  
  // result.get(query5.name) contains results from query5
  var user2 = result.get(query5.name);
});
```
#### Parametrized Queries

Queries can be parametrized using named parameters. Parameters must be enclosed in `{{}}` brackets and `params` object should be provided with parameter values. 

```JavaScript
var query = {
  text: 'UPDATE users SET username = {{username}} WHERE id = {{id}};',
  params: {
    username: 'joe',
    id: 1
  }
};

connection.execute(query).then(() => {
  // the query is executed as
  // UPDATE users SET username = 'joe' WHERE id = 1;
});
```

Safe parameters (e.g. booleans, numbers, safe strings) are inlined into the query text before the query is sent to the database. If one of the parameters is an unsafe string, the query is executed as a parametrized query on the database to avoid possibility of SQL-injection. In general, properties in the `params` object are treated as follows:

  * boolean - always inlined
  * number - always inlined
  * Date - converted to ISO string and always inlined
  * string - if the string is safe, it is inlined, otherwise the query is executed as a parametrized query
  * object - serialized using `JSON.stringify()` and if the resulting string is safe, inlined; otherwise the query is executed as parametrized query
  * arrays - not supported
  * functions - not supported
  
#### Result Parsing

It is possible to parse query results using custom logic by providing a ResultHandler object for a query. The handler object must have a single `parse()` method which takes a row as input and produces custom output. For example:

 ```JavaScript
var query = {
  text: 'SELECT * FORM users;',
  handler: {
    parse: (row) => row.id
  }
};

connection.execute(query).then((result) => {
  // the result will contain an array of user IDs
});
```

### Errors

pg-io provides several customized errors which extend the built-in Error object (via base PgError class). These errors are:

  * ConnectionError, thrown when:
    - establishing a database connection fails
    - an attempt to use an already released connection is made
    - an attempt to release an already released connection is made
  * TransactionError, thrown when:
    - an attempt is made to start a transaction on a connection which is already in transaction
    - a connection is released without committing or rolling back an active transaction
  * QueryError, thrown when:
    - executing of a query fails
  * ParseError, thrown when
    - parsing of query results fails

If an error is thrown during query execution or query result parsing, the connection will be immediately released back to the pool. If a connection is in transaction, then the transaction is rolled back. Basically, any error generated within `connection.execute()` method will render the connection object useless and no further communication with the database through this connection object will be possible. The connection itself will be released to the pool so that it can be used by other clients.

## License
Copyright (c) 2015 Hercules Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
