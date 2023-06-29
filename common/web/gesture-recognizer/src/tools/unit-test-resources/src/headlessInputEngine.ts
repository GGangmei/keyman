import {
  InputEngineBase,
  JSONTrackedPoint,
  TrackedPoint
} from '@keymanapp/gesture-recognizer';

import { RecordedCoordSequenceSet } from './inputRecording.js';
import { timedPromise } from './timedPromise.js';

export class HeadlessInputEngine<Type = any> extends InputEngineBase<Type> {
  private PATH_ID_SEED = 1;

  // Should generally keep a smiple, parameterless default constructor.
  constructor() {
    super();
  }

  public preparePathPlayback(recordedPoint: JSONTrackedPoint) {
    const originalSamples = recordedPoint.path.coords;
    const sampleCount = originalSamples.length;

    const headSample = originalSamples[0];
    const tailSamples = originalSamples.slice(1);

    const pathID = this.PATH_ID_SEED++;
    let replayPoint = new TrackedPoint<Type>(pathID, recordedPoint.isFromTouch);
    replayPoint.update(headSample); // is included before the point is made available.

    // Build promises designed to reproduce the events at the correct times.
    let samplePromises: Promise<void>[] = [
      timedPromise(() => {
        this.emit('pointstart', replayPoint);
      }, headSample.t)
    ];

    samplePromises = samplePromises.concat(tailSamples.map((sample) => {
      return timedPromise(() => {
        replayPoint.update(sample);
      }, sample.t);
    }));

    const endTime = originalSamples[sampleCount-1].t;

    const endPromise = timedPromise(() => {
      replayPoint.path.terminate(recordedPoint.path.wasCancelled);
    }, endTime);

    // Wrap it all together with a nice little bow.
    const compositePromise = Promise.all([endPromise].concat(samplePromises)).catch((reason) => {
      // Because we use a `setInterval` internally, we need cleanup if things go wrong.
      replayPoint.path.terminate(true);
      throw reason;
    });

    return compositePromise;
  }

  async playbackRecording(recordedObj: RecordedCoordSequenceSet) {
    const inputPromises = recordedObj.inputs.map((recordedInput) => {
      const pointPromises = recordedInput.touchpoints.map((recordedPoint) => {
        return this.preparePathPlayback(recordedPoint);
      });

      return Promise.all(pointPromises);
    });

    await Promise.all(inputPromises);
  }
}