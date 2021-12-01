//
//  KMKeyboardInfo.h
//  Keyman
//
//  Created by Shawn Schantz on 11/25/21.
//  Copyright © 2021 SIL International. All rights reserved.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface KMKeyboardInfoBuilder : NSObject
@property (nonatomic,copy) NSString* name;
@property (nonatomic,copy) NSString* identifier;
@property (nonatomic,copy) NSString* version;
@property (nonatomic,copy) NSString* oskFont;
@property (nonatomic,copy) NSString* displayFont;
@property (nonatomic,copy) NSArray* languages;

- (instancetype)init;

@end

@interface KMLanguageInfo : NSObject
@property (nonatomic,readonly) NSString* name;
@property (nonatomic,readonly) NSString* identifier;

- (instancetype)initWithName:(NSString*)name
                  identifier:(NSString*)identifier;
@end

@interface KMKeyboardInfo : NSObject
@property (nonatomic,readonly) NSString* name;
@property (nonatomic,readonly) NSString* identifier;
@property (nonatomic,readonly) NSString* version;
@property (nonatomic,readonly) NSString* oskFont;
@property (nonatomic,readonly) NSString* displayFont;
@property (nonatomic,readonly) NSArray* languages;

- (instancetype)initWithBuilder:(KMKeyboardInfoBuilder*)builder;

- (instancetype)initWithName:(NSString*)name
                  identifier:(NSString*)identifier
                     version:(NSString*)version
                      oskFont:(NSString*)oskFont
                 displayFont:(NSString*)displayFont
                   languages:(NSArray*)languages;

@end

NS_ASSUME_NONNULL_END
