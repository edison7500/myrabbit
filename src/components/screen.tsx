import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { Children, type PropsWithChildren, type ReactNode } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, spacing, typography } from '@/constants/theme';

export type ScreenSection = { key: string; header: ReactNode; content: ReactNode };
type Props = PropsWithChildren<{ title: string; description: ReactNode; navigationHeader?: boolean; tabScreen?: boolean; refreshing?: boolean; onRefresh?: () => void; sections?: readonly ScreenSection[] }>;

export function Screen({ title, description, children, navigationHeader = false, tabScreen = false, refreshing = false, onRefresh, sections }: Props) {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  const insets = useSafeAreaInsets();
  const automaticInsets = process.env.EXPO_OS === 'ios' && navigationHeader;
  const floatingTabs = tabScreen && process.env.EXPO_OS === 'web';
  const showHeading = !navigationHeader || description != null;
  const introductoryContent = Children.toArray(children);
  const stickyHeaderIndices = sections?.map((_, index) => (showHeading ? 1 : 0) + introductoryContent.length + index * 2);
  return (
    <SafeAreaView style={styles.safeArea} edges={{ top: navigationHeader ? 'off' : 'additive', bottom: tabScreen || automaticInsets ? 'off' : 'additive', left: 'additive', right: 'additive' }}>
      <ScrollView stickyHeaderIndices={stickyHeaderIndices} contentInsetAdjustmentBehavior={automaticInsets ? 'automatic' : 'never'} automaticallyAdjustContentInsets={automaticInsets} alwaysBounceVertical={automaticInsets || !!onRefresh} refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} /> : undefined} contentContainerStyle={[styles.content, sections && { gap: 0 }, floatingTabs && { paddingBottom: 102 + insets.bottom }]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag">
        {showHeading ? <View style={[styles.heading, navigationHeader && { paddingTop: 0 }, sections && styles.sectionContent]}>
          {!navigationHeader ? <>
            <Text style={styles.brand}>MyRabbit</Text>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          </> : null}
          {typeof description === 'string' ? <Text style={styles.description}>{description}</Text> : description}
        </View> : null}
        {sections ? introductoryContent.map((child, index) => <View key={`intro-${index}`} style={styles.sectionContent}>{child}</View>) : children}
        {sections?.flatMap(section => [
          <View key={`${section.key}-header`} style={styles.sectionHeader}>{section.header}</View>,
          <View key={`${section.key}-content`} style={styles.sectionContent}>{section.content}</View>,
        ])}
      </ScrollView>
    </SafeAreaView>
  );
}

const themedStyles = createThemedStyles(colors => ({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, width: '100%', maxWidth: layout.contentWidth, alignSelf: 'center', padding: layout.screenPadding, gap: spacing.xxl },
  heading: { gap: 8, paddingTop: 12 },
  sectionHeader: { backgroundColor: colors.background, paddingVertical: spacing.sm },
  sectionContent: { paddingBottom: 24, paddingTop: 12 },
  brand: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  title: { ...typography.title, color: colors.text },
  description: { ...typography.body, color: colors.muted },
}));
