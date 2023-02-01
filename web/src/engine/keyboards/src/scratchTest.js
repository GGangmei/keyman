import CloudNodeRequester from '../../../../build/engine/keyboards/obj/cloudNodeRequester.js';
import CloudQueryEngine from '../../../../build/engine/keyboards/obj/cloudQueryEngine.js';

let requester = new CloudNodeRequester();
let queryEngine = new CloudQueryEngine(requester);

requester.link(queryEngine);

// We may now query.

let promise = queryEngine.fetchCloudStubs(["sil_euro_latin@fr"]);
let ret = await promise;

console.log(ret);