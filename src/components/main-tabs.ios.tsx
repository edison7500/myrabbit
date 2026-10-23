import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTheme } from '@/stores/theme';

// UIKit needs image sources: these templates are exported from lucide-react-native.
// Leave the material and geometry to iOS so system appearance/accessibility apply.
export function MainTabs() {
  const { colors } = useTheme();
  return <NativeTabs tintColor={colors.accent} minimizeBehavior="never"
    iconColor={{ default: colors.muted, selected: colors.accent }}
    labelStyle={{ default: { color: colors.muted }, selected: { color: colors.accent } }}>
    <NativeTabs.Trigger name="overview" contentStyle={{ backgroundColor: colors.background }}>
      <NativeTabs.Trigger.Icon renderingMode="template" src={{
        default: require('../../assets/icons/tabs/chart-no-axes-combined.png'),
        selected: require('../../assets/icons/tabs/chart-no-axes-combined-selected.png'),
      }} />
      <NativeTabs.Trigger.Label>Dashboard</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
    <NativeTabs.Trigger name="realtime" contentStyle={{ backgroundColor: colors.background }}>
      <NativeTabs.Trigger.Icon renderingMode="template" src={{
        default: require('../../assets/icons/tabs/radio.png'),
        selected: require('../../assets/icons/tabs/radio-selected.png'),
      }} />
      <NativeTabs.Trigger.Label>Realtime</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
    <NativeTabs.Trigger name="explore" contentStyle={{ backgroundColor: colors.background }}>
      <NativeTabs.Trigger.Icon renderingMode="template" src={{
        default: require('../../assets/icons/tabs/compass.png'),
        selected: require('../../assets/icons/tabs/compass-selected.png'),
      }} />
      <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
    <NativeTabs.Trigger name="settings" contentStyle={{ backgroundColor: colors.background }}>
      <NativeTabs.Trigger.Icon renderingMode="template" src={{
        default: require('../../assets/icons/tabs/settings-2.png'),
        selected: require('../../assets/icons/tabs/settings-2-selected.png'),
      }} />
      <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
  </NativeTabs>;
}
