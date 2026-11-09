import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const Accent = {
  primary: '#208AEF',
  success: '#1F9D55',
  successSoft: 'rgba(31,157,85,0.14)',
  danger: '#D93F3F',
  dangerSoft: 'rgba(217,63,63,0.14)',
  info: 'rgba(32,138,239,0.14)',
} as const;

/** Centered full-area state: loading spinner, empty message, or error with retry. */
export function StateView({
  kind,
  title,
  message,
  onRetry,
}: {
  kind: 'loading' | 'empty' | 'error';
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      {kind === 'loading' ? <ActivityIndicator size="large" color={theme.textSecondary} /> : null}
      {title ? (
        <ThemedText type="smallBold" style={styles.centerText}>
          {title}
        </ThemedText>
      ) : null}
      {message ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          {message}
        </ThemedText>
      ) : null}
      {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function Button({
  label,
  variant = 'primary',
  busy,
  disabled,
  ...rest
}: PressableProps & { label: string; variant?: 'primary' | 'secondary' | 'success'; busy?: boolean }) {
  const theme = useTheme();
  const isDisabled = disabled || busy;
  const bg =
    variant === 'primary' ? Accent.primary : variant === 'success' ? Accent.success : theme.backgroundElement;
  const fg = variant === 'secondary' ? theme.text : '#ffffff';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!busy }}
      disabled={isDisabled}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: isDisabled ? 0.55 : pressed ? 0.8 : 1 }]}
      {...rest}>
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <ThemedText type="smallBold" style={{ color: fg }}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

export function Banner({ tone, text }: { tone: 'success' | 'info' | 'error'; text: string }) {
  const bg = tone === 'success' ? Accent.successSoft : tone === 'error' ? Accent.dangerSoft : Accent.info;
  return (
    <View style={[styles.banner, { backgroundColor: bg }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <ThemedText type="small">{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  centerText: { textAlign: 'center' },
  button: {
    minHeight: 44,
    minWidth: 96,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
