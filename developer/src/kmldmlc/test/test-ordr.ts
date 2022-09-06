import 'mocha';
import { assert } from 'chai';
import { OrdrCompiler } from '../src/keyman/compiler/ordr';
import { CompilerCallbacks, loadSectionFixture } from './helpers';
import { Ordr } from '../src/keyman/kmx/kmx-plus';
//import { CompilerMessages } from './keyman/compiler/messages';

describe('ordr', function () {
  this.slow(500); // 0.5 sec -- json schema validation takes a while

  it('should compile minimal ordr data', function() {
    const callbacks = new CompilerCallbacks();
    let ordr = loadSectionFixture(OrdrCompiler, 'sections/ordr/minimal.xml', callbacks) as Ordr;
    assert.lengthOf(callbacks.messages, 0);

    assert.lengthOf(ordr.items, 1);
    assert.lengthOf(ordr.items[0].elements, 4);
    assert.strictEqual(ordr.items[0].elements[0].value, "ខ");
    assert.strictEqual(ordr.items[0].elements[1].value, "ែ");
    assert.strictEqual(ordr.items[0].elements[2].value, "្");
    assert.strictEqual(ordr.items[0].elements[3].value, "ម");
    assert.strictEqual(ordr.items[0].elements[0].order, 1);
    assert.strictEqual(ordr.items[0].elements[1].order, 3);
    assert.strictEqual(ordr.items[0].elements[2].order, 4);
    assert.strictEqual(ordr.items[0].elements[3].order, 2);
    assert.isEmpty(ordr.items[0].before);
  });
});

