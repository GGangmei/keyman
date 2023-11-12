import { CumulativePathStats } from "../../cumulativePathStats.js";
import { GestureSource, GestureSourceSubview } from "../../gestureSource.js";
import { ContactModel } from "../specs/contactModel.js";
import { ManagedPromise, TimeoutPromise } from "@keymanapp/web-utils";

export type FulfillmentCause = 'path' | 'timer' | 'item' | 'cancelled';

export interface PathMatchResolution {
  type: 'resolve',
  cause: FulfillmentCause
}

export interface PathMatchRejection {
  type: 'reject'
  cause: FulfillmentCause
}

export interface PathNotFulfilled {
  type: 'continue'
}

type PathMatchResult = PathMatchRejection | PathMatchResolution;
type PathUpdateResult = PathMatchResult | PathNotFulfilled;

export class PathMatcher<Type, StateToken = any> {
  private timerPromise?: TimeoutPromise;
  public readonly model: ContactModel<Type, StateToken>;

  // During execution, source.path is fine... but once this matcher's role is done,
  // `source` will continue to receive edits and may even change the instance
  // underlying the `path` field.
  public readonly source: GestureSource<Type>;

  private readonly publishedPromise: ManagedPromise<PathMatchResult>
  private _result: PathMatchResult;

  public get promise() {
    return this.publishedPromise.corePromise;
  }

  constructor(model: ContactModel<Type, StateToken>, source: GestureSource<Type>) {
    /* c8 ignore next 3 */
    if(!model || !source) {
      throw new Error("A gesture-path source and contact-path model must be specified.");
    }

    this.model = model;
    this.publishedPromise = new ManagedPromise<PathMatchResult>();
    this.source = source;

    if(model.timer) {
      this.timerPromise = new TimeoutPromise(model.timer.duration);

      this.publishedPromise.then(() => {
        this.timerPromise.resolve(false);
        // but make sure that simultaneous path resolution continues even if the timer's is mismatched.
      });

      this.timerPromise.then((result) => {
        const trueSource = source instanceof GestureSourceSubview ? source.baseSource : source;
        const timestamp = performance.now();

        /* It's entirely possible that this will be triggered at a timestamp unaligned with the
         * standard timing for input sampling.  It's best to ensure that the reported path
         * duration (on path.stats) satisfies the timer threshold, so we add an artificial
         * sample here that will enforce that desire.
         */
        if(!trueSource.isPathComplete && trueSource.currentSample.t != timestamp) {
          trueSource.path.extend({
            ...trueSource.currentSample,
            t: timestamp
          });
        }
        this.finalize(result == model.timer.expectedResult, 'timer');
      });
    }
  }

  private finalize(result: boolean, cause: FulfillmentCause): PathMatchResult {
    if(this.publishedPromise.isFulfilled) {
      return this._result;
    }

    const model = this.model;
    let retVal: PathMatchResult;
    if(result) {
      retVal = {
        type: model.pathResolutionAction,
        cause: cause
      };
    } else {
      retVal = {
        type: 'reject',
        cause: cause
      };
    }
    this.publishedPromise.resolve(retVal)
    this._result = retVal;

    return retVal;
  }

  get stats() {
    return this.source.path.stats;
  }

  get baseItem() {
    return this.source.baseItem;
  }

  get lastItem() {
    return this.source.currentSample.item;
  }

  update(): PathUpdateResult {
    const model = this.model;
    const source = this.source;

    if(source.path.wasCancelled) {
      return this.finalize(false, 'path');
    }

    // For certain unit-test setups, we may have a zero-length path when this is called during test init.
    // It's best to have that path-coord-length check in place, just in case.
    if(model.itemChangeAction && source.path.coords.length > 0 && source.currentSample.item != source.baseItem) {
      const result = model.itemChangeAction == 'resolve';

      return this.finalize(result, 'item');
    } else {
      // Note:  is current path, not 'full path'.
      const result = model.pathModel.evaluate(source.path) || 'continue';

      if(result != 'continue') {
        return this.finalize(result == 'resolve', 'path');
      } else if(source.path.isComplete) {
        // If the PathModel said to 'continue' but the path is done, we default
        // to rejecting the model; there will be no more changes, after all.
        return this.finalize(false, 'path');
      }

      return {
        type: 'continue'
      };
    }
  }
}