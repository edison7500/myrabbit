import { Slot } from 'expo-router';

// Android and web keep the parent header and their existing tab presentation.
export function TabStack({ title: _title }: { title: string }) {
  return <Slot />;
}
