import CryptoKit
import Darwin
import Foundation
import Security

// This file is compiled into both the app's local module and its WidgetKit extension.
// The App Group file stores display data and opaque context identifiers.
enum WidgetConstants {
  static let appGroup = Bundle.main.object(forInfoDictionaryKey: "MyRabbitWidgetsAppGroup") as? String
    ?? "group.im.jiaxin.myrabbit.widgets"
  static let kind = "MyRabbitDashboard"
  static let filename = "dashboard-v1.json"
  static let maxFaviconBytes = 24_576
  static let refreshKeychainGroup: String? = {
    guard let group = Bundle.main.object(forInfoDictionaryKey: "MyRabbitWidgetsKeychainGroup") as? String,
          !group.isEmpty, !group.contains("$(") else { return nil }
    return group
  }()
  static let metricIDs = ["users", "sessions", "pageviews", "pages_per_session", "bounce_rate", "session_duration"]
}

struct WidgetMetric: Codable, Identifiable {
  struct Change: Codable {
    enum Direction: String, Codable { case up, down, flat }
    enum Tone: String, Codable { case positive, negative, neutral }
    let percent: Double
    let direction: Direction
    let tone: Tone
  }

  let id: String
  let label: String
  let value: String
  let change: Change?
}

struct WidgetSnapshot: Codable {
  let version: Int
  let siteId: String
  let siteDomain: String
  let reportDate: String
  let timeZone: String
  let updatedAt: Double
  let metrics: [WidgetMetric]

  var updatedDate: Date { Date(timeIntervalSince1970: updatedAt / 1_000) }

  static func reportingDate(_ date: Date, timeZone: String) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.timeZone = TimeZone(identifier: timeZone) ?? .gmt
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
  }

  func validated(at date: Date = Date()) throws -> WidgetSnapshot {
    guard version == 1,
      Self.validText(siteId, maximum: 128), Self.validText(siteDomain, maximum: 256),
      Self.validText(timeZone, maximum: 128), TimeZone(identifier: timeZone) != nil,
      reportDate.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil,
      updatedAt.isFinite, updatedAt > 0, updatedDate <= date.addingTimeInterval(300),
      metrics.count == WidgetConstants.metricIDs.count,
      Set(metrics.map(\.id)) == Set(WidgetConstants.metricIDs)
    else { throw WidgetStorageError.invalidSnapshot }

    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.timeZone = TimeZone(identifier: timeZone)
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.isLenient = false
    guard let reportDay = formatter.date(from: reportDate), formatter.string(from: reportDay) == reportDate else {
      throw WidgetStorageError.invalidSnapshot
    }

    for metric in metrics {
      guard Self.validText(metric.label, maximum: 48), Self.validText(metric.value, maximum: 48) else {
        throw WidgetStorageError.invalidSnapshot
      }
      if let change = metric.change {
        guard change.percent.isFinite, change.percent >= 0 else { throw WidgetStorageError.invalidSnapshot }
      }
    }
    return self
  }

  private static func validText(_ value: String, maximum: Int) -> Bool {
    !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      && value.count <= maximum
      && value.rangeOfCharacter(from: .controlCharacters) == nil
  }
}

enum WidgetStorageError: LocalizedError {
  case unavailable, invalidSnapshot, contextChanged

  var errorDescription: String? {
    switch self {
    case .unavailable: return "Widget shared storage is unavailable."
    case .invalidSnapshot: return "The widget snapshot is invalid."
    case .contextChanged: return "The active widget site changed before this snapshot was saved."
    }
  }
}

struct WidgetEnvelope: Codable {
  let contextDigest: String?
  var snapshot: WidgetSnapshot?
  var favicon: Data? = nil
  var refreshID: UUID? = nil
}

struct WidgetRefreshCredential: Decodable {
  let id: UUID
  let serverUrl: String
  let apiKey: String

  private static var query: [String: Any]? {
    guard let group = WidgetConstants.refreshKeychainGroup else { return nil }
    // Matches Expo SecureStore's unauthenticated generic-password item.
    let key = Data("myrabbit.widget-refresh.v1".utf8)
    return [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: "myrabbit.widget-refresh:no-auth",
      kSecAttrAccount as String: key,
      kSecAttrGeneric as String: key,
      kSecAttrAccessGroup as String: group,
    ]
  }

  static func load(matching id: UUID) -> Self? {
    guard var query else { return nil }
    query[kSecReturnData as String] = true
    var result: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
          let bytes = result as? Data,
          let credential = try? JSONDecoder().decode(Self.self, from: bytes),
          credential.id == id, !credential.apiKey.isEmpty else { return nil }
    return credential
  }

  static func clear() {
    guard let query else { return }
    _ = SecItemDelete(query as CFDictionary)
  }
}

enum WidgetSnapshotStore {
  private static func fileURL() throws -> URL {
    guard let directory = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: WidgetConstants.appGroup) else {
      throw WidgetStorageError.unavailable
    }
    return directory.appendingPathComponent(WidgetConstants.filename, isDirectory: false)
  }

  private static func digest(_ context: String) -> String {
    SHA256.hash(data: Data(context.utf8)).map { String(format: "%02x", $0) }.joined()
  }

  private static func readEnvelope() throws -> WidgetEnvelope? {
    let url = try fileURL()
    guard FileManager.default.fileExists(atPath: url.path) else { return nil }
    let data = try Data(contentsOf: url)
    // JSON base64 expands the bounded PNG, in addition to the existing snapshot fields.
    guard data.count <= 65_536 else { throw WidgetStorageError.invalidSnapshot }
    return try JSONDecoder().decode(WidgetEnvelope.self, from: data)
  }

  private static func save(_ envelope: WidgetEnvelope) throws {
    let data = try JSONEncoder().encode(envelope)
    try data.write(to: fileURL(), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
  }

  private static func withWriteLock<T>(_ operation: () throws -> T) throws -> T {
    // The host and WidgetKit run as separate processes. Keep the read/modify/write
    // transaction serialized even though each replacement is already atomic.
    let lockPath = try fileURL().appendingPathExtension("lock").path
    let descriptor = open(lockPath, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
    guard descriptor >= 0 else { throw WidgetStorageError.unavailable }
    defer { close(descriptor) }
    guard flock(descriptor, LOCK_EX) == 0 else { throw WidgetStorageError.unavailable }
    defer { flock(descriptor, LOCK_UN) }
    return try operation()
  }

  static func setContext(_ context: String?) throws {
    try withWriteLock {
      let nextDigest = context.map(digest)
      if var current = try? readEnvelope(), current.contextDigest == nextDigest {
        if current.refreshID == nil, nextDigest != nil {
          current.refreshID = UUID()
          try save(current)
        }
        return
      }
      WidgetRefreshCredential.clear()
      // A fresh ID also invalidates requests from a prior session with the same site.
      try save(WidgetEnvelope(contextDigest: nextDigest, snapshot: nil, refreshID: nextDigest.map { _ in UUID() }))
    }
  }

  static func refreshRegistration(context: String) -> [String: String]? {
    guard let current = try? readEnvelope(), current.contextDigest == digest(context),
          let id = current.refreshID, let accessGroup = WidgetConstants.refreshKeychainGroup else { return nil }
    return ["id": id.uuidString, "accessGroup": accessGroup]
  }

  static func writeSnapshot(context: String, json: String) throws {
    guard let data = json.data(using: .utf8), data.count <= 32_768 else { throw WidgetStorageError.invalidSnapshot }
    let snapshot = try JSONDecoder().decode(WidgetSnapshot.self, from: data).validated()
    let contextDigest = digest(context)
    try withWriteLock {
      guard var current = try readEnvelope(), current.contextDigest == contextDigest else {
        throw WidgetStorageError.contextChanged
      }
      if let existing = current.snapshot, existing.updatedAt > snapshot.updatedAt { return }
      if current.snapshot?.siteDomain != snapshot.siteDomain { current.favicon = nil }
      current.snapshot = snapshot
      try save(current)
    }
  }

  static func writeRefresh(_ snapshot: WidgetSnapshot, id: UUID, startedAt: Date) throws {
    let snapshot = try snapshot.validated()
    try withWriteLock {
      guard var current = try readEnvelope(), current.refreshID == id,
            let previous = current.snapshot, previous.siteId == snapshot.siteId,
            previous.siteDomain == snapshot.siteDomain else { throw WidgetStorageError.contextChanged }
      guard previous.updatedDate <= startedAt else { return }
      current.snapshot = snapshot
      try save(current)
    }
  }

  static func writeFavicon(context: String, domain: String, png: Data) throws -> Bool {
    guard !png.isEmpty, png.count <= WidgetConstants.maxFaviconBytes else { throw WidgetStorageError.invalidSnapshot }
    let contextDigest = digest(context)
    return try withWriteLock {
      guard var current = try readEnvelope(), current.contextDigest == contextDigest,
            current.snapshot?.siteDomain == domain else { throw WidgetStorageError.contextChanged }
      guard current.favicon != png else { return false }
      current.favicon = png
      try save(current)
      return true
    }
  }

  static func loadCache() -> (snapshot: WidgetSnapshot?, favicon: Data?, hasContext: Bool, refreshID: UUID?) {
    guard let envelope = try? readEnvelope(), envelope.contextDigest != nil else { return (nil, nil, false, nil) }
    return (try? envelope.snapshot?.validated(), envelope.favicon, true, envelope.refreshID)
  }
}
