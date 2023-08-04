import {
  InputEngineBase,
  SerializedGestureSource,
  GestureSource
} from '@keymanapp/gesture-recognizer';

import { RecordedCoordSequenceSet } from './inputRecording.js';
import { timedPromise } from '@keymanapp/web-utils';

export class HeadlessInputEngine<Type = any> extends InputEngineBase<Type> {
  private PATH_ID_SEED = 1;

  // Should generally keep a simple, parameterless default constructor.
  constructor() {
    super();
  }

  public preparePathPlayback(recordedPoint: SerializedGestureSource) {
    const originalSamples = recordedPoint.path.coords;
    const sampleCount = originalSamples.length;

    const headSample = originalSamples[0];
    const tailSamples = originalSamples.slice(1);

    const pathID = this.PATH_ID_SEED++;
    let replayPoint = new GestureSource<Type>(pathID, recordedPoint.isFromTouch);
    replayPoint.update(headSample); // is included before the point is made available.

    // Build promises designed to reproduce the events at the correct times.
    let samplePromises: Promise<void>[] = [
      timedPromise(headSample.t).then(() => {
        this.emit('pointstart', replayPoint);
      })
    ];

    samplePromises = samplePromises.concat(tailSamples.map((sample) => {
      return timedPromise(sample.t).then(() => {
        replayPoint.update(sample);
      });
    }));

    const endTime = originalSamples[sampleCount-1].t;

    const endPromise = timedPromise(endTime).then(() => {
      replayPoint.terminate(recordedPoint.path.wasCancelled);
    });

    // Wrap it all together with a nice little bow.
    const compositePromise = Promise.all([endPromise].concat(samplePromises)).catch((reason) => {
      // Because we use a `setInterval` internally, we need cleanup if things go wrong.
      replayPoint.terminate(true);
      throw reason;
    });

    return compositePromise;
  }

  async playbackRecording(recordedObj: RecordedCoordSequenceSet) {
    const inputPromises = recordedObj.inputs.map((recordedInput) => {
      return this.preparePathPlayback(recordedInput);
    });

    await Promise.all(inputPromises);
  }
}