//
//  KeyboardKeymanPackage.swift
//  KeymanEngine
//
//  Created by Randy Boring on 3/14/19.
//  Copyright © 2019 SIL International. All rights reserved.
//

import Foundation

public class KeyboardKeymanPackage : TypedKeymanPackage<InstallableKeyboard> {
  internal var keyboards: [KMPKeyboard]!

  override internal init(metadata: KMPMetadata, folder: URL) {
    super.init(metadata: metadata, folder: folder)
    self.keyboards = []
    
    if let packagedKeyboards = metadata.keyboards {
      for keyboard in packagedKeyboards {
        if(keyboard.isValid && FileManager.default.fileExists(atPath: self.sourceFolder.appendingPathComponent("\(keyboard.keyboardId).js").path)) {
          keyboards.append(keyboard)
        } else {
          log.debug("\(keyboard.name) not valid / corresponding file not found")
        }
      }
    }

    self.setInstallableResourceSets(for: keyboards)
  }
  
  public override func defaultInfoHtml() -> String {
    var str = "Found Keyboards in package:<br/>"
    for keyboard in keyboards {
      str += keyboard.keyboardId + "<br/>"
    }
    return str
  }

  override var resources: [AnyKMPResource] {
    return keyboards
  }
}

