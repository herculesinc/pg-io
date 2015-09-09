# pg-io

PostgreSQL client for node.js built on top of node-postgres library

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

The only requred property for a query is `text`, however, the behavior of the `execute()` method is directly controlled by other query properties. The behavior is as follows:

  * Only `text` property is provided: query will be executed against the datbase but no results will be returned to the user. This is suitable for executing most INSERT, UPDATE, DELTE commands
  * `mask` property is provided: query is expected to return results. This is suitable executing most SELECT commands. `mask` property can have one of the following two values:
    * 'list' - an array of results representing rows returned from the database (or `[]` if no rows were returned)
	* 'object' - first row returned from the database (or `undefined` if no rows were returned)
  * `name` property is provided: when `execute()` is called with an array of queries, the returned map of results will be indexed by query name. For queries which don't have a name, the results will held under an `undefined` key (if multiple queries map to an `undefined` key, the value for this key will be an array)
  * `params` - query will be parametrized with the provided object (more info below)
  * `handler` - query results will be parsed using custom logic (more info below)

A few examples of executing different queries:

```JavaScript
var query1 = {
	text: `UPDATE users SET username = 'User1' WHERE id = 1;`
};
connection.execute(query1).then((result) => {
  // result is a void value
});

var query2 = {
	text: 'SELECT * FROM users;',
	mask: 'list'
};
connection.execute(query2).then((result) => {
  // result is an array of user objects
});

var query3 = {
	text: 'SELECT * FROM users WHERE id = 1;',
	mask: 'object'
};
connection.execute(query3).then((result) => {
  // result is a single user object
});

connection.execute([query1, query2, query3]).then((result) => {
  // result is a map layed out as follows:
  // result.get(undefined)[0] contains results from query2
  // result.get(undefined)[1] contains results from query3
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
  // result.get(query5.name) contains results from query5
});
```