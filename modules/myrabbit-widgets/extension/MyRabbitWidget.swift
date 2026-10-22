import SwiftUI
import WidgetKit

private enum WidgetColors {
  static let background = Color(red: 33 / 255, green: 33 / 255, blue: 33 / 255)
  static let surface = Color(red: 44 / 255, green: 44 / 255, blue: 46 / 255)
  static let text = Color(red: 245 / 255, green: 245 / 255, blue: 247 / 255)
  static let muted = Color(red: 168 / 255, green: 168 / 255, blue: 173 / 255)
  static let accent = Color(red: 167 / 255, green: 139 / 255, blue: 250 / 255)
  static let positive = Color(red: 117 / 255, green: 205 / 255, blue: 167 / 255)
  static let negative = Color(red: 255 / 255, green: 155 / 255, blue: 149 / 255)
  static let warning = Color(red: 231 / 255, green: 190 / 255, blue: 119 / 255)
}

struct DashboardEntry: TimelineEntry {
  let date: Date
  let snapshot: WidgetSnapshot?
  var hasContext: Bool = false
}

struct DashboardProvider: TimelineProvider {
  func placeholder(in context: Context) -> DashboardEntry {
    DashboardEntry(date: Date(), snapshot: .preview)
  }

  func getSnapshot(in context: Context, completion: @escaping (DashboardEntry) -> Void) {
    let cache = WidgetSnapshotStore.loadCache()
    completion(DashboardEntry(date: Date(), snapshot: context.isPreview ? .preview : cache.snapshot, hasContext: cache.hasContext))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<DashboardEntry>) -> Void) {
    let now = Date()
    let cache = WidgetSnapshotStore.loadCache()
    let snapshot = cache.snapshot
    var entries = [DashboardEntry(date: now, snapshot: snapshot, hasContext: cache.hasContext)]

    if let snapshot, !snapshot.isStale(at: now) {
      var calendar = Calendar(identifier: .gregorian)
      calendar.timeZone = TimeZone(identifier: snapshot.timeZone) ?? .gmt
      let nextDay = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now)) ?? now.addingTimeInterval(86_400)
      let staleAt = min(snapshot.updatedDate.addingTimeInterval(3_600), nextDay)
      // A dated entry changes the stale label even if iOS delays the next refresh request.
      entries.append(DashboardEntry(date: staleAt, snapshot: snapshot))
    }

    // WidgetKit owns the actual schedule. The extension only rereads the shared cache;
    // the app refreshes analytics while it is running and never shares credentials.
    completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(30 * 60))))
  }
}

struct DashboardWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: DashboardEntry

  var body: some View {
    Group {
      if let snapshot = entry.snapshot {
        dashboard(snapshot)
      } else {
        emptyState
      }
    }
    .foregroundStyle(WidgetColors.text)
    .widgetURL(URL(string: "myrabbit://widget"))
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
    VStack(alignment: .leading, spacing: 3) {
      HStack(spacing: 6) {
        Text("MyRabbit")
          .font(.caption.weight(.semibold))
          .foregroundStyle(WidgetColors.accent)
        if family != .systemSmall {
          Spacer(minLength: 4)
          Text(snapshot.reportDate == WidgetSnapshot.reportingDate(entry.date, timeZone: snapshot.timeZone) ? "Today" : snapshot.reportDate)
            .font(.caption2)
            .foregroundStyle(WidgetColors.muted)
        }
      }
      Text(snapshot.siteDomain)
        .font(.caption2)
        .foregroundStyle(WidgetColors.muted)
        .lineLimit(1)
        .truncationMode(.middle)
    }
  }

  private func footer(_ snapshot: WidgetSnapshot) -> some View {
    let stale = snapshot.isStale(at: entry.date)
    let formatter = DateFormatter()
    formatter.timeZone = TimeZone(identifier: snapshot.timeZone)
    formatter.timeStyle = .short
    formatter.dateStyle = snapshot.reportDate == WidgetSnapshot.reportingDate(entry.date, timeZone: snapshot.timeZone) ? .none : .short
    let timestamp = formatter.string(from: snapshot.updatedDate)

    return HStack(spacing: 4) {
      Text("Updated \(timestamp)")
        .lineLimit(1)
        .minimumScaleFactor(0.75)
      if stale {
        Text("· Cached")
          .foregroundStyle(WidgetColors.warning)
          .fixedSize()
      }
    }
    .font(.system(size: family == .systemSmall ? 9 : 10))
    .foregroundStyle(WidgetColors.muted)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Last successful update \(timestamp). \(stale ? "Cached data. Open MyRabbit to refresh." : "")")
  }

  private var emptyState: some View {
    VStack(alignment: .leading, spacing: 9) {
      Text("MyRabbit")
        .font(.caption.weight(.semibold))
        .foregroundStyle(WidgetColors.accent)
      Spacer(minLength: 0)
      Text(entry.hasContext ? "Waiting for analytics" : "Your dashboard, at a glance")
        .font(.headline)
        .lineLimit(3)
      Text(entry.hasContext ? "Open MyRabbit to load Today’s metrics." : "Open MyRabbit and choose a site to update this widget.")
        .font(.caption)
        .foregroundStyle(WidgetColors.muted)
        .lineLimit(4)
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
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
    .description("Today’s analytics for the last site opened in MyRabbit. Open the app to refresh cached data.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}

extension WidgetSnapshot {
  static var preview: WidgetSnapshot {
    WidgetSnapshot(
      version: 1, siteId: "preview", siteDomain: "example.com",
      reportDate: reportingDate(Date(), timeZone: "UTC"), timeZone: "UTC",
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
