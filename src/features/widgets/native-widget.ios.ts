import { requireOptionalNativeModule } from 'expo';
import { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY, setItem } from 'expo-secure-store';
import { loadConnection } from '@/storage/connection';
import type { WidgetBridge } from './widget-types';

// Expo Go can still open the app; widgets require a new native build.
export const widgetBridge = requireOptionalNativeModule<WidgetBridge>('MyRabbitWidgets');

export async function saveWidgetRefreshCredential(context: string, serverUrl: string, isCurrent: () => boolean) {
  const connection = await loadConnection();
  if (!isCurrent() || connection?.baseUrl !== serverUrl || !connection.apiKey.trim()) return false;
  const registration = widgetBridge?.refreshRegistration?.(context);
  if (!registration) return false;
  setItem('myrabbit.widget-refresh.v1', JSON.stringify({ id: registration.id, serverUrl, apiKey: connection.apiKey }), {
    accessGroup: registration.accessGroup,
    keychainService: 'myrabbit.widget-refresh',
    keychainAccessible: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  widgetBridge?.reloadWidget?.();
  return true;
}
