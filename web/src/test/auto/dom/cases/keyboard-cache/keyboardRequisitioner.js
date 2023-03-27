const assert = chai.assert;
import sinon from '/node_modules/sinon/pkg/sinon-esm.js';

import { KeyboardHarness, MinimalKeymanGlobal } from '/@keymanapp/keyboard-processor/build/lib/index.mjs';
import { DOMKeyboardLoader } from '/@keymanapp/keyboard-processor/build/lib/dom-keyboard-loader.mjs';
import { PathConfiguration } from '/@keymanapp/keyman/build/engine/paths/lib/index.mjs';
import { KeyboardRequisitioner } from '/@keymanapp/keyman/build/engine/keyboard-cache/lib/index.mjs';
import DOMCloudRequester from '/@keymanapp/keyman/build/engine/keyboard-cache/lib/dom-cloud-requester.mjs';

const pathConfig = new PathConfiguration({
  root: '',
  resources: '/@keymanapp/keyman/src/resources',
  keyboards: '/', // The Karma config places them under `/resources/keyboards`, as expected by their 'stubs'.
  fonts: '',
  // The primary / top-level module here is the keyboard-cache bundle.
  // So, we set up our path config based upon that module for verification purposes.
}, 'http://localhost:9876/@keymanapp/keyman/build/engine/keyboard-cache/lib'); // TODO:  set up the current path like actual KMW does it.

/**
 * Performs mocking setup to facilitate unit testing for the `CloudQueryEngine` class.
 *
 * @param {*} queryResultsFile An absolute local filepath to a file containing the mocked results to generate.
 * @returns A fully-mocked `CloudQueryEngine` whose `.fetchCloudStubs()` call will yield a Promise for the
 *          expected mocked results.
 */
function mockQuery(querier, queryResultsFile) {
  const mockedRequester = querier.requestEngine;        // Would attempt to https-request.
  const mockingRequester = new DOMCloudRequester(true); // Used to replace that with a local request.

  // Promises are tracked via their queryId, which is generated by the requester.
  // We need to apply it before allowing the actual registration method to execute.
  const idInjector = {
    registerFromCloud: (x) => {
      x.timerid = idInjector.injectionId;

      querier.registerFromCloud(x);
    }
  }

  /*
   * Serves two purposes:
   *
   * 1. Captures the queryID generated by the https-based requester (being mocked) for application
   *    as seen above.
   * 2. Forwards the local-request (mocked) query's Promise as if it were produced by the https-based requester.
   */
  mockedRequester.request = sinon.fake(() => {
    let retObj = mockingRequester.request(queryResultsFile);

    // We need to capture + inject that timerId into the returned results!
    idInjector.injectionId = retObj.queryId;
    return retObj;
  });

  // Install the queryId-injection register as the global registration point for returned queries.
  window.keyman = {
    register: idInjector.registerFromCloud
  };
}

describe("KeyboardRequisitioner", function () {
  it('queries for remote stubs and loads their keyboards', async () => {
    const keyboardLoader = new DOMKeyboardLoader(new KeyboardHarness(window, MinimalKeymanGlobal));
    const keyboardRequisitioner = new KeyboardRequisitioner(keyboardLoader, new DOMCloudRequester(true), pathConfig);
    const cache = keyboardRequisitioner.cache;

    // Note:  the query fixture is hand-edited from the original version obtained at
    // https://api.keyman.com/cloud/4.0/keyboards?jsonp=keyman.register&languageidtype=bcp47&version=17.0&keyboardid=khmer_angkor&timerid=49.
    //
    // The edits are minimal and notated within the fixture file.
    mockQuery(keyboardRequisitioner.cloudQueryEngine, `base/web/src/test/auto/resources/query-mock-results/khmer_angkor.hand-edited.js.fixture`);
    const [stub] = await keyboardRequisitioner.addKeyboardArray(['khmer_angkor']);
    assert.strictEqual(cache.getStub(stub.KI, stub.KLC), stub);

    const kbd_promise = cache.fetchKeyboard('khmer_angkor');
    const khmer_angkor = await kbd_promise;

    // Step 3: verify successful load & caching.
    assert.strictEqual(cache.getKeyboardForStub(stub), khmer_angkor);
    assert.isOk(khmer_angkor);
  });

  it('loads keyboards for page-local, API-added stubs', async () => {
    const keyboardLoader = new DOMKeyboardLoader(new KeyboardHarness(window, MinimalKeymanGlobal));
    const keyboardRequisitioner = new KeyboardRequisitioner(keyboardLoader, new DOMCloudRequester(true), pathConfig);
    const cache = keyboardRequisitioner.cache;

    // Expects the keyboard at resources/keyboards/khmer_angkor.js; this should resolve to
    // http://localhost:9876/resources/keyboards/khmer_angkor.js.
    const stubJSON = fixture.load("/keyboards/khmer_angkor.json", true);

    // The `pathConfig` setup + internal logic should ensure that the filepath points to the correct location
    // with no additional effort required here.
    const [stub] = await keyboardRequisitioner.addKeyboardArray([stubJSON]);
    assert.strictEqual(cache.getStub(stub.KI, stub.KLC), stub);

    const kbd_promise = cache.fetchKeyboard('khmer_angkor');
    const khmer_angkor = await kbd_promise;

    // Step 3: verify successful load & caching.
    assert.strictEqual(cache.getKeyboardForStub(stub), khmer_angkor);
    assert.isOk(khmer_angkor);
  });
});