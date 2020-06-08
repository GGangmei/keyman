//
//  LanguageResource.swift
//  KeymanEngine
//
//  Created by Joshua Horton on 8/16/19.
//  Copyright © 2019 SIL International. All rights reserved.
//

import Foundation

public enum LanguageResourceType {
  case keyboard, lexicalModel
}

public protocol LanguageResource {
  var id: String { get }
  var languageID: String { get }
  var version: String { get }

  // Used for generating QR codes.
  var sharableURL: String? { get }

  // Used during resource installation
  var fonts: [Font] { get }
  var sourceFilename: String { get }
}
