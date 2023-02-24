import type Activator from "../views/activator.js";
import CommonConfiguration from "./commonConfiguration.js";

export default interface Configuration extends CommonConfiguration {
  /**
   * If set, the value returned by the function set here will be used instead of any automatic
   * width detection functionality.
   */
  widthOverride?: () => number,

  /**
   * If set, the value returned by the function set here will be used instead of any automatic
   * height detection functionality.
   */
  heightOverride?: () => number,

  /**
   * Sets the default activation model to use for the on-screen keyboard.  If not set, this
   * will default to "two-state" activation for the "anchored" and "floating" view styles
   * (conditioned on an HTMLElement instance) while using "simple" (one-state) activation
   * for the "inlined" style.
   */
  activator?: Activator<any>;

  /**
   * If set to `false`, hide animations will be disallowed.  Defaults to `true`.
   */
  allowHideAnimations?: boolean;
}