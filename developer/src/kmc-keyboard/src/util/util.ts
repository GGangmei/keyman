
/**
 * Verifies that value is an item in the enumeration.
 */
export function isValidEnumValue<T extends {[key: number]: string | number}>(enu: T, value: string) {
  return (Object.values(enu) as string[]).includes(value);
}

/**
 * xml2js will not place single-entry objects into arrays. Easiest way to fix
 * this is to box them ourselves as needed. Ensures that o.x is an array.
 *
 * @param o Object with property to box
 * @param x Name of element to box
 */
export function boxXmlArray(o: any, x: string): void {
  if(typeof o == 'object' && !Array.isArray(o[x])) {
    if(o[x] === null || o[x] === undefined) {
      o[x] = [];
    }
    else {
      o[x] = [o[x]];
    }
  }
}
