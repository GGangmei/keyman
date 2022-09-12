class TransformUtils {
  static isWhitespace(transform: Transform): boolean {
    // Matches prefixed text + any instance of a character with Unicode general property Z* or the following: CR, LF, and Tab.
    const whitespaceRemover = /^[\u0009\u000A\u000D\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u200b\u2028\u2029\u202f\u205f\u3000]+$/i;

    // Filter out null-inserts; their high probability can cause issues.
    if(transform.insert == '') {
      return false;
    }

    return transform.insert.match(whitespaceRemover) != null;
  }

  static isBackspace(transform: Transform): boolean {
    return transform.insert == "" && transform.deleteLeft > 0 && !transform.deleteRight;
  }

  static isEmpty(transform: Transform): boolean {
    return transform.insert == '' && transform.deleteLeft == 0 && !transform.deleteRight;
  }
}