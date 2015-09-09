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
