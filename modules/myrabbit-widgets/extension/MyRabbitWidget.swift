import SwiftUI
import UIKit
import WidgetKit

private enum WidgetColors {
  static let background = Color(red: 33 / 255, green: 33 / 255, blue: 33 / 255)
  static let surface = Color(red: 44 / 255, green: 44 / 255, blue: 46 / 255)
  static let text = Color(red: 245 / 255, green: 245 / 255, blue: 247 / 255)
  static let muted = Color(red: 168 / 255, green: 168 / 255, blue: 173 / 255)
  static let accent = Color(red: 167 / 255, green: 139 / 255, blue: 250 / 255)
  static let positive = Color(red: 117 / 255, green: 205 / 255, blue: 167 / 255)
  static let negative = Color(red: 255 / 255, green: 155 / 255, blue: 149 / 255)
}

struct DashboardEntry: TimelineEntry {
  let date: Date
  let snapshot: WidgetSnapshot?
  var hasContext: Bool = false
  var favicon: Data? = nil
  var canRefresh: Bool = false
}

struct DashboardProvider: TimelineProvider {
  func placeholder(in context: Context) -> DashboardEntry {
    DashboardEntry(date: Date(), snapshot: .preview, canRefresh: true)
  }

  func getSnapshot(in context: Context, completion: @escaping (DashboardEntry) -> Void) {
    let cache = WidgetSnapshotStore.loadCache()
    completion(DashboardEntry(date: Date(), snapshot: context.isPreview ? .preview : cache.snapshot,
                              hasContext: cache.hasContext, favicon: context.isPreview ? nil : cache.favicon,
                              canRefresh: context.isPreview || canRefresh(cache.refreshID)))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<DashboardEntry>) -> Void) {
    let now = Date()
    let cache = WidgetSnapshotStore.loadCache()
    let snapshot = cache.snapshot
    let enabled = canRefresh(cache.refreshID)
    let current = DashboardEntry(date: now, snapshot: snapshot, hasContext: cache.hasContext, favicon: cache.favicon,
                                 canRefresh: enabled)
    var entries = [current]

    if let snapshot, snapshot.reportDate == WidgetSnapshot.reportingDate(now, timeZone: snapshot.timeZone) {
      var calendar = Calendar(identifier: .gregorian)
      calendar.timeZone = TimeZone(identifier: snapshot.timeZone) ?? .gmt
      if let nextDay = calendar.dateInterval(of: .day, for: now)?.end {
        entries.append(DashboardEntry(date: nextDay, snapshot: snapshot,
                                      hasContext: cache.hasContext, favicon: cache.favicon, canRefresh: enabled))
      }
    }

    // Scheduled timelines reread the cache. An explicit button tap fetches live metrics.
    completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(30 * 60))))
  }

  private func canRefresh(_ id: UUID?) -> Bool {
    guard #available(iOS 17.0, *), let id else { return false }
    return WidgetRefreshCredential.load(matching: id) != nil
  }
}

struct DashboardWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: DashboardEntry
  private let dashboardURL = URL(string: "myrabbit://widget")!

  var body: some View {
    Group {
      if let snapshot = entry.snapshot {
        dashboard(snapshot)
      } else {
        emptyState
      }
    }
    .foregroundStyle(WidgetColors.text)
    .widgetURL(dashboardURL)
    .modifier(WidgetBackground())
  }

  @ViewBuilder
  private func dashboard(_ snapshot: WidgetSnapshot) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      header(snapshot)

      switch family {
      case .systemSmall:
        if let metric = snapshot.metrics.first(where: { $0.id == "users" }) {
          MetricView(metric: metric, size: .primary)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
      case .systemMedium:
        HStack(alignment: .top, spacing: 12) {
          ForEach(["users", "pageviews", "bounce_rate"], id: \.self) { id in
            if let metric = snapshot.metrics.first(where: { $0.id == id }) {
              MetricView(metric: metric, size: .compact)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
          }
        }
        .frame(maxHeight: .infinity, alignment: .center)
      default:
        LazyVGrid(columns: [GridItem(.flexible(), alignment: .leading), GridItem(.flexible(), alignment: .leading)], spacing: 8) {
          ForEach(WidgetConstants.metricIDs, id: \.self) { id in
            if let metric = snapshot.metrics.first(where: { $0.id == id }) {
              MetricView(metric: metric, size: .standard)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                .padding(8)
                .background(WidgetColors.surface, in: RoundedRectangle(cornerRadius: 12))
            }
          }
        }
        .frame(maxHeight: .infinity, alignment: .center)
      }

      footer(snapshot)
    }
  }

  private func header(_ snapshot: WidgetSnapshot) -> some View {
    HStack(spacing: 6) {
      if let bytes = entry.favicon, let icon = UIImage(data: bytes) {
        Image(uiImage: icon)
          .resizable()
          .scaledToFit()
          .frame(width: 16, height: 16)
          .clipShape(RoundedRectangle(cornerRadius: 3))
          .accessibilityHidden(true)
      }
      Text(snapshot.siteDomain)
        .font(.caption.weight(.semibold))
        .lineLimit(1)
        .minimumScaleFactor(0.75)
        .truncationMode(.middle)
        .layoutPriority(1)
      Spacer(minLength: 0)
      if #available(iOS 17.0, *), entry.canRefresh {
        Button(intent: RefreshDashboardIntent()) {
          refreshIcon
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Refresh dashboard")
      }
    }
  }

  private var refreshIcon: some View {
    RefreshIcon()
      .stroke(WidgetColors.accent, style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
      .frame(width: 16, height: 16)
      .frame(width: 28, height: 28)
      .contentShape(Rectangle())
  }

  private func footer(_ snapshot: WidgetSnapshot) -> some View {
    let entryDate = WidgetSnapshot.reportingDate(entry.date, timeZone: snapshot.timeZone)
    let formatter = DateFormatter()
    formatter.timeZone = TimeZone(identifier: snapshot.timeZone)
    if WidgetSnapshot.reportingDate(snapshot.updatedDate, timeZone: snapshot.timeZone) != entryDate {
      formatter.dateStyle = .short
    }
    formatter.timeStyle = .short
    let timestamp = formatter.string(from: snapshot.updatedDate)
    let period = reportingPeriod(snapshot, on: entryDate)

    return HStack(spacing: 4) {
      Text("Updated \(timestamp)")
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .accessibilityLabel("Last successful update \(timestamp)")
      Spacer(minLength: 0)
      Text(period.display)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .accessibilityLabel("Reporting period: \(period.accessibility)")
    }
    .font(.system(size: family == .systemSmall ? 9 : 10))
    .foregroundStyle(WidgetColors.muted)
  }

  private func reportingPeriod(_ snapshot: WidgetSnapshot, on entryDate: String) -> (display: String, accessibility: String) {
    let range = snapshot.reportingRange
    let isCurrent = snapshot.reportDate == entryDate
    switch range.preset {
    case .today where isCurrent: return ("Today", "Today")
    case .yesterday where isCurrent: return ("Yesterday", "Yesterday")
    case .last7Days where isCurrent: return ("Last 7 Days", "Last 7 Days")
    case .thisWeek where isCurrent: return ("This Week", "This Week")
    case .last30Minutes: return ("Last 30 Min", "Last 30 Minutes")
    case .last24Hours: return ("Last 24 Hrs", "Last 24 Hours")
    default:
      guard let window = range.windows(anchoredTo: snapshot.reportDate)?.current,
            case let .dates(start, end) = window else { return (snapshot.reportDate, snapshot.reportDate) }
      if start == end { return (start, start) }
      return ("\(start.dropFirst(5))–\(end.dropFirst(5))", "\(start) to \(end)")
    }
  }

  private var emptyState: some View {
    VStack(alignment: .leading, spacing: 9) {
      Spacer(minLength: 0)
      Text(entry.hasContext ? "Waiting for analytics" : "Choose a site")
        .font(.headline)
        .lineLimit(3)
      Text(entry.hasContext ? "Open the app to load analytics." : "Open the app and select a website.")
        .font(.caption)
        .foregroundStyle(WidgetColors.muted)
        .lineLimit(4)
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}

// Lucide RefreshCw, adapted from its SVG path for SwiftUI.
// Copyright (c) 2026 Lucide Icons and Contributors
// Permission to use, copy, modify, and/or distribute this software for any
// purpose with or without fee is hereby granted, provided that the above
// copyright notice and this permission notice appear in all copies.
// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
// WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
// MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
// ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
// WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
// ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
// OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
private struct RefreshIcon: Shape {
  func path(in rect: CGRect) -> Path {
    let scale = min(rect.width, rect.height) / 24
    func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
      CGPoint(x: rect.midX + (x - 12) * scale, y: rect.midY + (y - 12) * scale)
    }
    var path = Path()
    for mirrored in [false, true] {
      func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
        mirrored ? point(24 - x, 24 - y) : point(x, y)
      }
      path.move(to: p(3, 12))
      path.addQuadCurve(to: p(12, 3), control: p(3, 3))
      path.addQuadCurve(to: p(18.74, 5.74), control: p(15.9, 3))
      path.addLine(to: p(21, 8))
      path.move(to: p(21, 3))
      path.addLine(to: p(21, 8))
      path.addLine(to: p(16, 8))
    }
    return path
  }
}

private struct MetricView: View {
  enum Size { case primary, compact, standard }
  @ScaledMetric(relativeTo: .largeTitle) private var primaryFont: CGFloat = 42
  @ScaledMetric(relativeTo: .title2) private var compactFont: CGFloat = 25
  @ScaledMetric(relativeTo: .title2) private var standardFont: CGFloat = 24
  let metric: WidgetMetric
  let size: Size

  private var valueSize: CGFloat {
    switch size {
    case .primary: return min(primaryFont, 54)
    case .compact: return min(compactFont, 32)
    case .standard: return min(standardFont, 26)
    }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: size == .primary ? 5 : 4) {
      Text(metric.label)
        .font(.caption2)
        .foregroundStyle(WidgetColors.muted)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
      Text(metric.value)
        .font(.system(size: valueSize, weight: .semibold, design: .rounded))
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.5)
      if let change = metric.change {
        Text(trendText(change))
          .foregroundStyle(trendColor(change))
          .font(.caption2.weight(.medium))
          .lineLimit(1)
          .minimumScaleFactor(0.7)
      } else {
        Text("No comparison")
          .font(.caption2)
          .foregroundStyle(WidgetColors.muted)
          .lineLimit(1)
          .minimumScaleFactor(0.65)
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("\(metric.label), \(metric.value), \(metric.change.map(trendAccessibilityLabel) ?? "no previous-period comparison")")
  }

  private func trendText(_ change: WidgetMetric.Change) -> String {
    let sign = change.direction == .up ? "+" : change.direction == .down ? "−" : ""
    return "\(sign)\(abs(change.percent).formatted(.number.precision(.fractionLength(0...1))))%"
  }

  private func trendAccessibilityLabel(_ change: WidgetMetric.Change) -> String {
    let direction = change.direction == .up ? "up" : change.direction == .down ? "down" : "unchanged"
    return "\(direction) \(abs(change.percent).formatted(.number.precision(.fractionLength(0...1)))) percent versus the previous period"
  }

  private func trendColor(_ change: WidgetMetric.Change) -> Color {
    switch change.tone {
    case .positive: return WidgetColors.positive
    case .negative: return WidgetColors.negative
    case .neutral: return WidgetColors.muted
    }
  }
}

private struct WidgetBackground: ViewModifier {
  func body(content: Content) -> some View {
    if #available(iOS 17.0, *) {
      content.containerBackground(WidgetColors.background, for: .widget)
    } else {
      content.padding(16).background(WidgetColors.background)
    }
  }
}

@main
struct MyRabbitDashboardWidget: Widget {
  let kind = WidgetConstants.kind

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: DashboardProvider()) { entry in
      DashboardWidgetView(entry: entry)
    }
    .configurationDisplayName("Dashboard Metrics")
    .description("Up to seven days of analytics for the selected MyRabbit site.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}

extension WidgetSnapshot {
  static var preview: WidgetSnapshot {
    WidgetSnapshot(
      version: 1, siteId: "preview", siteDomain: "example.com",
      reportDate: reportingDate(Date(), timeZone: "UTC"), dateRange: nil, timeZone: "UTC",
      updatedAt: Date().timeIntervalSince1970 * 1_000,
      metrics: [
        WidgetMetric(id: "users", label: "Unique Users", value: "15.8k", change: .init(percent: 12.4, direction: .up, tone: .positive)),
        WidgetMetric(id: "sessions", label: "Sessions", value: "18.2k", change: .init(percent: 8.2, direction: .up, tone: .positive)),
        WidgetMetric(id: "pageviews", label: "Pageviews", value: "42.6k", change: .init(percent: 9.1, direction: .up, tone: .positive)),
        WidgetMetric(id: "pages_per_session", label: "Pages / Session", value: "2.34", change: .init(percent: 0.8, direction: .up, tone: .positive)),
        WidgetMetric(id: "bounce_rate", label: "Bounce Rate", value: "38.2%", change: .init(percent: 3.6, direction: .down, tone: .positive)),
        WidgetMetric(id: "session_duration", label: "Session Duration", value: "2m 14s", change: .init(percent: 2.5, direction: .down, tone: .negative))
      ]
    )
  }
}

#if DEBUG
struct DashboardWidgetPreviews: PreviewProvider {
  static var previews: some View {
    Group {
      DashboardWidgetView(entry: DashboardEntry(date: Date(), snapshot: .preview))
        .previewContext(WidgetPreviewContext(family: .systemSmall))
      DashboardWidgetView(entry: DashboardEntry(date: Date(), snapshot: .preview))
        .previewContext(WidgetPreviewContext(family: .systemMedium))
      DashboardWidgetView(entry: DashboardEntry(date: Date(), snapshot: .preview))
        .previewContext(WidgetPreviewContext(family: .systemLarge))
      DashboardWidgetView(entry: DashboardEntry(date: Date(), snapshot: nil))
        .previewContext(WidgetPreviewContext(family: .systemSmall))
    }
  }
}
#endif
