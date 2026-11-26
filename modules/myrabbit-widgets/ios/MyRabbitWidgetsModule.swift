import ExpoModulesCore
import ImageIO
import UIKit
import WidgetKit

public final class MyRabbitWidgetsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MyRabbitWidgets")

    Function("setContext") { (context: String?) throws in
      try WidgetSnapshotStore.setContext(context)
      WidgetCenter.shared.reloadTimelines(ofKind: WidgetConstants.kind)
    }

    Function("writeSnapshot") { (context: String, json: String) throws in
      try WidgetSnapshotStore.writeSnapshot(context: context, json: json)
      WidgetCenter.shared.reloadTimelines(ofKind: WidgetConstants.kind)
    }

    Function("refreshRegistration") { (context: String) -> [String: String]? in
      guard #available(iOS 17.0, *) else { return nil }
      return WidgetSnapshotStore.refreshRegistration(context: context)
    }

    Function("reloadWidget") {
      WidgetCenter.shared.reloadTimelines(ofKind: WidgetConstants.kind)
    }

    AsyncFunction("writeFavicon") { (context: String, domain: String, base64: String) throws -> Bool in
      // Thumbnail decoding supports ICO and raster favicons. Only a small PNG
      // goes into the shared container, even when the source is much larger.
      guard base64.utf8.count <= 1_398_104, let bytes = Data(base64Encoded: base64),
            let source = CGImageSourceCreateWithData(bytes as CFData, nil),
            let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, [
              kCGImageSourceCreateThumbnailFromImageAlways: true,
              kCGImageSourceThumbnailMaxPixelSize: 64,
              kCGImageSourceCreateThumbnailWithTransform: true,
            ] as CFDictionary),
            let png = UIImage(cgImage: thumbnail).pngData() else { return false }
      if try WidgetSnapshotStore.writeFavicon(context: context, domain: domain, png: png) {
        WidgetCenter.shared.reloadTimelines(ofKind: WidgetConstants.kind)
      }
      return true
    }
  }
}
