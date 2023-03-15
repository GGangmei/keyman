import { DeviceSpec, ManagedPromise, physicalKeyDeviceAlias, SpacebarText } from "@keymanapp/keyboard-processor";
import { PathConfiguration, PathOptionDefaults, PathOptionSpec } from "keyman/engine/configuration";
import { Device } from "keyman/engine/device-detect";
import { KeyboardStub } from "keyman/engine/keyboard-cache";

export class Configuration {
  readonly hostDevice: DeviceSpec;
  readonly sourcePath: string;
  readonly deferForInitialization: ManagedPromise<void>;

  private _paths: PathConfiguration;
  private _activateFirstKeyboard: boolean;
  private _defaultSpacebarText: SpacebarText;
  private _embeddingApp: string;
  private _stubNamespacer?: (KeyboardStub) => void;

  public applyCacheBusting: boolean = false;

  // sourcePath:  see `var sPath =` in kmwbase.ts.  It is not obtainable headlessly.
  constructor(sourcePath: string, device?: DeviceSpec) {
    if(!device) {
      const deviceDetector = new Device();
      deviceDetector.detect();

      device = deviceDetector.coreSpec;
    }

    this.sourcePath = sourcePath;
    this.hostDevice = device;
    this.deferForInitialization = new ManagedPromise<void>();
  }

  initialize(options: Required<InitOptionSpec>) {
    this._paths = new PathConfiguration(options, this.sourcePath);
    if(typeof options.setActiveOnRegister == 'boolean') {
      this._activateFirstKeyboard = options.setActiveOnRegister;
    } else if (typeof options.setActiveOnRegister == 'string') {
      let str = options.setActiveOnRegister.toLowerCase();
      this._activateFirstKeyboard = str === 'true';
    } else {
      this._activateFirstKeyboard = true;
    }

    this._defaultSpacebarText = options.spacebarText;

    if(options.embeddingApp) {
      this._embeddingApp = options.embeddingApp;
    }

    this.deferForInitialization.resolve();
  }

  get paths() {
    return this._paths;
  }

  get activateFirstKeyboard() {
    return this._activateFirstKeyboard;
  }

  get defaultSpacebarText() {
    return this._defaultSpacebarText;
  }

  get embeddingApp() {
    return this._embeddingApp;
  }

  get softDevice(): DeviceSpec {
    return this.hostDevice;
  }

  get hardDevice(): DeviceSpec {
    return physicalKeyDeviceAlias(this.hostDevice);
  }

  get stubNamespacer() {
    return this._stubNamespacer;
  }

  set stubNamespacer(functor: (stub: KeyboardStub) => void) {
    this._stubNamespacer = functor;
  }
}

export interface InitOptionSpec extends PathOptionSpec {
  /**
   * May be used to denote the name of the embedding application
   */
  embeddingApp?: string | undefined;

  // ui?: string;

  /**
   * If set to true || "true" or if left undefined, the engine will automatically select the first available
   * keyboard for activation.
   *
   * Note that keyboards specified locally are synchronously loaded while cloud keyboards are async; as a
   * result, a locally-specified keyboard will generally be available "sooner", even if added "later".
   */
  setActiveOnRegister?: string | boolean; // TODO: Convert to boolean. Option loader needs to be able to receive this as a string or boolean

  /**
   * Determines the default text shown on the spacebar.  If undefined, uses `LANGUAGE_KEYBOARD`
   */
  spacebarText?: SpacebarText;
}

export const InitOptionDefaults: Required<InitOptionSpec> = {
  embeddingApp: undefined,    // only needed for embedded.
  setActiveOnRegister: true,  // only needed for browser
  spacebarText: SpacebarText.LANGUAGE_KEYBOARD,  // useful in both, for OSK config.
  ...PathOptionDefaults
}