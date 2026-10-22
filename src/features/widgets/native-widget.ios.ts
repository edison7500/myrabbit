import { requireOptionalNativeModule } from 'expo';
import type { WidgetBridge } from './widget-types';

// Expo Go can still open the app; widgets require a new native build.
export const widgetBridge = requireOptionalNativeModule<WidgetBridge>('MyRabbitWidgets');
