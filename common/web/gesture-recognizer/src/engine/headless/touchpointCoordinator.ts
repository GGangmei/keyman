import EventEmitter from "eventemitter3";
import { InputEngineBase } from "./inputEngineBase.js";
import { GestureSource, GestureSourceSubview } from "./gestureSource.js";
import { MatcherSelector } from "./gestures/matchers/matcherSelector.js";
import { GestureSequence } from "./gestures/matchers/gestureSequence.js";
import { GestureModelDefs, getGestureModelSet } from "./gestures/specs/gestureModelDefs.js";

interface EventMap<HoveredItemType> {
  /**
   * Indicates that a new potential gesture has begun.
   * @param input
   * @returns
   */
  'inputstart': (input: GestureSource<HoveredItemType>) => void;

  'recognizedgesture': (sequence: GestureSequence<HoveredItemType>) => void;
}

/**
 * This class is responsible for interpreting the output of the various input-engine types
 * and facilitating the detection of related gestures.  Its role is to serve as a headless
 * version of the main `GestureRecognizer` class, avoiding its DOM and DOM-event dependencies.
 *
 * Of particular note: when a gesture involves multiple touchpoints - like a multitap - this class
 * is responsible for linking related touchpoints together for the detection of that gesture.
 */
export class TouchpointCoordinator<HoveredItemType> extends EventEmitter<EventMap<HoveredItemType>> {
  private inputEngines: InputEngineBase<HoveredItemType>[];
  private selectorStack: MatcherSelector<HoveredItemType>[] = [new MatcherSelector()];

  private gestureModelDefinitions: GestureModelDefs<HoveredItemType>;

  private _activeSources: GestureSource<HoveredItemType>[] = [];
  private _activeGestures: GestureSequence<HoveredItemType>[] = [];

  public constructor(gestureModelDefinitions: GestureModelDefs<HoveredItemType>, inputEngines?: InputEngineBase<HoveredItemType>[]) {
    super();

    this.gestureModelDefinitions = gestureModelDefinitions;
    this.inputEngines = [];
    if(inputEngines) {
      for(let engine of inputEngines) {
        this.addEngine(engine);
      }
    }
  }

  public pushSelector(selector: MatcherSelector<HoveredItemType>) {
    this.selectorStack.push(selector);
  }

  public popSelector(selector: MatcherSelector<HoveredItemType>) {
    if(this.selectorStack.length <= 1) {
      throw new Error("May not pop the original, base gesture selector.");
    }

    const index = this.selectorStack.indexOf(selector);
    if(index == -1) {
      throw new Error("This selector has not been pushed onto the 'setChange' stack.");
    }

    selector.cascadeTermination();

    this.selectorStack.splice(index, 1);
  }

  public get currentSelector() {
    return this.selectorStack[this.selectorStack.length-1];
  }

  protected addEngine(engine: InputEngineBase<HoveredItemType>) {
    engine.on('pointstart', this.onNewTrackedPath);
    this.inputEngines.push(engine);
  }

  private readonly onNewTrackedPath = (touchpoint: GestureSource<HoveredItemType>) => {
    this.addSimpleSourceHooks(touchpoint);
    const modelDefs = this.gestureModelDefinitions;
    const selector = this.currentSelector;

    const firstSelectionPromise = selector.matchGesture(touchpoint, getGestureModelSet(modelDefs, selector.baseGestureSetId));
    firstSelectionPromise.then((selection) => {
      if(selection.result.matched == false) {
        return;
      }

      // For multitouch gestures, only report the gesture **once**.
      const sourceIDs = selection.matcher.allSourceIds;
      for(let sequence of this._activeGestures) {
        if(!!sequence.allSourceIds.find((id1) => !!sourceIDs.find((id2) => id1 == id2))) {
          // We've already established (and thus, already reported) a GestureSequence for this selection.
          return;
        }
      }

      const gestureSequence = new GestureSequence(selection, modelDefs, this.currentSelector, this);
      this._activeGestures.push(gestureSequence);
      gestureSequence.on('complete', () => {
        // When the GestureSequence is fully complete and all related `firstSelectionPromise`s have
        // had the chance to resolve, drop the reference; prevent memory leakage.
        const index = this._activeGestures.indexOf(gestureSequence);
        if(index != -1) {
          this._activeGestures.splice(index, 1);
        }
      });

      // Could track sequences easily enough; the question is how to tell when to 'let go'.

      this.emit('recognizedgesture', gestureSequence);

      // Any related 'push' mechanics that may still be lingering are currently handled by GestureSequence
      // during its 'completion' processing.  (See `GestureSequence.selectionHandler`.)
    });

    this.emit('inputstart', touchpoint);
  }

  public get activeGestures(): GestureSequence<HoveredItemType>[] {
    return [].concat(this._activeGestures);
  }

  private addSimpleSourceHooks(touchpoint: GestureSource<HoveredItemType>) {

    touchpoint.path.on('invalidated', () => {
      // GestureSequence _should_ handle any other cleanup internally as fallout
      // from the path being cancelled.

      // To consider: should it specially mark if it 'completed' due to cancellation,
      // or is that safe to infer from the tracked GestureSource(s)?
      // Currently, we're going with the latter.

      // Also mark the touchpoint as no longer active.
      let i = this._activeSources.indexOf(touchpoint);
      this._activeSources = this._activeSources.splice(i, 1);
    });
    touchpoint.path.on('complete', () => {
      // TODO: on cancellation, is there any other cleanup to be done?

      // Also mark the touchpoint as no longer active.
      let i = this._activeSources.indexOf(touchpoint);
      this._activeSources = this._activeSources.splice(i, 1);
    });
  }
}