import 'mocha';
import sinon from 'sinon';
import chai, { assert } from 'chai';
import sinonChai from 'sinon-chai';
import { Compiler } from '../src/main.js';
import { KMCMP_ERROR_HAS_STRINGS, KMCMP_ERROR_SYNTAX_ERR, KMCMP_ERROR_UNSUPPORTED_PROPERTY, KMCMP_FATAL_OUT_OF_RANGE, UnicodeSetError } from '../src/compiler/compiler.js';
chai.use(sinonChai);

describe('Compiler class', function() {
  let consoleLog: any;

  beforeEach(function() {
    consoleLog = sinon.spy(console, 'log');
  });

  afterEach(function() {
    consoleLog.restore();
  });

  it('should start', async function() {
    const compiler = new Compiler();
    assert(await compiler.init());
  });

  it('should compile a basic uset', async function() {
    const compiler = new Compiler();
    // const callbacks = new TestCompilerCallbacks();
    assert(await compiler.init());

    const pat = "[abc]";
    const set = await compiler.parseUnicodeSet(pat, 23);

    assert(set.length === 1);
    assert(set.ranges[0][0] === 'a'.charCodeAt(0));
    assert(set.ranges[0][1] === 'c'.charCodeAt(0));
  });
  it('should compile a more complex uset', async function() {
    const compiler = new Compiler();
    assert(await compiler.init());

    const pat = "[[🙀A-C]-[CB]]";
    const set = await compiler.parseUnicodeSet(pat, 23);

    assert.equal(set.length, 2);
    assert.equal(set.ranges[0][0], 'A'.charCodeAt(0));
    assert.equal(set.ranges[0][1], 'A'.charCodeAt(0));
    assert.equal(set.ranges[1][0], 0x1F640);
    assert.equal(set.ranges[1][1], 0x1F640);
  });
  it('should fail in various ways', async function() {
    const compiler = new Compiler();
    assert(await compiler.init());
    // map from string to failing error
    const failures = {
      '[:Adlm:]': KMCMP_ERROR_UNSUPPORTED_PROPERTY, // what it saye
      '[acegik]': KMCMP_FATAL_OUT_OF_RANGE, // 6 ranges, allocated 1
      '[[\\p{Mn}]&[A-Z]]': KMCMP_ERROR_UNSUPPORTED_PROPERTY,
      '[abc{def}]': KMCMP_ERROR_HAS_STRINGS,
      '[[]': KMCMP_ERROR_SYNTAX_ERR,
    };
    for(const [pat, rc] of Object.entries(failures)) {
      try {
        await compiler.parseUnicodeSet(pat, 1);
      } catch (e) {
        assert(e instanceof UnicodeSetError);
        assert.equal(e.code, rc);
      }
    }
  });
});
