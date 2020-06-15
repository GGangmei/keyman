//
//  ResourceDownloadManager.swift
//  KeymanEngine
//
//  Created by Joshua Horton on 8/15/19.
//  Copyright © 2019 SIL International. All rights reserved.
//

import Foundation

// One half of the resource management puzzle - this part generates download and update requests at the demand
// of app UI and submits them to the actual 'download manager', the ResourceDownloadQueue.
//
// This will be the public face of resource download management in KMEI, while the other half is private and
// only accessible within the library.
public class ResourceDownloadManager {
  private var downloader: ResourceDownloadQueue
  private var isDidUpdateCheck = false
  
  public static let shared = ResourceDownloadManager()
  
  private init() {
    downloader = ResourceDownloadQueue()
  }
  
  // MARK: - Common functionality
  
  private func fetchHandler(for resourceType: DownloadTask.Resource, _ completionHandler: @escaping () -> Void)
                            -> (_ error: Error?) -> Void {
    return { error in
      if let error = error {
        // TODO:  Connect to an error handler (or just render appropriate text) based on the resource type.
        self.downloader.downloadFailed(forKeyboards: [], error: error)
      } else {
        log.info("Fetched repository. Continuing with download.")
        completionHandler()
      }
    }
  }
  
  // MARK - Downloading keyboards
  
  private func getInstallableKeyboardMetadata(withID keyboardID: String, languageID: String) -> InstallableKeyboard? {
    // Grab info for the relevant API version of the keyboard.
    guard let keyboard = Manager.shared.apiKeyboardRepository.installableKeyboard(withID: keyboardID, languageID: languageID)
    else {
      let message = "Keyboard not found with id: \(keyboardID), languageID: \(languageID)"
      let error = NSError(domain: "Keyman", code: 0,
                          userInfo: [NSLocalizedDescriptionKey: message])
      downloader.downloadFailed(forKeyboards: [], error: error)
      return nil
    }
    
    return keyboard
  }
  
  // We return the batch instance to indicate success.  Also, in case we decide to implement Promises based on batch completion,
  // since this will expose the generated Promise for the caller's use.
  private func downloadKeyboardCore(withMetadata keyboards: [InstallableKeyboard], asActivity activity: DownloadBatch.Activity,
      withFilename filename: String, withOptions options: Options) -> DownloadBatch? {

    if let dlBatch = buildKeyboardDownloadBatch(for: keyboards[0], withFilename: filename, asActivity: activity, withOptions: options) {
      let tasks = dlBatch.tasks as! [DownloadTask]
      // We want to denote ALL language variants of a keyboard as part of the batch's metadata, even if we only download a single time.
      tasks.forEach { task in
        task.resources = keyboards
      }
      
      // Perform common 'can download' check.  We need positive reachability and no prior download queue.
      // The parameter facilitates error logging.
      if !downloader.canExecute(dlBatch) {
        return nil
      }
      
      downloader.queue(dlBatch)
      return dlBatch
    }
    return nil
  }
  
  private func buildKeyboardDownloadBatch(for keyboard: InstallableKeyboard, withFilename filename: String,
                                          asActivity activity: DownloadBatch.Activity, withOptions options: Options) -> DownloadBatch? {
    let keyboardURL = options.keyboardBaseURL.appendingPathComponent(filename)
    let fontURLs = Array(Set(keyboardFontURLs(forFont: keyboard.font, options: options) +
                             keyboardFontURLs(forFont: keyboard.oskFont, options: options)))

    do {
      try FileManager.default.createDirectory(at: Storage.active.resourceDir(for: keyboard)!,
                                              withIntermediateDirectories: true)
    } catch {
      log.error("Could not create dir for download: \(error)")
      return nil
    }

    var request = HTTPDownloadRequest(url: keyboardURL, userInfo: [:])
    // TODO:  Ensure that the downloaded keyboard is immediately KMP-wrapped!
    request.destinationFile = Storage.active.cloudKeyboardURL(forID: keyboard.id).path
    request.tag = 0

    let keyboardTask = DownloadTask(do: request, for: [keyboard], type: .keyboard)
    var batchTasks: [DownloadTask] = [ keyboardTask ]
    
    for (i, url) in fontURLs.enumerated() {
      request = HTTPDownloadRequest(url: url, userInfo: [:])
      request.destinationFile = Storage.active.fontURL(forResource: keyboard, filename: url.lastPathComponent)!.path
      request.tag = i + 1
      
      let fontTask = DownloadTask(do: request, for: nil, type: .other)
      batchTasks.append(fontTask)
    }
    
    let batch = DownloadBatch(do: batchTasks, as: activity, ofType: .keyboard)
    batchTasks.forEach { task in
      task.request.userInfo[Key.downloadBatch] = batch
      task.request.userInfo[Key.downloadTask] = task
    }
    
    return batch
  }

  /// Asynchronously fetches the .js file for the keyboard with given IDs.
  /// See `Notifications` for notification on success/failiure.
  /// - Parameters:
  ///   - isUpdate: Keep the keyboard files on failure
  ///   - fetchRepositoryIfNeeded: Fetch the list of keyboards from the API if necessary.
  public func downloadKeyboard(withID keyboardID: String,
                               languageID: String,
                               isUpdate: Bool,
                               fetchRepositoryIfNeeded: Bool = true) {
    guard let _ = Manager.shared.apiKeyboardRepository.keyboards,
      let options = Manager.shared.apiKeyboardRepository.options
    else {
      if fetchRepositoryIfNeeded {
        log.info("Fetching repository from API for keyboard download")
        Manager.shared.apiKeyboardRepository.fetch(completionHandler: fetchHandler(for: .keyboard) {
          self.downloadKeyboard(withID: keyboardID, languageID: languageID, isUpdate: isUpdate, fetchRepositoryIfNeeded: false)
        })
        return
      } else {
        let message = "Keyboard repository not yet fetched"
        let error = NSError(domain: "Keyman", code: 0, userInfo: [NSLocalizedDescriptionKey: message])
        downloader.downloadFailed(forKeyboards: [], error: error)
        return
      }
    }

    // Grab info for the relevant API version of the keyboard.
    guard let keyboard = getInstallableKeyboardMetadata(withID: keyboardID, languageID: languageID),
      let filename = Manager.shared.apiKeyboardRepository.keyboards?[keyboardID]?.filename
    else {
      return
    }
    
    if let _ = downloadKeyboardCore(withMetadata: [keyboard], asActivity: isUpdate ? .update : .download, withFilename: filename, withOptions: options) {
      self.downloadLexicalModelsForLanguageIfExists(languageID: languageID)
    }
  }

  private func keyboardFontURLs(forFont font: Font?, options: Options) -> [URL] {
    guard let font = font else {
      return []
    }
    return font.source.filter({ $0.hasFontExtension })
      .map({ options.fontBaseURL.appendingPathComponent($0) })
  }
  
  /// - Returns: The current state for a keyboard
  public func stateForKeyboard(withID keyboardID: String) -> KeyboardState {
    // Needs validation - I don't think this if-condition can be met in Keyman's current state
    // (as of 2019-08-16)
    if downloader.keyboardIdForCurrentRequest() == keyboardID {
      return .downloading
    }
    let userKeyboards = Storage.active.userDefaults.userKeyboards
    guard let userKeyboard = userKeyboards?.first(where: { $0.id == keyboardID }) else {
      return .needsDownload
    }

    // Check version
    if let repositoryVersionString = Manager.shared.apiKeyboardRepository.keyboards?[keyboardID]?.version {
      let downloadedVersion = Version(userKeyboard.version) ?? Version.fallback
      let repositoryVersion = Version(repositoryVersionString) ?? Version.fallback
      if downloadedVersion < repositoryVersion {
        return .needsUpdate
      }
    }
    return .upToDate
  }

  // MARK - Lexical models

  private func getInstallableLexicalModelMetadata(withID lexicalModelID: String, languageID: String) -> InstallableLexicalModel? {
    // Grab info for the relevant API version of the keyboard.
    guard let keyboard = Manager.shared.apiLexicalModelRepository.installableLexicalModel(withID: lexicalModelID, languageID: languageID)
    else {
      let message = "Lexical model not found with id: \(lexicalModelID), languageID: \(languageID)"
      let error = NSError(domain: "Keyman", code: 0,
                          userInfo: [NSLocalizedDescriptionKey: message])
      // TODO: better error target.
      downloader.downloadFailed(forLanguageID: "", error: error)
      return nil
    }
    
    return keyboard
  }
  
  // We return the batch instance to indicate success.  Also, in case we decide to implement Promises based on batch completion,
  // since this will expose the generated Promise for the caller's use.
  private func downloadLexicalModelCore(withMetadata lexicalModels: [InstallableLexicalModel], asActivity activity: DownloadBatch.Activity,
      fromPath path: URL) -> DownloadBatch? {

    if let dlBatch = buildLexicalModelDownloadBatch(for: lexicalModels[0], withFilename: path, asActivity: activity) {
      let tasks = dlBatch.tasks as! [DownloadTask]
      // We want to denote ALL language variants of a keyboard as part of the batch's metadata, even if we only download a single time.
      tasks.forEach { task in
        task.resources = lexicalModels
      }
      
      // Perform common 'can download' check.  We need positive reachability and no prior download queue.
      // The parameter facilitates error logging.
      if !downloader.canExecute(dlBatch) {
        return nil
      }
      
      downloader.queue(dlBatch)
      return dlBatch
    }
    return nil
  }
  
  private func buildLexicalModelDownloadBatch(for lexicalModel: InstallableLexicalModel, withFilename path: URL,
      asActivity activity: DownloadBatch.Activity) -> DownloadBatch? {
    do {
      try FileManager.default.createDirectory(at: Storage.active.resourceDir(for: lexicalModel)!,
                                              withIntermediateDirectories: true)
    } catch {
      log.error("Could not create dir for download: \(error)")
      return nil
    }

    let request = HTTPDownloadRequest(url: path, userInfo: [:])
    // TODO:  redirect to store in the Documents directory.
    request.destinationFile = Storage.active.lexicalModelPackageURL(for: lexicalModel).path
    request.tag = 0

    let lexicalModelTask = DownloadTask(do: request, for: [lexicalModel], type: .lexicalModel)
    let batchTasks: [DownloadTask] = [ lexicalModelTask ]
    
    let batch = DownloadBatch(do: batchTasks, as: activity, ofType: .lexicalModel)
    batchTasks.forEach { task in
      task.request.userInfo[Key.downloadBatch] = batch
      task.request.userInfo[Key.downloadTask] = task
    }
    
    return batch
  }
  
  // Can be called by the cloud keyboard downloader and utilized.
  
  /// Starts the process of fetching the package file of the lexical model for the given language ID
  ///   first it fetches the list of lexical models for the given language
  ///   then it takes the first of the list and download the KMP package file and asks the app to open it (like adhoc download)
  /// - Parameters:
  ///   - languageID: the bcp47 string of the desired language
  public func downloadLexicalModelsForLanguageIfExists(languageID: String) {
    // TODO:  This fetch will conflict with the fetch in the next method; we need some scheme to reset
    //        the other's fetch after this completes.
    //
    //        It _may_ be better to retool how this looks up the lexical model for a language.  Not sure yet.
  
    //get list of lexical models for this languageID  /?q=bcp47:en
    func listCompletionHandler(lexicalModels: [LexicalModel]?, error: Error?) -> Void {
      if let error = error {
        log.info("Failed to fetch lexical model list for "+languageID+". error: "+error.localizedDescription)
        downloader.downloadFailed(forLanguageID: languageID, error: error)
      } else if nil == lexicalModels {
        //TODO: put up an alert instead
        log.info("No lexical models available for language \(languageID) (nil)")
      } else if 0 == lexicalModels?.count {
        log.info("No lexical models available for language \(languageID) (empty)")
      } else {
        log.info("Fetched lexical model list for "+languageID+".")
        // choose which of the lexical models to download
        //  for now, this just downloads the first one
        let chosenIndex = 0
        if let lexicalModel = lexicalModels?[chosenIndex] {
          //downloadLexicalModelPackage(url: URL.init(string: lexicalModel.packageFilename)!)
          // We've already fetched part of the repository to do this.
          downloadLexicalModel(withID: lexicalModel.id, languageID: languageID, isUpdate: false, fetchRepositoryIfNeeded: false)
        } else {
          log.info("no error, but no lexical model in list, either!")
        }
      }
    }
    
    Manager.shared.apiLexicalModelRepository.fetchList(languageID: languageID, completionHandler: listCompletionHandler)
  }

  /// Asynchronously fetches the .js file for the lexical model with given IDs.
  /// See `Notifications` for notification on success/failiure.
  /// - Parameters:
  ///   - isUpdate: Keep the lexical model files on failure
  ///   - fetchRepositoryIfNeeded: Fetch the list of lexical models from the API if necessary.
  public func downloadLexicalModel(withID lexicalModelID: String,
                                   languageID: String,
                                   isUpdate: Bool,
                                   fetchRepositoryIfNeeded: Bool = true) {
    
    // TODO:  We should always force a refetch after new keyboards are installed so we can redo our language queries.
    //        That should probably be done on successful keyboard installs, not here, though.
    if fetchRepositoryIfNeeded {
      // A temp measure to make sure things aren't totally broken.  Definitely not optimal.
      Manager.shared.apiLexicalModelRepository.fetch(completionHandler: nil)
    }
    
    guard let _ = Manager.shared.apiLexicalModelRepository.lexicalModels else {
      if fetchRepositoryIfNeeded {
        log.info("Fetching repository from API for lexicalModel download")
        Manager.shared.apiLexicalModelRepository.fetch(completionHandler: fetchHandler(for: .lexicalModel) {
          self.downloadLexicalModel(withID: lexicalModelID, languageID: languageID, isUpdate: isUpdate, fetchRepositoryIfNeeded: false)
        })
        return
      } else {
        let message = "Lexical model repository not yet fetched"
        let error = NSError(domain: "Keyman", code: 0, userInfo: [NSLocalizedDescriptionKey: message])
        downloader.downloadFailed(forKeyboards: [], error: error)
        return
      }
    }

    // Grab info for the relevant API version of the keyboard.
    guard let lexicalModel = getInstallableLexicalModelMetadata(withID: lexicalModelID, languageID: languageID),
      let filename = Manager.shared.apiLexicalModelRepository.lexicalModels?[lexicalModelID]?.packageFilename
    else {
      return
    }
    
    _ = downloadLexicalModelCore(withMetadata: [lexicalModel], asActivity: isUpdate ? .update : .download, fromPath: URL.init(string: filename)!)
  }
  
  /// - Returns: The current state for a lexical model
  //TODO: rename KeyboardState to ResourceState? so it can be used with both keybaoards and lexical models without confusion
  public func stateForLexicalModel(withID lexicalModelID: String) -> KeyboardState {
    if downloader.lexicalModelIdForCurrentRequest() == lexicalModelID {
      return .downloading
    }
    let userLexicalModels = Storage.active.userDefaults.userLexicalModels
    guard let userLexicalModel = userLexicalModels?.first(where: { $0.id == lexicalModelID }) else {
      return .needsDownload
    }
    
    // Check version
    if let repositoryVersionString = Manager.shared.apiLexicalModelRepository.lexicalModels?[lexicalModelID]?.version {
      let downloadedVersion = Version(userLexicalModel.version) ?? Version.fallback
      let repositoryVersion = Version(repositoryVersionString) ?? Version.fallback
      if downloadedVersion < repositoryVersion {
        return .needsUpdate
      }
    }
    return .upToDate
  }
  
  // MARK: Update checks + management
  public var updatesAvailable: Bool {
    get {
      return getAvailableUpdates() != nil
    }
  }
  
  public func getAvailableUpdates() -> [AnyLanguageResource]? {
    // Relies upon KMManager's preload; this was the case before the rework.
    if Manager.shared.apiKeyboardRepository.languages == nil && Manager.shared.apiLexicalModelRepository.languages == nil {
      return nil
    }

    isDidUpdateCheck = true
    
    var updatables: [AnyLanguageResource] = []

    // Gets the list of current, local keyboards in need of an update.
    // Version matches the current version, not the updated version.
    let kbds = getUpdatableKeyboards()
    updatables.append(contentsOf: kbds)

    // Likewise for lexical models.
    let lexModels = getUpdatableLexicalModels()
    updatables.append(contentsOf: lexModels)
    
    if updatables.count > 0 {
      return updatables
    } else {
      return nil
    }
  }
  
  public func performUpdates(forResources resources: [AnyLanguageResource]) {
    // The plan is to create new notifications to handle batch updates here, rather than
    // require a UI to manage the update queue.
    var batches: [DownloadBatch] = []
    
    resources.forEach { res in
      if let kbd = res as? InstallableKeyboard {
        if let filename = Manager.shared.apiKeyboardRepository.keyboards?[kbd.id]?.filename,
          let kbdUpdate = Manager.shared.apiKeyboardRepository.installableKeyboard(withID: kbd.id, languageID: kbd.languageID),
           let options = Manager.shared.apiKeyboardRepository.options {
          if let batch = self.buildKeyboardDownloadBatch(for: kbdUpdate, withFilename: filename, asActivity: .update, withOptions: options) {
            batches.append(batch)
          }
        }
      } else if let lex = res as? InstallableLexicalModel {
        if let filename = Manager.shared.apiLexicalModelRepository.lexicalModels?[lex.id]?.packageFilename,
           let lexUpdate = Manager.shared.apiLexicalModelRepository.installableLexicalModel(withID: lex.id, languageID: lex.languageID),
           let path = URL.init(string: filename) {
          if let batch = self.buildLexicalModelDownloadBatch(for: lexUpdate, withFilename: path, asActivity: .update) {
            batches.append(batch)
          }
        }
      }
    }
    
    let batchUpdate = DownloadBatch(queue: batches)
    downloader.queue(batchUpdate)
  }
  
  private func getUpdatableKeyboards() -> [InstallableKeyboard] {
    var updateQueue: [InstallableKeyboard] = []
    var kbIDs = Set<String>()
    
    // Build the keyboard update queue
    Storage.active.userDefaults.userKeyboards?.forEach { kb in
      let kbState = stateForKeyboard(withID: kb.id)
      if kbState == .needsUpdate {
        if(!kbIDs.contains(kb.id)) {
          kbIDs.insert(kb.id)
          updateQueue.append(kb)
        }
      }
    }
    
    return updateQueue
  }

  private func getUpdatableLexicalModels() -> [InstallableLexicalModel] {
    // Build the lexical model update queue
    var updateQueue: [InstallableLexicalModel] = []
    var lmIDs = Set<String>()
    
    Storage.active.userDefaults.userLexicalModels?.forEach { lm in
      let lmState = stateForLexicalModel(withID: lm.id)
      if lmState == .needsUpdate {
        if !lmIDs.contains(lm.id) {
          lmIDs.insert(lm.id)
          updateQueue.append(lm)
        }
      }
    }

    return updateQueue
  }

  public func installLexicalModelPackage(at packageURL: URL) -> InstallableLexicalModel? {
    return downloader.installLexicalModelPackage(downloadedPackageFile: packageURL)
  }
}
