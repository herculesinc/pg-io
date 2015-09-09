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

## API

### pg-io
pg-io exposes a single function at the root level which can be used to obtain a reference to a database object:

```JavaScript
function db(/* settings */) : Database;
```
Where settings object should have teh following structure:
```
{
    host        : string;
    port?       : number;
    user        : string;
    password    : string;
    database    : string;
    poolSize?   : number;
}
```
The returned Database object can be used further to establish a connection to the database. Creation of the databse object does not establish a database connection but rather allocates a pool to hold connections to the database specified by the settings.

Calling `db()` method multiple times with the same settings will return the same Database object. However, if different settings are supplied, different connection pools will be created.

### Database
Once a referecne to a Database object is obtained, it can be used to establish a connection session using the following method:

```JavaScript
database.connect() : Promise<Connection>;
```
The connect method returnes apromise with a promise for Connection object which reprsents a client session.

Additionally database object exposes a method for checking connection pool state:

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