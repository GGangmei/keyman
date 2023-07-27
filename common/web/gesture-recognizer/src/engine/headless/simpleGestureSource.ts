import { InputSample } from "./inputSample.js";
import { SerializedGesturePath, GesturePath } from "./gesturePath.js";

/**
 * Documents the expected typing of serialized versions of the `SimpleGestureSource` class.
 */
export type SerializedSimpleGestureSource<HoveredItemType = any> = {
  isFromTouch: boolean;
  path: SerializedGesturePath<HoveredItemType>;
  // identifier is not included b/c it's only needed during live processing.
}

/**
 * Represents all metadata needed internally for tracking a single "touch contact point" / "touchpoint"
 * involved in a potential / recognized gesture as tracked over time.
 *
 * Each instance corresponds to one unique contact point as recognized by `Touch.identifier` or to
 * one 'cursor-point' as represented by mouse-based motion.
 *
 * Refer to https://developer.mozilla.org/en-US/docs/Web/API/Touch and
 * https://developer.mozilla.org/en-US/docs/Web/API/Navigator/maxTouchPoints re "touch contact point".
 *
 * May be one-to-many with recognized gestures:  a keyboard longpress interaction generally only has one
 * contact point but will have multiple realized gestures / components:
 * - longpress:  Enough time has elapsed
 * - subkey:  Subkey from the longpress subkey menu has been selected.
 *
 * Thus, it is a "gesture source".  This is the level needed to model a single contact point, while some
 * gestures expect multiple, hence "simple".
 *
 */
export class SimpleGestureSource<HoveredItemType> {
  /**
   * Indicates whether or not this tracked point's original source is a DOM `Touch`.
   */
  public readonly isFromTouch: boolean;

  /**
   * The numeric form of this point's identifier as seen in events (or as emulated for mouse events)
   */
  public readonly rawIdentifier: number;

  // A full, uninterrupted recording of all samples observed during the lifetime of the touchpoint.
  protected _path: GesturePath<HoveredItemType>;

  protected _baseItem: HoveredItemType;

  private static _jsonIdSeed: -1;

  /**
   * Tracks the coordinates and timestamps of each update for the lifetime of this `SimpleGestureSource`.
   */
  public get path(): GesturePath<HoveredItemType> {
    return this._path;
  }

  /**
   * Constructs a new SimpleGestureSource instance for tracking updates to an active input point over time.
   * @param identifier     The system identifier for the input point's events.
   * @param initialHoveredItem  The initiating event's original target element
   * @param isFromTouch    `true` if sourced from a `TouchEvent`; `false` otherwise.
   */
  constructor(identifier: number, isFromTouch: boolean) {
    this.rawIdentifier = identifier;
    this.isFromTouch = isFromTouch;
    this._path = new GesturePath();
  }

  /**
   * Deserializes a SimpleGestureSource instance from its serialized-JSON form.
   * @param jsonObj  The JSON representation to deserialize.
   * @param identifier The unique identifier to assign to this instance.
   */
  public static deserialize(jsonObj: SerializedSimpleGestureSource, identifier: number) {
    const id = identifier !== undefined ? identifier : this._jsonIdSeed++;
    const isFromTouch = jsonObj.isFromTouch;
    const path = GesturePath.deserialize(jsonObj.path);

    const instance = new SimpleGestureSource(id, isFromTouch);
    instance._path = path;
    return instance;
  }

  public update(sample: InputSample<HoveredItemType>) {
    this.path.extend(sample);
    this._baseItem ||= sample.item;
  }

  /**
   * The first path sample (coordinate) under consideration for this `SimpleGestureSource`.
   */
  public get baseItem(): HoveredItemType {
    return this._baseItem;
  }

  /**
   * The most recent path sample (coordinate) under consideration for this `SimpleGestureSource`.
   */
  public get currentSample(): InputSample<HoveredItemType> {
    return this.path.coords[this.path.coords.length-1];
  }

  public constructSubview(startAtEnd: boolean, preserveBaseItem: boolean) {
    return new SimpleGestureSourceSubview(this, startAtEnd, preserveBaseItem);
  }

  public terminate(cancel?: boolean) {
    this.path.terminate(cancel);
  }

  public get isPathComplete(): boolean {
    return this.path.isComplete;
  }

  /**
   * Gets a fully-unique string-based identifier, even for edge cases where both mouse and touch input
   * are received simultaneously.
   */
  public get identifier(): string {
    const prefix = this.isFromTouch ? 'touch' : 'mouse';
    return `${prefix}:${this.rawIdentifier}`;
  }

  /**
   * Creates a serialization-friendly version of this instance for use by
   * `JSON.stringify`.
   */
  toJSON(): SerializedSimpleGestureSource {
    let jsonClone: SerializedSimpleGestureSource = {
      isFromTouch: this.isFromTouch,
      path: this.path.toJSON()
    }

    return jsonClone;
  }
}

export class SimpleGestureSourceSubview<HoveredItemType> extends SimpleGestureSource<HoveredItemType> {
  private _baseSource: SimpleGestureSource<HoveredItemType>
  private subviewDisconnector: () => void;

  /**
   * Constructs a new SimpleGestureSource instance for tracking updates to an active input point over time.
   * @param identifier     The system identifier for the input point's events.
   * @param initialHoveredItem  The initiating event's original target element
   * @param isFromTouch    `true` if sourced from a `TouchEvent`; `false` otherwise.
   */
  constructor(source: SimpleGestureSource<HoveredItemType>, startAtEnd: boolean, preserveBaseItem: boolean) {
    super(source.rawIdentifier, source.isFromTouch);

    const baseSource = this._baseSource = source instanceof SimpleGestureSourceSubview ? source._baseSource : source;

    // Note: we don't particularly need subviews to track the actual coords aside from
    // tracking related stats data.  But... we don't have an "off-switch" for that yet.
    let subpath: GesturePath<HoveredItemType>;

    // Will hold the last sample _even if_ we don't save every coord that comes through.
    const lastSample = source.path.stats.lastSample;

    if(startAtEnd) {
      subpath = new GesturePath<HoveredItemType>();
      if(lastSample) {
        subpath.extend(lastSample);
      }
    } else {
      subpath = source.path.clone();
    }

    this._path = subpath;

    if(preserveBaseItem) {
      this._baseItem = source.baseItem;
    } else {
      this._baseItem = lastSample?.item;
    }

    // Ensure that this 'subview' is updated whenever the "source of truth" is.
    const completeHook    = ()       => this.path.terminate(false);
    const invalidatedHook = ()       => this.path.terminate(true);
    const stepHook        = (sample) => this.update(sample);
    baseSource.path.on('complete',    completeHook);
    baseSource.path.on('invalidated', invalidatedHook);
    baseSource.path.on('step',        stepHook);

    // But make sure we can "disconnect" it later once the gesture being matched
    // with the subview has fully matched; it's good to have a snapshot left over.
    this.subviewDisconnector = () => {
      baseSource.path.off('complete',    completeHook);
      baseSource.path.off('invalidated', invalidatedHook);
      baseSource.path.off('step',        stepHook);
    }
  }

  /**
   * The original SimpleGestureSource this subview is based upon.
   */
  public get baseSource() {
    return this._baseSource;
  }

  public disconnect() {
    if(this.subviewDisconnector) {
      this.subviewDisconnector();
      this.subviewDisconnector = null;
    }
  }

  /**
   * Will also terminate the baseSource.  If the decision has been made to actively
   * terminate the path by a gesture matcher, this is what is actually desired, even
   * if called on a 'subview' of it.
   */
  public terminate(cancel?: boolean) {
    this.baseSource.terminate(cancel);
  }
}