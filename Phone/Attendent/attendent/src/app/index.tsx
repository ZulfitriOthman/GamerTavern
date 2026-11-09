import { Link, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner, Button, StateView } from '@/components/state-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, fetchTournaments, type Tournament } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/config';

export default function HomeScreen() {
  const { status } = useAuth();
  return (
    <ThemedView style={styles.fill}>
      {status === 'restoring' ? (
        <>
          <Stack.Screen options={{ title: 'Attendent' }} />
          <StateView kind="loading" message="Restoring your session…" />
        </>
      ) : status === 'signedOut' ? (
        <SignIn />
      ) : (
        <TournamentList />
      )}
    </ThemedView>
  );
}

/* ------------------------------- Sign in ------------------------------- */

function SignIn() {
  const { signIn } = useAuth();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'Wrong email or password.' : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Attendent', headerShown: false }} />
      <SafeAreaView style={styles.signInWrap}>
        <View style={styles.signInCard}>
          <ThemedText type="subtitle">Attendent</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Tournament check-in for Gamer Tavern staff. Sign in with your admin account.
          </ThemedText>

          <TextInput
            style={inputStyle}
            placeholder="Email"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            value={email}
            onChangeText={setEmail}
            editable={!busy}
            accessibilityLabel="Email"
          />
          <TextInput
            style={inputStyle}
            placeholder="Password"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
            editable={!busy}
            accessibilityLabel="Password"
          />

          {error ? <Banner tone="error" text={error} /> : null}
          <Button label="Sign in" onPress={submit} busy={busy} disabled={!canSubmit} />

          <ThemedText type="code" themeColor="textSecondary" style={styles.server}>
            Server: {API_BASE_URL}
          </ThemedText>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

/* ---------------------------- Tournament list ---------------------------- */

function TournamentList() {
  const { token, user, signOut } = useAuth();
  const [items, setItems] = useState<Tournament[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchTournaments(token);
      setItems(data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && (err.isAuthError || err.code === 'ADMIN_REQUIRED')) {
        await signOut();
        return;
      }
      setError((err as Error).message);
    }
  }, [token, signOut]);

  // Reload whenever this screen regains focus (e.g. back from a roster) so counts stay current.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const header = (
    <Stack.Screen
      options={{
        title: 'Check-in',
        headerRight: () => (
          <Pressable onPress={signOut} hitSlop={12} accessibilityRole="button">
            <ThemedText type="linkPrimary">Sign out</ThemedText>
          </Pressable>
        ),
      }}
    />
  );

  if (items === null && error) {
    return (
      <>
        {header}
        <StateView kind="error" title="Couldn't load tournaments" message={error} onRetry={load} />
      </>
    );
  }
  if (items === null) {
    return (
      <>
        {header}
        <StateView kind="loading" message="Loading tournaments…" />
      </>
    );
  }

  return (
    <>
      {header}
      <FlatList
        data={items}
        keyExtractor={(t) => String(t.id)}
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <ThemedText type="small" themeColor="textSecondary">
              Signed in as {user?.name ?? 'admin'}. Pick a tournament to check people in.
            </ThemedText>
            {error ? <Banner tone="error" text={error} /> : null}
          </View>
        }
        ListEmptyComponent={
          <StateView
            kind="empty"
            title="No tournaments open for check-in"
            message="Tournaments appear here once they are open or closed for registration. Pull down to refresh."
          />
        }
        renderItem={({ item }) => <TournamentRow item={item} />}
      />
    </>
  );
}

function TournamentRow({ item }: { item: Tournament }) {
  const theme = useTheme();
  const when = item.startDate ? new Date(item.startDate).toLocaleString() : 'Date to be announced';
  const meta = [item.gameName, item.registrationType === 'team' ? 'Teams' : 'Individual', item.location]
    .filter(Boolean)
    .join(' · ');
  return (
    <Link href={{ pathname: '/tournament/[id]', params: { id: String(item.id), name: item.name } }} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Opens the check-in roster"
        style={({ pressed }) => [styles.card, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 }]}>
        <View style={styles.cardMain}>
          <ThemedText type="smallBold">{item.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {when}
          </ThemedText>
          {meta ? (
            <ThemedText type="small" themeColor="textSecondary">
              {meta}
            </ThemedText>
          ) : null}
        </View>
        <View style={styles.count}>
          <ThemedText type="smallBold">
            {item.checkedInCount}/{item.eligibleCount}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            checked in
          </ThemedText>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  signInWrap: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  signInCard: { gap: Spacing.three, width: '100%', maxWidth: 420, alignSelf: 'center' },
  input: { minHeight: 48, borderRadius: 10, paddingHorizontal: Spacing.three, fontSize: 16 },
  server: { textAlign: 'center' },
  listContent: {
    padding: Spacing.three,
    gap: Spacing.two,
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  listHeader: { gap: Spacing.two, marginBottom: Spacing.two },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 12,
  },
  cardMain: { flex: 1, gap: Spacing.half },
  count: { alignItems: 'flex-end' },
});
