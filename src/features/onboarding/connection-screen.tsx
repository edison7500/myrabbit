import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react-native';
import { Host, Picker, Row, Spacer, Text as NativeText } from '@expo/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSession } from '@/stores/session';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { ConnectionTestGate } from './connection-test';

import { Screen } from '@/components/screen';
import { radii } from '@/constants/theme';
import { CLOUD_URL, loadConnection, saveConnection, type HostingMode } from '@/storage/connection';

export default function ConnectionScreen() {
  const { colors, scheme } = useTheme();
  const styles = themedStyles[scheme];
  const router = useRouter();
  const { connected, serverUrl } = useSession();
  const { action } = useLocalSearchParams<{ action?: string }>();
  const adding = action === 'add';
  const [mode, setMode] = useState<HostingMode>('cloud');
  const [selfHostUrl, setSelfHostUrl] = useState('');
  const [keys, setKeys] = useState({ cloud: '', 'self-host': '' });
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [success, setSuccess] = useState('');
  const [gate] = useState(() => new ConnectionTestGate());
  const mounted = useRef(true);
  const testingRef = useRef(false);
  const savingRef = useRef(false);
  const keyInput = useRef<TextInput>(null);
  const baseUrl = mode === 'cloud' ? CLOUD_URL : selfHostUrl;
  const apiKey = keys[mode];

  useEffect(() => {
    let active = true;
    mounted.current = true;
    loadConnection().then((config) => {
      if (!active || !config || adding) return;
      setMode(config.mode);
      if (config.mode === 'self-host') setSelfHostUrl(config.baseUrl);
      setKeys((current) => ({ ...current, [config.mode]: config.apiKey }));
    }).catch(() => {
      if (active) setError('Could not load your saved configuration. Please enter it again.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; mounted.current = false; gate.invalidate(); };
  }, [adding, gate]);

  function clearFeedback() {
    gate.invalidate();
    testingRef.current = false;
    setTesting(false);
    setSuccess('');
    setError('');
  }

  async function test() {
    if (testingRef.current || savingRef.current || loading) return;
    setError('');
    setSuccess('');
    testingRef.current = true;
    setTesting(true);
    try {
      const result = await gate.test({ mode, baseUrl, apiKey });
      if (!mounted.current || !result) return;
      setSuccess(result.organizationCount ? 'Connection verified. Ready to save.' : 'Connection verified. No accessible organizations yet.');
    } catch (issue) {
      if (mounted.current && !(issue instanceof Error && issue.name === 'AbortError')) {
        setError(issue instanceof Error ? issue.message : 'Unknown connection error. Please try again.');
      }
    } finally {
      testingRef.current = false;
      if (mounted.current) setTesting(false);
    }
  }

  async function save() {
    if (savingRef.current || testingRef.current || loading || !success) return;
    setError('');
    savingRef.current = true;
    setSaving(true);
    try {
      const config = await gate.save({ mode, baseUrl, apiKey }, saveConnection);
      if (!mounted.current) return;
      setShowKey(false);
      await connected(config.baseUrl);
      router.dismissTo('/');
    } catch {
      if (mounted.current) setError('Could not save your configuration. Please try again.');
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <Screen navigationHeader title="Connect to Rybbit" description="Your analytics, on your own terms. Choose where your Rybbit lives.">
      {adding && serverUrl ? <Text style={styles.note}>MyRabbit currently saves one connection. Saving this connection will replace the saved connection on this device.</Text> : null}
      <View style={styles.card}>
        <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={colors.accent} style={{ width: '100%' }}>
          <Row alignment="center" spacing={12}>
            <NativeText textStyle={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Hosting</NativeText>
            <Spacer flexible />
            <Picker selectedValue={mode} enabled={!loading && !saving && !testing} onValueChange={(value: HostingMode) => {
              setMode(value);
              setShowKey(false);
              clearFeedback();
            }}>
              <Picker.Item label="Cloud" value="cloud" />
              <Picker.Item label="Self-host" value="self-host" />
            </Picker>
          </Row>
        </Host>
        <Text style={styles.note}>{mode === 'cloud' ? 'Use the official Rybbit Cloud service.' : 'Connect to your own Rybbit installation.'}</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Server URL</Text>
          <TextInput accessibilityLabel="Server URL" style={[styles.input, mode === 'cloud' && styles.readOnly]} value={baseUrl}
            editable={mode === 'self-host' && !loading && !saving && !testing} onChangeText={(value) => { setSelfHostUrl(value); clearFeedback(); }}
            placeholder="https://analytics.example.com" placeholderTextColor={colors.muted} keyboardType="url" keyboardAppearance={scheme} selectionColor={colors.accent}
            autoCapitalize="none" autoCorrect={false} autoComplete="off" returnKeyType="next" onSubmitEditing={() => keyInput.current?.focus()} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>API Key</Text>
          <View style={styles.keyRow}>
            <TextInput ref={keyInput} accessibilityLabel="API Key" style={styles.keyInput} value={apiKey}
              editable={!loading && !saving && !testing} onChangeText={(value) => { setKeys((current) => ({ ...current, [mode]: value })); clearFeedback(); }}
              placeholder="Enter your API key" placeholderTextColor={colors.muted} secureTextEntry={!showKey} keyboardAppearance={scheme} selectionColor={colors.accent}
              autoCapitalize="none" autoCorrect={false} autoComplete="off" returnKeyType="done" onSubmitEditing={test} />
            <Pressable accessibilityRole="button" accessibilityLabel={showKey ? 'Hide API key' : 'Show API key'} onPress={() => setShowKey(!showKey)} style={styles.showButton}>
              {showKey ? <EyeOff size={20} color={colors.muted} accessible={false} /> : <Eye size={20} color={colors.muted} accessible={false} />}
            </Pressable>
          </View>
          <Text style={styles.note}>Create an API key in your Rybbit dashboard settings.</Text>
        </View>
        {loading ? <ActivityIndicator color={colors.accent} accessibilityLabel="Loading configuration" /> : null}
        {error ? <Text selectable accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {success ? <Text selectable accessibilityLiveRegion="polite" style={styles.success}>{success}</Text> : null}
        <Pressable accessibilityRole="button" disabled={loading || saving || testing}
          accessibilityState={{ disabled: loading || saving || testing, busy: testing }} onPress={test}
          style={[styles.button, styles.testButton, (loading || saving || testing) && { opacity: 0.6 }]}>
          {testing ? <ActivityIndicator color={colors.accent} accessibilityLabel="Testing connection" /> : null}
          <Text style={[styles.buttonText, { color: colors.accent }]}>{testing ? 'Testing connection…' : 'Test Connection'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={!success || loading || saving || testing}
          accessibilityState={{ disabled: !success || loading || saving || testing, busy: saving }} onPress={save}
          style={[styles.button, (!success || loading || saving || testing) && { opacity: 0.4 }]}>
          <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save & Continue'}</Text>
          {!saving ? <ArrowRight size={20} color={colors.onAccent} accessible={false} /> : null}
        </Pressable>
        <View style={styles.privacy}><ShieldCheck size={18} color={colors.muted} accessible={false} /><Text style={[styles.note, { flex: 1 }]}>{process.env.EXPO_OS === 'web' ? 'For this browser preview, your key stays in memory and is cleared on refresh.' : 'Your API key is stored securely on this device.'}</Text></View>
      </View>
    </Screen>
  );
}

const themedStyles = createThemedStyles(colors => ({
  card: { backgroundColor: colors.surface, borderRadius: radii.card, borderCurve: 'continuous', padding: 20, gap: 20 },
  field: { gap: 9 },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  input: { minHeight: 52, backgroundColor: colors.secondarySurface, borderRadius: 16, paddingHorizontal: 14, color: colors.text, fontSize: 17 },
  readOnly: { backgroundColor: colors.background, color: colors.muted },
  keyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.secondarySurface, borderRadius: 16 },
  keyInput: { flex: 1, minWidth: 0, minHeight: 52, paddingHorizontal: 14, color: colors.text, fontSize: 17 },
  showButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 14 },
  showText: { color: colors.accent, fontWeight: '600' },
  note: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21 },
  success: { color: colors.positive, fontSize: 14, lineHeight: 21 },
  privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  button: { flexDirection: 'row', gap: 10, minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: colors.accent },
  buttonText: { color: colors.onAccent, fontSize: 16, fontWeight: '600' },
  testButton: { backgroundColor: colors.accentSurface },
  link: { color: colors.accent, fontSize: 16, fontWeight: '600', paddingVertical: 8 },
}));
