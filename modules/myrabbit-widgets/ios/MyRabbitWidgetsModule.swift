import ExpoModulesCore
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
  }
}
