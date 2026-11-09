import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native';

import { Accent, Banner, Button, StateView } from '@/components/state-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, checkIn, fetchRoster, type Registration, type Roster } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

type Notice = { tone: 'success' | 'info' | 'error'; text: string };

export default function RosterScreen() {
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const tournamentId = Number(params.id);
  const { token, signOut } = useAuth();
  const theme = useTheme();

  const [roster, setRoster] = useState<Roster | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState<Notice | null>(null);

  const handleAuth = useCallback(
    async (err: unknown) => {
      if (err instanceof ApiError && (err.isAuthError || err.code === 'ADMIN_REQUIRED')) {
        await signOut();
        return true;
      }
      return false;
    },
    [signOut],
  );

  const load = useCallback(async () => {
    if (!token || !Number.isInteger(tournamentId)) return;
    try {
      const data = await fetchRoster(token, tournamentId);
      setRoster(data);
      setLoadError(null);
    } catch (err) {
      if (await handleAuth(err)) return;
      setLoadError((err as Error).message);
    }
  }, [token, tournamentId, handleAuth]);

  // Load on open and re-sync whenever the screen regains focus.
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

  async function onCheckIn(reg: Registration) {
    if (!token || pending.has(reg.id)) return; // a second tap while in flight is ignored
    setPending((s) => new Set(s).add(reg.id));
    setNotice(null);
    try {
      const result = await checkIn(token, tournamentId, reg.id);
      const { checkedInAt, checkedInBy } = result.checkIn;
      setRoster((r) =>
        r && {
          ...r,
          registrations: r.registrations.map((x) =>
            x.id === reg.id ? { ...x, checkedInAt, checkedInBy, status: 'checked_in' } : x,
          ),
        },
      );
      setNotice(
        result.alreadyCheckedIn
          ? {
              tone: 'info',
              text: `${reg.displayName} was already checked in at ${formatTime(checkedInAt)}${checkedInBy ? ` by ${checkedInBy}` : ''}.`,
            }
          : { tone: 'success', text: `${reg.displayName} is checked in.` },
      );
    } catch (err) {
      if (await handleAuth(err)) return;
      setNotice({ tone: 'error', text: (err as Error).message });
      // 409/404 means the server's view differs from ours; resync the roster.
      if (err instanceof ApiError && (err.status === 409 || err.status === 404)) load();
    } finally {
      setPending((s) => {
        const next = new Set(s);
        next.delete(reg.id);
        return next;
      });
    }
  }

  const filtered = useMemo(() => {
    const list = roster?.registrations ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      [r.displayName, r.name, r.nickname, r.teamName].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [roster, query]);

  const counts = useMemo(() => {
    const list = roster?.registrations ?? [];
    return { done: list.filter((r) => r.checkedInAt).length, total: list.filter((r) => r.eligible).length };
  }, [roster]);

  const title = roster?.tournament.name ?? params.name ?? 'Roster';
  const screen = <Stack.Screen options={{ title, headerBackTitle: 'Back' }} />;

  if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
    return (
      <ThemedView style={styles.fill}>
        {screen}
        <StateView kind="error" title="Invalid tournament" message="Go back and pick a tournament from the list." />
      </ThemedView>
    );
  }
  if (!roster) {
    return (
      <ThemedView style={styles.fill}>
        {screen}
        {loadError ? (
          <StateView kind="error" title="Couldn't load the roster" message={loadError} onRetry={load} />
        ) : (
          <StateView kind="loading" message="Loading participants…" />
        )}
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.fill}>
      {screen}
      <FlatList
        data={filtered}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="smallBold">
              {counts.done} of {counts.total} checked in
            </ThemedText>
            {!roster.checkInOpen ? (
              <Banner tone="error" text={`Check-in is closed: this tournament is ${roster.tournament.status}.`} />
            ) : null}
            {notice ? <Banner tone={notice.tone} text={notice.text} /> : null}
            {loadError ? <Banner tone="error" text={loadError} /> : null}
            <TextInput
              style={[styles.search, { color: theme.text, backgroundColor: theme.backgroundElement }]}
              placeholder="Search name, nickname or team"
              placeholderTextColor={theme.textSecondary}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              clearButtonMode="while-editing"
              accessibilityLabel="Search participants"
            />
          </View>
        }
        ListEmptyComponent={
          <StateView
            kind="empty"
            title={query ? 'No matches' : 'No one has registered yet'}
            message={query ? `Nobody matches "${query}".` : 'Registrations made on the website will appear here.'}
          />
        }
        renderItem={({ item }) => (
          <RegistrationRow
            item={item}
            busy={pending.has(item.id)}
            canCheckIn={roster.checkInOpen}
            onCheckIn={() => onCheckIn(item)}
          />
        )}
      />
    </ThemedView>
  );
}

function RegistrationRow({
  item,
  busy,
  canCheckIn,
  onCheckIn,
}: {
  item: Registration;
  busy: boolean;
  canCheckIn: boolean;
  onCheckIn: () => void;
}) {
  const theme = useTheme();
  const details = [
    item.nickname && item.name && item.nickname !== item.name ? item.name : null,
    item.teamName ? `Team ${item.teamName}` : null,
    item.isGuest ? 'Guest' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  let action: ReactNode;
  if (item.checkedInAt) {
    action = (
      <View style={[styles.done, { backgroundColor: Accent.successSoft }]}>
        <ThemedText type="smallBold" style={{ color: Accent.success }}>
          ✓ {formatTime(item.checkedInAt)}
        </ThemedText>
      </View>
    );
  } else if (!item.eligible) {
    action = (
      <ThemedText type="small" themeColor="textSecondary" style={styles.statusText}>
        {item.status}
      </ThemedText>
    );
  } else {
    action = (
      <Button
        label="Check in"
        variant="success"
        busy={busy}
        disabled={!canCheckIn}
        onPress={onCheckIn}
        accessibilityLabel={`Check in ${item.displayName}`}
      />
    );
  }

  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.rowMain}>
        <ThemedText type="smallBold">{item.displayName}</ThemedText>
        {details ? (
          <ThemedText type="small" themeColor="textSecondary">
            {details}
          </ThemedText>
        ) : null}
        {item.checkedInAt && item.checkedInBy ? (
          <ThemedText type="small" themeColor="textSecondary">
            by {item.checkedInBy}
          </ThemedText>
        ) : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  listContent: {
    padding: Spacing.three,
    gap: Spacing.two,
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: { gap: Spacing.two, marginBottom: Spacing.two },
  search: { minHeight: 44, borderRadius: 10, paddingHorizontal: Spacing.three, fontSize: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 12,
  },
  rowMain: { flex: 1, gap: Spacing.half },
  done: { minHeight: 44, minWidth: 96, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statusText: { textTransform: 'capitalize' },
});
