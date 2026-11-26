import type { WidgetBridge } from './widget-types';

// Android, web, and their bundles never load the iOS native module.
export const widgetBridge: WidgetBridge | null = null;
export const saveWidgetRefreshCredential: typeof import('./native-widget.ios').saveWidgetRefreshCredential = async () => false;
