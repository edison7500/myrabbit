import CryptoKit
import Foundation

// This file is compiled into both the app's local module and its WidgetKit extension.
// Only normalized display data and a one-way context digest cross the App Group boundary.
enum WidgetConstants {
  static let appGroup = Bundle.main.object(forInfoDictionaryKey: "MyRabbitWidgetsAppGroup") as? String
    ?? "group.im.jiaxin.myrabbit.widgets"
  static let kind = "MyRabbitDashboard"
  static let filename = "dashboard-v1.json"
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

  func isStale(at date: Date) -> Bool {
    date.timeIntervalSince(updatedDate) >= 3_600 || reportDate != Self.reportingDate(date, timeZone: timeZone)
  }

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
  let snapshot: WidgetSnapshot?
}

enum WidgetSnapshotStore {
  private static let lock = NSLock()

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
    guard data.count <= 32_768 else { throw WidgetStorageError.invalidSnapshot }
    return try JSONDecoder().decode(WidgetEnvelope.self, from: data)
  }

  private static func save(_ envelope: WidgetEnvelope) throws {
    let data = try JSONEncoder().encode(envelope)
    try data.write(to: fileURL(), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
  }

  static func setContext(_ context: String?) throws {
    lock.lock()
    defer { lock.unlock() }
    let nextDigest = context.map(digest)
    let current = try? readEnvelope()
    if current?.contextDigest == nextDigest, current != nil { return }
    // Replacing the whole envelope invalidates old-site data before another request can write.
    try save(WidgetEnvelope(contextDigest: nextDigest, snapshot: nil))
  }

  static func writeSnapshot(context: String, json: String) throws {
    lock.lock()
    defer { lock.unlock() }
    guard let data = json.data(using: .utf8), data.count <= 32_768 else { throw WidgetStorageError.invalidSnapshot }
    let snapshot = try JSONDecoder().decode(WidgetSnapshot.self, from: data).validated()
    let contextDigest = digest(context)
    guard let current = try readEnvelope(), current.contextDigest == contextDigest else {
      throw WidgetStorageError.contextChanged
    }
    // Codable re-encoding excludes every unknown input field from shared storage.
    try save(WidgetEnvelope(contextDigest: contextDigest, snapshot: snapshot))
  }

  static func loadCache() -> (snapshot: WidgetSnapshot?, hasContext: Bool) {
    guard let envelope = try? readEnvelope(), envelope.contextDigest != nil else { return (nil, false) }
    return (try? envelope.snapshot?.validated(), true)
  }
}
