// IMPORTS
// ================================================================================================
import * as pg from 'pg';
import { Query, ResultQuery, isResultQuery } from './Query';

// CLASS DEFINITION
// ================================================================================================
export class Collector {
	
	private results		: Map<string, any>;
	private singleResult: boolean;

	constructor(queries: Query[]) {
		this.results = new Map<string,any>();
		this.singleResult = true;
		
		for (let query of queries) {
			if (isResultQuery(query)) {
				if (this.results.has(query.name)) {
					if (this.results.get(query.name) === undefined) {
						this.results.set(query.name, []);
						this.singleResult = false;
					}
				}
				else {
					this.results.set(query.name);
				}
			}
		}
	}
	
	addResult(query: Query, result: any[]) {
    	if (result == undefined || this.results.has(query.name) === false) return;

		if (isResultQuery(query)) {
			if (query.mask === 'single') {
				result = result ? result[0] : undefined;
				if (result == undefined) return undefined;
            }
			
			const queryResults = this.results.get(query.name); 
			if (queryResults) {
				queryResults.push(result);
			}
			else {
				this.results.set(query.name, result);
			}
		}
	}
	
	getResults(): any {
		if (this.results.size === 0) {
			return undefined;
		}
		else if (this.results.size === 1 && this.singleResult) {
			return this.results.values().next().value;
		}
		else {
			return this.results;
		}
	}
}