/**
 * Keyman is copyright (C) SIL International. MIT License.
 * 
 * CoreAction.m
 * Keyman
 * 
 * Created by Shawn Schantz on 2023-02-21.
 * 
 * A value object representing one or more actions returned by Keyman Core. A
 * list of Actions is returned by Core when processing a key down event. These
 * actions are applied by the platform code to update the context.
 *
 * The ActionType is a one-to-one mapping to that returned from Core but with
 * one exception. Keyman Core defines a single Backspace action, but CoreAction
 * defines two, one for markers and one for characters. The two backspace
 * actions are handled much differently when being applied to the client.
 */

#import "CoreAction.h"
#import "KMEngine.h"  // included for Q_STR etc.

@implementation CoreAction

/*
 * Designated initializer
 */
-(instancetype)initWithType: (ActionType)type actionContent:(NSString*)content backspaceCount:(int)backspaceCount {
  self = [super init];
  if (self) {
    self->_actionType = type;
    switch (type)
    {
      case EndAction: {
        self->_typeName = @"End";
        break;
      }
      case CharacterAction: {
        self->_typeName = @"Character";
        self->_content = content;
        break;
      }
      case MarkerAction: {
        self->_typeName = @"Marker";
        break;
      }
      case AlertAction: {
        self->_typeName = @"Alert";
        break;
      }
      case CharacterBackspaceAction: {
        self->_typeName = @"Character Backspace";
        self->_backspaceCount = backspaceCount;
        break;
      }
      case MarkerBackspaceAction: {
        self->_typeName = @"Marker Backspace";
        self->_backspaceCount = backspaceCount;
        break;
      }
      case PersistOptionAction: {
        self->_typeName = @"Persist Option";
        break;
      }
      case EmitKeystrokeAction: {
        self->_typeName = @"Emit Keystroke";
        break;
      }
      case InvalidateContextAction: {
        self->_typeName = @"Invalidate Context";
        break;
      }
      case CapsLockAction: {
        self->_typeName = @"Caps Lock";
        break;
      }
      default: {
        self->_typeName = @"Unknown";
      }
    }
  }
  return self;
}

/*
 * This is implemented so that there is no path to init a CoreAction object without
 * going through the designated initializer, initWithType. It blocks a direct call to super init which
 * would result in uninitialized fields. This init results in a hard-coded AlertAction and
 * should not be used.
 */
-(instancetype)init {
  return [self initWithType:AlertAction actionContent:@"" backspaceCount:0];
}

-(instancetype)initCharacterAction:(NSString*)content {
  self = [self initWithType: CharacterAction actionContent:content backspaceCount:0];
  return self;
}

-(instancetype)initCharacterBackspaceAction:(NSString*)content {
  self = [self initWithType: CharacterBackspaceAction actionContent:content backspaceCount:1];
  return self;
}

-(instancetype)initMarkerBackspaceAction:(int)count {
  self = [self initWithType: MarkerBackspaceAction actionContent:@"" backspaceCount:count];
  return self;
}

-(BOOL)isCharacter {
  return self.actionType==CharacterAction;
}

-(BOOL)isCharacterBackspace {
  return self.actionType==CharacterBackspaceAction;
}

-(BOOL)isMarker {
  return self.actionType==MarkerAction;
}

-(BOOL)isMarkerBackspace {
  return self.actionType==MarkerBackspaceAction;
}

-(NSString *)description
{
  NSString *charString = nil;
  BOOL hasCharacterString = (self.isCharacter) || (self.isCharacterBackspace);
  
  if(hasCharacterString) {
    const unichar unicodeChar = [_content characterAtIndex:0];
    charString = [[NSString alloc] initWithFormat:@"%u / 0x%X : '%@'", unicodeChar, unicodeChar, _content];
  } else {
    charString = @"";
  }
  
  return [[NSString alloc] initWithFormat: @"%@ %@", self.typeName, charString];
}

/*
 The legacy Keyman for Mac code represents each action returned from Keyman
 Engine as an NSDictionary. CoreWrapper returns CoreAction objects. This method
 converts a CoreAction object to an array of NSDictionary objects. This allows
 us to replace the key processing code in Keyman Engine with Keyman Core and
 CoreWrapper without rewriting the Keyman Input Method code consuming the
 actions.
 */
/*
-(NSDictionary*) legacyDictionaryActionForActionObject:(CoreAction*)action {
  NSDictionary *actionMap = nil;
  
  switch (action.actionType)
  {
    case CharacterAction: {
      actionMap = [[NSDictionary alloc] initWithObjectsAndKeys:action.content, Q_STR, nil];
      break;
    }
    case MarkerAction: {
      actionMap = [[NSDictionary alloc] initWithObjectsAndKeys:[NSNumber numberWithUnsignedInteger:1], Q_DEADKEY, nil];
      break;
    }
    case AlertAction: {
      actionMap = [[NSDictionary alloc] initWithObjectsAndKeys:@"", Q_BEEP, nil];
      break;
    }
    case BackspaceAction: {
      actionMap = [[NSDictionary alloc] initWithObjectsAndKeys:[NSNumber numberWithUnsignedInteger:1], Q_BACK, nil];
      break;
    }
    // TODO: implement Persist Options
    case PersistOptionAction: {
      actionMap = [[NSDictionary alloc] initWithObjectsAndKeys:[NSNumber numberWithUnsignedInteger:1], Q_SAVEOPT, nil];
      break;
    }
    case EmitKeystrokeAction: {
      actionMap = [[NSDictionary alloc] initWithObjectsAndKeys:@"", Q_RETURN, nil];
      break;
    }
    case EndAction: {
      // purposely return nil for EndAction, as it is not needed by the legacy Keyman for Mac code
      break;
    }
    default: {
    }
  }

  return actionMap;
}
*/
@end

