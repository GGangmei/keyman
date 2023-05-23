/**
 * Keyman is copyright (C) SIL International. MIT License.
 * 
 * KMContext.m
 * Keyman
 * 
 * Created by Shawn Schantz on 2023-05-11.
 * 
 * Tracks the state of the context in the client application to the best of our ability.
 * Needed for storing and managing marker actions returned from Keyman Core.
 * Also useful for applications that do not tell us about their context with the APIs
 * selectedRange and attributedSubstringFromRange
 */

#import "KMContext.h"
#include <Carbon/Carbon.h> /* For kVK_ constants. */

NSUInteger const MAXIMUM_CONTEXT_LENGTH = 80;         // KM_KBP_IT_CHAR

@interface KMContext()

@property (readonly) NSMutableString *context;

@end

@implementation KMContext

-(instancetype)init {
  self = [super init];
  if (self) {
    _context = [[NSMutableString alloc] initWithCapacity:MAXIMUM_CONTEXT_LENGTH];
  }
  return self;
}

-(instancetype)initWithString:(NSString*)initialContext {
  self = [self init];
  if (self) {
    NSString *maximumContext = nil;
    
    // copy up to MAXIMUM_CONTEXT_LENGTH from the end of the context
    NSUInteger initialLength = [initialContext length];
    if (initialLength > MAXIMUM_CONTEXT_LENGTH) {
      maximumContext = [initialContext substringFromIndex:initialLength-MAXIMUM_CONTEXT_LENGTH];
    } else {
      maximumContext = initialContext;
    }

    [_context setString:maximumContext];
  }
  return self;
}

-(NSString*)currentContext {
  return (NSString*)_context;
}

-(BOOL)isEmpty {
  return _context.length == 0;
}

// TODO: synch with Keyman Core context, don't just set this on its own
-(void)clearContext {
  _context.string = @"";
}

-(void)appendMarker {
  #define UC_NONCHARACTER             0xFFFF
  NSString *markerString = [NSString stringWithFormat:@"%C", UC_NONCHARACTER];
  [self.context appendString:markerString];
}

/**
 * Deletes the last complete code point in the context string, if it is not empty.
 * NSString is UTF-16, so one code point could be composed of multiple code units.
 * Checks for the size of the final code point to see how much needs to be deleted.
 */
-(void)deleteLastCodePoint {
  NSUInteger contextLength = self.context.length;
  
  if (contextLength > 0) {
    NSUInteger characterIndex = contextLength-1;
    NSRange characterRange = [self.context rangeOfComposedCharacterSequenceAtIndex:characterIndex];
    NSLog(@"KMContext deleteLastUnicodeCharacter, index = %lu, rangeOfLastCharacter = %@\n", characterIndex, NSStringFromRange(characterRange));
    [self.context deleteCharactersInRange:characterRange];
  }
}

-(void)replaceSubstring:(NSString*)newText count:(int)count {
  // loop through the string and replace one a time to account for characters of different width
  if (count > 0) {
    int i;
    for (i = 0; i < count; i++) {
      [self deleteLastCodePoint];
    }
  }
  if (newText.length > 0) {
    [self addSubtring:newText];
  }
}

-(void)addSubtring:(NSString*)string {
  [self.context appendString:string];
}

-(void)applyAction:(CoreAction*)action keyDownEvent:(nonnull NSEvent *)event {
  NSLog(@"CachedContext applyAction: %@", action.description);

  switch(action.actionType) {
    case MarkerAction:
      [self appendMarker];
      break;
    case CharacterAction:
      [self addSubtring:action.content];
      break;
    case CharacterBackspaceAction:
      [self deleteLastCodePoint];
      break;
    case MarkerBackspaceAction:
      [self deleteLastCodePoint];
      break;
    case EmitKeystrokeAction:
      [self applyUnhandledEvent:event];
      break;
    case InvalidateContextAction:
      [self clearContext];
      break;
    default:
      NSLog(@"CachedContext applyAction, action not applied to context %@\n", action.typeName.description);
      break;
  }
}

// TODO: see handleDefaultKeymanEngineActions
-(void)applyUnhandledEvent:(nonnull NSEvent *)event {
  unsigned short keyCode = event.keyCode;
  switch (keyCode) {
    case kVK_Delete:
      NSLog(@"***SGS applyUnhandledEvent kVK_Delete");
      [self deleteLastCodePoint];
      //[self processUnhandledDeleteBack: sender updateEngineContext: &updateEngineContext];
      break;
    case kVK_LeftArrow:
        // new detect location within context?
    case kVK_RightArrow:
    case kVK_UpArrow:
    case kVK_DownArrow:
    case kVK_Home:
    case kVK_End:
    case kVK_PageUp:
    case kVK_PageDown:
    {
      [self clearContext];
      break;
    }
    case kVK_Return:
    case kVK_ANSI_KeypadEnter:
      NSLog(@"***SGS applyUnhandledEvent kVK_Return");
      [self addSubtring:@"\n"];
      break;
    default:
      {
        // NOTE: Although ch is usually the same as keyCode, when the option key is depressed (and
        // perhaps in some other cases) it may not be (keyCode can be 0). Likewise, the option key
        // can generate more than one character in event.characters.
        unichar ch = [event.characters characterAtIndex:0];
        if (keyCode < 0x33 || (ch >= 0x2A && ch <= 0x39)) { // Main keys, Numpad char range, normal punctuation
          [self addSubtring:event.characters];
        }
        else {
            // Other keys
        }
      }
        break;
    }
}

@end
