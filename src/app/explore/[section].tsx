import { Redirect, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import ChartDetailScreen from '@/features/explore/chart-detail-screen';
import { rankingSections, type RankingSection } from '@/features/explore/explore-charts';

export default function ExploreDetailRoute() {
  const { section, kind } = useLocalSearchParams<{ section: string; kind?: string }>();
  if (!Object.hasOwn(rankingSections, section)) return <Redirect href="/(tabs)/explore" />;
  const rankingSection = rankingSections[section as RankingSection];
  const selectedKind = rankingSection.choices.find(choice => choice.value === kind)?.value;
  return <>
    <Stack.Screen options={{ title: rankingSection.title }} />
    <ChartDetailScreen section={section as RankingSection} kind={selectedKind} />
  </>;
}
