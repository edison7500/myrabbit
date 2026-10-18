import { createThemedStyles } from '@/constants/themed-styles';
import { Host, Picker, Row, Spacer, Text as NativeText } from '@expo/ui';
import { Text, View } from 'react-native';
import { Surface } from '@/components/analytics-ui';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/stores/theme';

export function AppearanceSettings() {
  const { colors, scheme, preference, ready, saving, error, setPreference } = useTheme();
  const styles = themedStyles[scheme];
  return <View style={styles.group}>
    <Text style={styles.label}>APPEARANCE</Text>
    <Surface style={styles.card}>
      <Host colorScheme={scheme} seedColor={colors.accent} matchContents={{ vertical: true }} ignoreSafeArea="all" style={{ alignSelf: 'stretch' }}>
        <Row alignment="center" spacing={12}>
          <NativeText textStyle={{ color: colors.text, fontSize: 17 }}>Theme</NativeText>
          <Spacer flexible />
          <Picker testID="appearance-picker" selectedValue={preference} enabled={ready && !saving}
            onValueChange={value => { void setPreference(value); }}>
            <Picker.Item label="Auto" value="auto" />
            <Picker.Item label="Light" value="light" />
            <Picker.Item label="Dark" value="dark" />
          </Picker>
        </Row>
      </Host>
    </Surface>
    <Text style={styles.help}>Auto follows your device’s appearance.</Text>
    {error ? <Text selectable accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}

const themedStyles = createThemedStyles(colors => ({
  group: { gap: spacing.sm },
  label: { color: colors.muted, fontSize: 13, paddingHorizontal: spacing.lg },
  card: { padding: spacing.lg },
  help: { color: colors.muted, fontSize: 13, lineHeight: 20, paddingHorizontal: spacing.lg },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20, paddingHorizontal: spacing.lg },
}));
