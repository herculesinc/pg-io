﻿# pg-io

PostgreSQL client for node.js written in TypeScript

## Use Case

pg-io is best used when connection to the database is needed for a series of short requests and then can be released (e.g. web server scenarios). If you need to have a conection the persists for a long period of time to execute long running queries (or queries that return large amounts of data), pg-io is probably not for you.

## Install

```sh
$ npm install -save pg-io
```

## Example

```JavaScript
import * as pg from 'pg-io';

var settings = { /* connections settings */ };

pg.db(settings).connect().then((connection) => {

	// create a query object
	var query = {
		text: 'SELECT * FROM users',
		mask: 'list'
	};
	
	// execute the query
	return connection.execute(query)
		.then((result) => {
			// do something with the result
		})
		.then(() => connection.release());
});
```

# API

## Obtaining Database Connection

pg-io exposes a single function at the root level which can be used to obtain a reference to a database object:

```JavaScript
function db(/* settings */) : Database;
```
Where settings object should have the following form:
```
{
    host        : string;
    port?       : number;	// optional, default 5432 is assumed
    user        : string;
    password    : string;
    database    : string;
    poolSize?   : number;  // optional, default 10 is assumed
}
```
The returned Database object can be used further to establish a connection to the database. Creation of the databse object does not establish a database connection but rather allocates a pool to hold connections to the database specified by the settings.

Calling `db()` method multiple times with the same settings will return the same Database object. However, if different settings are supplied, different connection pools will be created.

### Database
Once a referecne to a Database object is obtained, it can be used to establish a connection session using the following method:

```JavaScript
database.connect() : Promise<Connection>;
```
The method returnes a promise for a Connection object which reprsents a client session.

Additionally, Database object exposes a method for checking connection pool state:

```JavaScript
database.getPoolState() : PoolState;
```

Where PoolState has the following form:
```
{
    size		: number; // current size of the connection pool
    available	: number; // number of available connections in the pool
}
```

Database connection must always be released after it is no longer neaded by calling `connection.release()` method (more on this below). If you do not release the connection the connection pool will be exhausted and bad things will happen.

## Querying the Database
Connection object is the main interface to the database. It should not be created directly but should rather be obtained by using `database.connect()` method. Once obtained it can be used to execute queries and manage transactions.

### Executing Queries
Connection object exposes a method to execute queries:

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

The only requred property for a query is `text`, however, the behavior of the `execute()` method is directly controlled by other query properties. The behaviors are as follows:

  * If only `text` property is provided: query will be executed against the datbase but no results will be returned to the user (even for SELECT statements). This is suitable for executing most INSERT, UPDATE, and DELTE commands
  * `mask` property is provided: query will be executed and the results will be returned to the user. This is suitable for executing most SELECT commands. `mask` property can have one of the following values:
    * 'list' - an array of rows retrieved from the database will be returned to the user (or `[]` if no rows were returned)
    * 'object' - first row retrieved from the database will be returned to the user (or `undefined` if no rows were returned)
  * `name` property is provided: when `execute()` is called with an array of queries, the returned map of results will be indexed by query name. For queries which don't have a name, the results will be held under the `undefined` key. If several executed queries have the same name, an array of results will be stored under they key for that name
  * `params` - query will be parametrized with the provided object (more info below)
  * `handler` - query results will be parsed using custom logic (more info below)

A few examples of executing different queries:

```JavaScript
var query1 = {
	text: `UPDATE users SET username = 'User1' WHERE id = 1;`
};
connection.execute(query1).then((result) => {
  // result is undefined
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
  // result is a map layed out as follows:
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

Safe parameters (e.g. booleans, numbers, safe strings) are inlined into the query text before the query is sent to the database. If one of the parameters is an unsafe string, the query is executed as a parametrized query on the databse to avoid possiblity of SQL-injection. In general, properties in the `params` object are treated as follows:

  * boolean - always inlined
  * number - always inlined
  * Date - conversted to ISO string and always inlined
  * string - if the string is safe, it is inlined, otherwise the query is executed as a parametrized query
  * object - serilized using `JSON.stringify()` and if the resulting string is safe, inlined; otherwise the query is executed as parametrized query
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

## Transactions