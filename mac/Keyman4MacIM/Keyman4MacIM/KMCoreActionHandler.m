/**
 * Keyman is copyright (C) SIL International. MIT License.
 * 
 * KMCoreActionHandler.m
 * Keyman
 * 
 * Created by Shawn Schantz on 2023-04-21.
 * 
 * Processes an NSArray of CoreAction objects and determines how they should be
 * applied to the client application. Creates a KMActionHandlerResult object to instruct
 * Keyman how to apply the changes to the client to conform to the CoreAction
 * objects.
 *
 * To apply the changes in the correct order in the client application, the
 * pattern in which the actions occur are analyzed and classified with the
 * ActionPattern enum. Some patterns require a different strategy to preserve
 * the order.
 */

#import "KMInputMethodEventHandler.h"
#import "KMCoreActionHandler.h"

@interface KMCoreActionHandler ()

typedef enum {BackspacesOnly,
  CharactersOnly,
  BackspaceBeforeCharacter,
  CharacterBeforeBackspace,
  None
} ClientTextOutputPattern;

@property (readonly) NSArray *actions;
@property (readonly) NSEvent *event;
@property (readonly) id client;
@property (readonly) KMContext *context;
@property (readonly) ClientTextOutputPattern pattern;
@property int backspaceCount;
@property BOOL useEvents;
@property BOOL emitKeystroke;
@end

@implementation KMCoreActionHandler

-(instancetype)initWithActions:(NSArray*)actions context: (KMContext *)context event: (NSEvent *)event client:(id) client  {
  self = [super init];
  if (self) {
    _actions = actions;
    _event = event;
    _client = client;
    _context = context;
    _backspaceCount = 0;
    _emitKeystroke = NO;
  }
  return self;
}

/*
 * Loop through the actions and identify which pattern of which actions of type
 * CharacterAction and CharacterBackspaceAction occur. We use this pattern to
 * determine how to apply changes to the client application.
 */
-(ClientTextOutputPattern)analyzeActions:(NSArray*)actions {
  BOOL containsCharacters = NO;
  BOOL containsBackspaces = NO;
  BOOL backspaceFirst = NO;
  BOOL characterFirst = NO;
  // TODO: track character count?
  // TODO: adjust backspace count for code points with more than one code unit?
  // TODO: backspace event and replacement range must be tested for surrogate pairs
  
  // first, loop through the actions to summarize the contents
  // only looking at characters and backspaces of characters
  for (CoreAction *action in [actions objectEnumerator])
  {
    if (action.isCharacter) {
      containsCharacters = YES;
      if (!containsBackspaces) {
        characterFirst = YES;
      }
    } else if (action.isCharacterBackspace) {
      containsBackspaces = YES;
      self.backspaceCount++;
      if (!containsCharacters) {
        backspaceFirst = YES;
      }
    }
  }

  NSLog(@"***SGS analyzeActions, containsCharacters = %d, containsBackspaces = %d ", containsCharacters,  containsBackspaces);

  ClientTextOutputPattern actionPattern = None;
  // second, asssign an actionPattern type based on what we found
  if (containsCharacters) {
    if (containsBackspaces) {
      // contains both characters and backspaces, now determine order
      if (characterFirst) {
        actionPattern = CharacterBeforeBackspace;
      } else if (backspaceFirst) {
        actionPattern = BackspaceBeforeCharacter;
      }
    } else {
      actionPattern = CharactersOnly;
    }
  } else if (containsBackspaces) {
    actionPattern = BackspacesOnly;
  }

  return actionPattern;
}

-(BOOL)isSinglePassThroughBackspace {
  BOOL isPassThrough =
  (self.event.keyCode == kVK_Delete)
  && (self.pattern == BackspacesOnly)
  && (self.backspaceCount == 1);
  return isPassThrough;
}

/*
 * Returns result object to instruct Input Method how to apply changes to client text.
 */
-(KMActionHandlerResult*)handleActions {
  KMActionHandlerResult *result = nil;
  
  NSLog(@"***SGS handleActions invoked, actions.count = %lu ", (unsigned long)self.actions.count);
  
  // examine the pattern of actions for required text inserted and deleted
  _pattern = [self analyzeActions:self.actions];

  // use the ClientTextOutputPattern to create the result object
  switch (self.pattern) {
    case CharactersOnly:
      result = [self buildResultForCharactersOnly];
      //handledEvent = [self applyCharacterActions:0];
      break;
    // TODO: create separate pattern for single backspace? and for EmitKeystroke action?
    case BackspacesOnly:
      if ([self isSinglePassThroughBackspace]) {
        result = [self buildResultForSinglePassThroughBackspaceNoText];
      } else {
        result = [self buildResultForMultipleBackspacesNoText];
        //handledEvent = [self applyIsolatedBackspaceActions:self.backspaceCount];
      }
      break;
    case BackspaceBeforeCharacter:
      result = [self buildResultForBackspacesBeforeText];
      //handledEvent = [self applyCharacterActions:self.backspaceCount];
      break;
    case None:
      result = [self buildResultForNoCharactersOrBackspaces];
      break;
    default:
      NSLog(@"***SGS Unimplemented pattern***");
  }

  // TODO: delete
  /**
  * this event is passed through and will be sent to the client
  * but we need to update the context for it -- no, actually we don't:
  * the context is updated for every action, and we should still get an action
  * for a backspace, even if the event is unhandled by Core
  * if there is a need for this, it would be while processing the Emit Keystroke action
  */
  /*
  if(!result.handledEvent) {
    [self.context applyUnhandledEvent:self.event];
  }
  */
  
  return result;
}

/**
 * The event is marked as handled and the result includes the new text string to insert in the client
 */
-(KMActionHandlerResult*)buildResultForCharactersOnly {
  NSLog(@"***SGS buildResultForCharactersOnly");
  return [[KMActionHandlerResult alloc] initForActions:self.actions handledEvent:YES backspaceCount:0 textToInsert:[self collectOutputText]];
}

/**
 * Mark the event as NOT handled, we simply let the original backspace event pass through to the client without manipulating the client text
 */
-(KMActionHandlerResult*)buildResultForSinglePassThroughBackspaceNoText {
  NSLog(@"***SGS buildResultForSinglePassThroughBackspaceNoText");
  return [[KMActionHandlerResult alloc] initForActions:self.actions handledEvent:NO backspaceCount:0 textToInsert:@""];
}

/**
 * For multiple backspaces with no text, new events must be generated for each backspace
 */
-(KMActionHandlerResult*)buildResultForMultipleBackspacesNoText {
  NSLog(@"***SGS buildResultForMultipleBackspacesNoText");
  return [[KMActionHandlerResult alloc] initForActions:self.actions handledEvent:YES backspaceCount:self.backspaceCount textToInsert:@""];
}

/**
 * For backspaces needed before text, insert with replace is possible, but some clients do not support replace
 */
-(KMActionHandlerResult*)buildResultForBackspacesBeforeText {
  // TODO: make backspaces events if replacement does not work with insertText
  NSLog(@"***SGS buildResultForBackspacesBeforeText");
  return [[KMActionHandlerResult alloc] initForActions:self.actions handledEvent:YES backspaceCount:self.backspaceCount textToInsert:[self collectOutputText]];
}

/**
 * For case with no actions of type CharacterAction or CharacterBackspaceAction
 */
-(KMActionHandlerResult*)buildResultForNoCharactersOrBackspaces {
  NSLog(@"***SGS buildResultForNoCharactersOrBackspaces");
  
  return [[KMActionHandlerResult alloc] initForActions:self.actions handledEvent:NO backspaceCount:0 textToInsert:@""];
}


-(NSString*)collectOutputText {
  NSMutableString *output = [[NSMutableString alloc]init];
  for (CoreAction *action in [self.actions objectEnumerator]) {
    if (action.actionType==CharacterAction) {
      [output appendString:action.content];
    }
  }
  return output;
}

-(BOOL)applyCharacterActions:(int)replacementCount  {
  NSString *outputText = [self collectOutputText];
  NSRange selectionRange = [self.client selectedRange];
  NSRange contextRange = NSMakeRange(0, selectionRange.location);
  NSAttributedString *context = [self.client attributedSubstringFromRange:contextRange];
  NSLog(@"***SGS applyCharacterActions, replacementCount=%d, selectionRange.location=%lu", replacementCount, selectionRange.location);

  NSRange replacementRange;
  if (replacementCount > 0) {
    replacementRange = NSMakeRange(selectionRange.location-replacementCount, replacementCount);
  } else {
    replacementRange = NSMakeRange(NSNotFound, NSNotFound);
  }
  NSLog(@"***SGS applyCharacterActions, insertText %@ in replacementRange.start=%lu, replacementRange.length=%lu", outputText, (unsigned long)replacementRange.location, (unsigned long)replacementRange.length);
  
  [self.client insertText:outputText replacementRange:replacementRange];
  return YES;
}

-(BOOL)applyInvalidateContextAction:(CoreAction*)action event: (NSEvent *)event client:(id) client  {
  NSLog(@"applyInvalidateContextAction for action %@", action.content);
  return NO;
}

-(BOOL)applyEmitKeystrokeAction:(CoreAction*)action event: (NSEvent *)event client:(id) client  {
  NSLog(@"applyEmitKeystrokeAction for event with keycode: %hu", event.keyCode);
    
  // For other events that the Keyman engine does not have rules, just apply context changes
  // and let client handle the event
  NSString* charactersToAppend = nil;
  BOOL updateEngineContext = YES;
  unsigned short keyCode = event.keyCode;
  switch (keyCode) {
      case kVK_Delete:
          NSLog(@"***SGS applyEmitKeystrokeAction kVK_Return");
          // [self processUnhandledDeleteBack: sender updateEngineContext: &updateEngineContext];
          //[self.keySender sendBackspace:1];
          break;

      case kVK_LeftArrow:
      case kVK_RightArrow:
      case kVK_UpArrow:
      case kVK_DownArrow:
      case kVK_Home:
      case kVK_End:
      case kVK_PageUp:
      case kVK_PageDown:
          //_contextOutOfDate = YES;
          //updateEngineContext = NO;
          break;

      case kVK_Return:
      case kVK_ANSI_KeypadEnter:
          NSLog(@"***SGS applyEmitKeystrokeAction kVK_Return not handled");
          //charactersToAppend = @"\n";
          //[client insertText:charactersToAppend replacementRange:NSMakeRange(NSNotFound, NSNotFound)];
         break;

      default:
          {
              // NOTE: Although ch is usually the same as keyCode, when the option key is depressed (and
              // perhaps in some other cases) it may not be (keyCode can be 0). Likewise, the option key
              // can generate more than one character in event.characters.
              unichar ch = [event.characters characterAtIndex:0];
              if (keyCode < 0x33 || (ch >= 0x2A && ch <= 0x39)) { // Main keys, Numpad char range, normal punctuation
                  charactersToAppend = event.characters;
              }
              else {
                  // Other keys
              }
          }
          break;
  }
  /*
  if (charactersToAppend != nil) {
      if ([self.AppDelegate debugMode]) {
          NSLog(@"Adding \"%@\" to context buffer", charactersToAppend);
      }
      [self.contextBuffer appendString:charactersToAppend];
      if (_legacyMode) {
          _previousSelRange.location += charactersToAppend.length;
          _previousSelRange.length = 0;
      }
  }

  if (updateEngineContext) {
      [self.kme setContextBuffer:self.contextBuffer];
  }
   */
  return NO;
}
@end

/**
 * KMActionHandlerResult describes the steps that Keyman must take to apply the
 * necessary changes to the text of the client application.
 *
 * Changes are made to the client application by generating events and posting
 * them to the client application or by calling the following APIs: insertText,
 * attributedSubstringFromRange and selectedRange. It is preferable to use the
 * APIs, but they are not supported by all applications, and the APIs themselves
 * have limitations.
 *
 * If we need to do a single backspace, then we have no API available to do that
 * and must send an event to make the client think that the backspace key was
 * typed. The changes described in KMActionHandlerResult must be applied in the
 * correct order to produce the correct output at the client.
 */

@implementation KMActionHandlerResult
-(instancetype)initForActions:(NSArray*)actions handledEvent:(BOOL)handledEvent backspaceCount:(int)backspaces textToInsert:(NSString*)text {
  self = [super init];
  if (self) {
    _handledEvent = handledEvent;
    _backspaceCount = backspaces;
    _textToInsert = text;
    _operations = [self populateOperationListForActions:actions];
  }
  return self;
}

-(NSArray*) populateOperationListForActions:(NSArray*)actions {
  NSMutableArray* operationsList = [NSMutableArray arrayWithCapacity:actions.count];
  BOOL addedCompositeOperation = NO;
  
  for (CoreAction *action in [actions objectEnumerator])
  {
    switch(action.actionType) {
      case CharacterAction:
      case CharacterBackspaceAction:
        /**
         * only create the composite operation if we are handling the event, and, then, only if we haven't already created one yet
         */
        if(self.handledEvent) {
          if(!addedCompositeOperation) {
            KMActionOperation *operation = [[KMActionOperation alloc] initForCompositeAction:self.textToInsert backspaceCount:self.backspaceCount];
            [operationsList addObject:operation];
            addedCompositeOperation = YES;
          }
        } else {
          // TODO: this could be more clear, logically equating unhandled event with backspace is confusing even if always true
          /**
           * if we are not handling the event (letting backspace passthrough), then just make an operation for the action
           * so that it can be used to update the context
           */
          KMActionOperation *operation = [[KMActionOperation alloc] initForSimpleAction:action];
          [operationsList addObject:operation];
        }
        break;
      case MarkerAction:
      case MarkerBackspaceAction:
      case AlertAction:
      case PersistOptionAction:
      case EmitKeystrokeAction:
      case InvalidateContextAction:
      case CapsLockAction: {
        KMActionOperation *operation = [[KMActionOperation alloc] initForSimpleAction:action];
        [operationsList addObject:operation];
        break;
      }
      case EndAction:
        // this should never happen as it has been removed during optimization
        break;
    }
  }

  NSLog(@"populateOperationListForActions: %@", operationsList);

  return [operationsList copy];
}

@end

@implementation KMActionOperation

-(instancetype)initForSimpleAction:(CoreAction*)action {
  self = [super init];
  if (self) {
    _action = action;
    _textToInsert = @"";
    _backspaceCount = 0;
    _isForSimpleAction = YES;
    _isForCompositeAction = NO;
  }
  return self;
}

-(instancetype)initForCompositeAction:(NSString*)textToInsert backspaceCount:(int)backspaces {
  self = [super init];
  if (self) {
    _action = nil;
    _textToInsert = textToInsert;
    _backspaceCount = backspaces;
    _isForSimpleAction = NO;
    _isForCompositeAction = YES;
  }
  return self;
}

-(NSString *)description
{
  return [[NSString alloc] initWithFormat: @"%@ %@ textToInsert: %@ backspaces: %d", self.isForSimpleAction?@"simpleAction":@"compositeAction", self.action, self.textToInsert, self.backspaceCount];
}

-(BOOL)hasTextToInsert {
  return (self.textToInsert.length > 0);
}

-(BOOL)hasBackspaces {
  return (self.backspaceCount > 0);
}

-(BOOL)isBackspaceOnlyScenario {
  return (self.hasBackspaces && !self.hasTextToInsert);
}

-(BOOL)isTextOnlyScenario {
  return (!self.hasBackspaces && self.hasTextToInsert);
}

-(BOOL)isTextAndBackspaceScenario {
  return (self.hasBackspaces && self.hasTextToInsert);
}

@end
