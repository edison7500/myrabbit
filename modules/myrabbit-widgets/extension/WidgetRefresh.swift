import AppIntents
import CoreFoundation
import Foundation

@available(iOS 17.0, *)
struct RefreshDashboardIntent: AppIntent {
  static let title: LocalizedStringResource = "Refresh dashboard"
  static let openAppWhenRun = false

  func perform() async throws -> some IntentResult {
    let startedAt = Date()
    let cache = WidgetSnapshotStore.loadCache()
    guard let snapshot = cache.snapshot, let id = cache.refreshID,
          let credential = WidgetRefreshCredential.load(matching: id) else {
      throw WidgetRefreshError.notReady
    }
    let refreshed = try await WidgetAnalytics.refresh(snapshot, using: credential, now: startedAt)
    try Task.checkCancellation()
    try WidgetSnapshotStore.writeRefresh(refreshed, id: id, startedAt: startedAt)
    // WidgetKit reloads the timeline after perform() completes.
    return .result()
  }
}

enum WidgetRefreshError: LocalizedError {
  case notReady, invalidResponse, unauthorized, forbidden, unavailable

  var errorDescription: String? {
    switch self {
    case .notReady: return "Open the app and load your dashboard to enable widget refresh."
    case .unauthorized: return "The saved API key could not authenticate."
    case .forbidden: return "The saved API key cannot read this site's analytics."
    case .invalidResponse, .unavailable: return "The dashboard could not refresh. Try again."
    }
  }
}

enum WidgetAnalytics {
  static func refresh(_ snapshot: WidgetSnapshot, using credential: WidgetRefreshCredential, now: Date) async throws -> WidgetSnapshot {
    guard let zone = TimeZone(identifier: snapshot.timeZone) else { throw WidgetRefreshError.invalidResponse }
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = zone
    guard let yesterday = calendar.date(byAdding: .day, value: -1, to: calendar.startOfDay(for: now)) else {
      throw WidgetRefreshError.invalidResponse
    }
    let today = WidgetSnapshot.reportingDate(now, timeZone: snapshot.timeZone)
    let prior = WidgetSnapshot.reportingDate(yesterday, timeZone: snapshot.timeZone)
    let config = URLSessionConfiguration.ephemeral
    config.httpShouldSetCookies = false
    config.httpCookieStorage = nil
    config.urlCredentialStorage = nil
    config.timeoutIntervalForRequest = 8
    config.timeoutIntervalForResource = 12
    let session = URLSession(configuration: config, delegate: RejectAnalyticsRedirects(), delegateQueue: nil)
    defer { session.invalidateAndCancel() }

    async let previous = try? overview(session, snapshot, credential, date: prior)
    let current = try await overview(session, snapshot, credential, date: today)
    let baseline = await previous ?? [:]
    guard !current.isEmpty else { throw WidgetRefreshError.invalidResponse }
    return WidgetSnapshot(version: 1, siteId: snapshot.siteId, siteDomain: snapshot.siteDomain, reportDate: today,
                          timeZone: snapshot.timeZone, updatedAt: Date().timeIntervalSince1970 * 1_000,
                          metrics: snapshot.metrics.map { metric in
      let value = current[metric.id]
      return WidgetMetric(id: metric.id, label: metric.label, value: format(value, metric: metric.id),
                          change: change(value, baseline[metric.id], metric: metric.id))
    })
  }

  static func request(_ snapshot: WidgetSnapshot, _ credential: WidgetRefreshCredential, date: String) throws -> URLRequest {
    let safeSegment = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")
    guard var url = URLComponents(string: credential.serverUrl),
          let scheme = url.scheme?.lowercased(), ["http", "https"].contains(scheme),
          let host = url.host, !host.isEmpty, url.user == nil, url.password == nil, url.query == nil, url.fragment == nil,
          let site = snapshot.siteId.addingPercentEncoding(withAllowedCharacters: safeSegment),
          !site.isEmpty, site != ".", site != "..",
          credential.apiKey.rangeOfCharacter(from: .newlines) == nil else { throw WidgetRefreshError.notReady }
    let path = url.percentEncodedPath
    url.percentEncodedPath = (path.hasSuffix("/") ? String(path.dropLast()) : path) + "/api/sites/\(site)/overview"
    url.queryItems = [
      URLQueryItem(name: "start_date", value: date),
      URLQueryItem(name: "end_date", value: date),
      URLQueryItem(name: "time_zone", value: snapshot.timeZone),
    ]
    guard let endpoint = url.url else { throw WidgetRefreshError.notReady }
    var request = URLRequest(url: endpoint, cachePolicy: .reloadIgnoringLocalCacheData)
    request.httpShouldHandleCookies = false
    request.setValue("Bearer \(credential.apiKey)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    return request
  }

  private static func overview(_ session: URLSession, _ snapshot: WidgetSnapshot,
                               _ credential: WidgetRefreshCredential, date: String) async throws -> [String: Double] {
    let (data, response) = try await session.data(for: request(snapshot, credential, date: date))
    switch (response as? HTTPURLResponse)?.statusCode {
    case 200: return try decodeOverview(data)
    case 401: throw WidgetRefreshError.unauthorized
    case 403: throw WidgetRefreshError.forbidden
    default: throw WidgetRefreshError.unavailable
    }
  }

  static func decodeOverview(_ bytes: Data) throws -> [String: Double] {
    guard bytes.count <= 65_536,
          let response = try? JSONSerialization.jsonObject(with: bytes) as? [String: Any],
          let data = response["data"] as? [String: Any] else { throw WidgetRefreshError.invalidResponse }
    var metrics: [String: Double] = [:]
    for id in WidgetConstants.metricIDs {
      guard let raw = data[id] else { continue }
      if raw is NSNull, ["pages_per_session", "bounce_rate", "session_duration"].contains(id) { continue }
      guard let number = raw as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID(),
            number.doubleValue.isFinite else { throw WidgetRefreshError.invalidResponse }
      metrics[id] = number.doubleValue
    }
    return metrics
  }

  private static func format(_ value: Double?, metric: String) -> String {
    guard let value else { return "—" }
    switch metric {
    case "bounce_rate": return String(format: "%.0f%%", floor(value + 0.5))
    case "pages_per_session": return String(format: "%.1f", value)
    case "session_duration":
      let seconds = floor(value + 0.5)
      return String(format: "%.0fm %.0fs", floor(seconds / 60), seconds.truncatingRemainder(dividingBy: 60))
    default:
      if value >= 1_000 {
        let scale: Double = value >= 1_000_000 ? 1_000_000 : 1_000
        let number = String(format: "%.1f", value / scale)
        return (number.hasSuffix(".0") ? String(number.dropLast(2)) : number) + (scale == 1_000 ? "k" : "m")
      }
      return value.formatted(.number.precision(.fractionLength(0)))
    }
  }

  private static func change(_ current: Double?, _ previous: Double?, metric: String) -> WidgetMetric.Change? {
    guard let current, let previous, previous > 0 else { return nil }
    let percent = (current - previous) / previous * 100
    guard percent.isFinite else { return nil }
    let favorable = metric == "bounce_rate" ? percent < 0 : percent > 0
    return WidgetMetric.Change(percent: abs(percent), direction: percent == 0 ? .flat : percent > 0 ? .up : .down,
                               tone: percent == 0 ? .neutral : favorable ? .positive : .negative)
  }
}

private final class RejectAnalyticsRedirects: NSObject, URLSessionTaskDelegate {
  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                  newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
    // Never forward the Bearer header to a redirect destination.
    completionHandler(nil)
  }
}
