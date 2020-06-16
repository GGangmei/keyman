//
//  KeymanPackageTests.swift
//  KeymanEngineTests
//
//  Created by Joshua Horton on 6/3/20.
//  Copyright © 2020 SIL International. All rights reserved.
//

import XCTest
@testable import KeymanEngine

class KeymanPackageTests: XCTestCase {
  func testKeyboardPackageExtraction() throws {
    let cacheDirectory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
    let khmerPackageZip = cacheDirectory.appendingPathComponent("khmer_angkor.kmp.zip")
    try FileManager.default.copyItem(at: TestUtils.Keyboards.khmerAngkorKMP, to: khmerPackageZip)

    let destinationFolderURL = cacheDirectory.appendingPathComponent("khmer_angkor")

    // Requires that the source file is already .zip, not .kmp.  It's a ZipUtils limitation.
    do {
      if let kmp = try KeymanPackage.extract(fileUrl: khmerPackageZip, destination: destinationFolderURL) {
        // Run assertions on the package's kmp.info.
        // Assumes the KMP used for testing here has the same kmp.info used for those tests.
        let kmp_json_testcase = KMPJSONTests()
        kmp_json_testcase.kmp_info_khmer_angkor_assertions(kmp.metadata)

        XCTAssertNotNil(kmp as? KeyboardKeymanPackage, "Keyboard KMP test extraction did not yield a keyboard package!")
        XCTAssertTrue(kmp.isKeyboard(), "Keyboard KMP test extraction did not yield a keyboard package!")
        XCTAssertEqual(kmp.id, "khmer_angkor", "Incorrect package ID")
        // extracted ok, test kmp
        XCTAssert(kmp.sourceFolder == destinationFolderURL,
                  "The KMP's reported 'source folder' should match the specified destination folder")
      } else {
        XCTAssert(false, "KeymanPackage.extract failed")
      }
    } catch {
      XCTFail("KeymanPackage.extract failed with error \(error)")
    }
  }

  func testLexicalModelPackageExtraction() throws {
    let cacheDirectory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
    let mtntZip = cacheDirectory.appendingPathComponent("nrc.en.mtnt.kmp.zip")
    try FileManager.default.copyItem(at: TestUtils.LexicalModels.mtntKMP, to: mtntZip)

    let destinationFolderURL = cacheDirectory.appendingPathComponent("nrc.en.mtnt.model")

    // Requires that the source file is already .zip, not .kmp.  It's a ZipUtils limitation.
    do {
      if let kmp = try KeymanPackage.extract(fileUrl: mtntZip, destination: destinationFolderURL) {
        // Run assertions on the package's kmp.info.
        // Assumes the KMP used for testing here has the same kmp.info used for those tests.
        let kmp_json_testcase = KMPJSONTests()

        // As this test takes place after construction of the LexicalModelPackage,
        // the version will be set accordingly, unlike in the other JSON-related tests.
        kmp_json_testcase.kmp_info_nrc_en_mtnt_assertions(kmp.metadata, version: "0.1.4")

        XCTAssertNotNil(kmp as? LexicalModelKeymanPackage, "Lexical model KMP test extraction yielded a keyboard package!")
        XCTAssertTrue(!kmp.isKeyboard(), "Lexical model KMP test extraction yielded a keyboard package!")
        XCTAssertEqual(kmp.id, "nrc.en.mtnt")

        // extracted ok, test kmp
        XCTAssert(kmp.sourceFolder == destinationFolderURL,
                  "The KMP's reported 'source folder' should match the specified destination folder")
      } else {
        XCTAssert(false, "KeymanPackage.extract failed")
      }
    } catch {
      XCTFail("KeymanPackage.extract failed with error \(error)")
    }
  }

  func testPackageFindResourceMatch() throws {
    guard let kmp1 = try ResourceFileManager.shared.prepareKMPInstall(from: TestUtils.Keyboards.khmerAngkorKMP) as? KeyboardKeymanPackage else {
      XCTFail("Incorrect package type loaded for test")
      return
    }
    let kbd = kmp1.findResource(withID: TestUtils.Keyboards.khmer_angkor.fullID)
    XCTAssertNotNil(kbd)
    XCTAssertEqual(kbd?.packageID, "khmer_angkor", "Keyboard package ID not properly set")
    // This keyboard's not in the specified testing package.
    XCTAssertNil(kmp1.findResource(withID: TestUtils.Keyboards.khmer10.fullID))

    // Thanks to our package typing hierarchy, it's impossible to even TRY finding
    // a FullLexicalModelID within a KeyboardKeymanPackage!

    guard let kmp2 = try ResourceFileManager.shared.prepareKMPInstall(from: TestUtils.LexicalModels.mtntKMP) as? LexicalModelKeymanPackage else {
      XCTFail("Incorrect package type loaded for test")
      return
    }
    let lm = kmp2.findResource(withID: TestUtils.LexicalModels.mtnt.fullID)
    XCTAssertNotNil(lm)
    XCTAssertEqual(lm?.packageID, "nrc.en.mtnt", "Lexical model ID not properly set")

    // Thanks to our package typing hierarchy, it's impossible to even TRY finding
    // a FullKeyboardID within a LexicalModelKeymanPackage!
  }

  func testInstalledPackageDeinit() throws {
    let kmp = try ResourceFileManager.shared.prepareKMPInstall(from: TestUtils.Keyboards.khmerAngkorKMP)
    XCTAssertNotNil(kmp, "Failed to prepare KMP for installation")
    XCTAssertNotNil(kmp as? KeyboardKeymanPackage, "KMP resource type improperly recognized - expected a keyboard package!")

    try ResourceFileManager.shared.finalizePackageInstall(kmp, isCustom: true)

    let installedDir = Storage.active.resourceDir(for: TestUtils.Keyboards.khmer_angkor)!
    let installedURL = Storage.active.resourceURL(for: TestUtils.Keyboards.khmer_angkor)!

    // Intentionally scopes the `package` variable
    do {
      let package = KeymanPackage.parse(installedDir)!
      XCTAssertTrue(FileManager.default.fileExists(atPath: installedURL.path))
      XCTAssertEqual(package.id, "khmer_angkor")
    }

    // Deinit should have triggered - is everything still in place?
    XCTAssertTrue(FileManager.default.fileExists(atPath: installedURL.path))
    XCTAssertTrue(FileManager.default.fileExists(atPath: installedDir.path))
  }

  func testTempPackageDeinit() throws {
    var tempDir: URL

    // Intentionally scopes the `package` variable.
    do {
      let package = try ResourceFileManager.shared.prepareKMPInstall(from: TestUtils.Keyboards.khmerAngkorKMP)
      XCTAssertNotNil(package, "Failed to prepare KMP for installation")
      XCTAssertNotNil(package as? KeyboardKeymanPackage, "KMP resource type improperly recognized - expected a keyboard package!")

      tempDir = package.sourceFolder

      XCTAssertTrue(FileManager.default.fileExists(atPath: tempDir.path))
    }

    // Deinit should have triggered - were the files automatically cleaned up?
    XCTAssertFalse(FileManager.default.fileExists(atPath: tempDir.path))
  }
}
