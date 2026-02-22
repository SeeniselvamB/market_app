// src/components/UIComponents.tsx
// Shared, reusable UI building blocks used across all screens.
// ALL Text elements use Times New Roman via TNR / TNR_BOLD font family.

import React, { useState, useEffect, forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  TextInputProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { COLORS, FONTS, TNR, TNR_BOLD, SPACING, RADIUS, SHADOW } from '../utils/theme';

// ── Card ──────────────────────────────────────────────────────
interface CardProps { children: React.ReactNode; style?: ViewStyle; }
export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ── Card Header ───────────────────────────────────────────────
interface CardHeaderProps { title: string; right?: React.ReactNode; }
export function CardHeader({ title, right }: CardHeaderProps) {
  return (
    <View style={styles.cardHeader}>
      <Text style={styles.cardTitle}>{title}</Text>
      {right}
    </View>
  );
}

// ── Button ────────────────────────────────────────────────────
interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'danger' | 'orange' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  full?: boolean;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  style?: ViewStyle;
}
export function Button({
  label, onPress, variant = 'primary', size = 'md',
  full = false, loading = false, disabled = false, icon, style,
}: ButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.btn,
        styles[`btn_${variant}` as keyof typeof styles] as ViewStyle,
        styles[`btn_${size}` as keyof typeof styles] as ViewStyle,
        full && styles.btn_full,
        (disabled || loading) && styles.btn_disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? COLORS.green : COLORS.white}
          size="small"
        />
      ) : (
        <Text style={[
          styles.btnText,
          styles[`btnText_${variant}` as keyof typeof styles] as TextStyle,
          styles[`btnText_${size}` as keyof typeof styles] as TextStyle,
        ]}>
          {icon ? `${icon}  ` : ''}{label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ── Icon Button ───────────────────────────────────────────────
interface IconBtnProps { icon: string; onPress: () => void; color?: string; style?: ViewStyle; }
export function IconBtn({ icon, onPress, color, style }: IconBtnProps) {
  return (
    <TouchableOpacity style={[styles.iconBtn, style]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.iconBtnText, color ? { color } : {}]}>{icon}</Text>
    </TouchableOpacity>
  );
}

// ── Input ─────────────────────────────────────────────────────
interface InputProps extends TextInputProps { label?: string; style?: ViewStyle; inputStyle?: TextStyle; }
export const Input = forwardRef<TextInput, InputProps>(({ label, style, inputStyle, ...props }, ref) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.inputGroup, style]}>
      {label && <Text style={styles.inputLabel}>{label}</Text>}
      <TextInput
        ref={ref}
        style={[styles.input, focused && styles.inputFocused, inputStyle]}
        placeholderTextColor={COLORS.gray}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
    </View>
  );
});

// ── Badge ─────────────────────────────────────────────────────
interface BadgeProps { label: string; variant?: 'green' | 'orange' | 'red' | 'gray'; style?: ViewStyle; }
export function Badge({ label, variant = 'gray', style }: BadgeProps) {
  return (
    <View style={[styles.badge, styles[`badge_${variant}` as keyof typeof styles] as ViewStyle, style]}>
      <Text style={[styles.badgeText, styles[`badgeText_${variant}` as keyof typeof styles] as TextStyle]}>
        {label}
      </Text>
    </View>
  );
}

// ── Section Header ────────────────────────────────────────────
interface SectionHeaderProps { title: string; subtitle?: string; right?: React.ReactNode; }
export function SectionHeader({ title, subtitle, right }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

// ── Empty State ───────────────────────────────────────────────
interface EmptyStateProps { icon: string; message: string; }
export function EmptyState({ icon, message }: EmptyStateProps) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

// ── Stat Card ─────────────────────────────────────────────────
interface StatCardProps { value: string; label: string; color?: string; style?: ViewStyle; }
export function StatCard({ value, label, color = COLORS.green, style }: StatCardProps) {
  return (
    <View style={[styles.statCard, style]}>
      <Text style={[styles.statValue, { color }]} numberOfLines={2} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={2} textBreakStrategy="balanced">{label}</Text>
    </View>
  );
}

// ── Divider ───────────────────────────────────────────────────
export function Divider({ style }: { style?: ViewStyle }) {
  return <View style={[styles.divider, style]} />;
}

// ── Bill Row ──────────────────────────────────────────────────
interface RowProps { left: string; right: string; bold?: boolean; color?: string; style?: ViewStyle; }
export function BillRow({ left, right, bold = false, color, style }: RowProps) {
  return (
    <View style={[styles.billRow, style]}>
      <Text style={[styles.billRowLeft, bold && styles.billRowBold]}>{left}</Text>
      <Text style={[styles.billRowRight, bold && styles.billRowBold, color ? { color } : {}]}>{right}</Text>
    </View>
  );
}

// ── List Item ─────────────────────────────────────────────────
interface ListItemProps { title: string; subtitle?: string; right?: React.ReactNode; onPress?: () => void; }
export function ListItem({ title, subtitle, right, onPress }: ListItemProps) {
  const Wrapper: any = onPress ? TouchableOpacity : View;
  return (
    <Wrapper style={styles.listItem} onPress={onPress} activeOpacity={0.7}>
      <View style={{ flex: 1 }}>
        <Text style={styles.listItemTitle}>{title}</Text>
        {subtitle ? <Text style={styles.listItemSub}>{subtitle}</Text> : null}
      </View>
      {right && <View style={styles.listItemRight}>{right}</View>}
    </Wrapper>
  );
}

// ── Toast (self-dismissing) ───────────────────────────────────
interface ToastProps { message: string; type?: 'default' | 'success' | 'error'; visible: boolean; onHide: () => void; }
export function Toast({ message, type = 'default', visible, onHide }: ToastProps) {
  const [opacity] = useState(new Animated.Value(0));
  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2200),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => onHide());
    }
  }, [visible]);
  if (!visible) return null;
  const bg = type === 'success' ? COLORS.green : type === 'error' ? COLORS.red : COLORS.dark;
  return (
    <Animated.View style={[styles.toast, { backgroundColor: bg, opacity }]}>
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

// ── Styles — ALL text uses TNR / TNR_BOLD ─────────────────────
const styles = StyleSheet.create({
  // Card
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    padding: SPACING.lg, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, ...SHADOW.small,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  cardTitle: { fontSize: 16, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.dark },

  // Button
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm, paddingHorizontal: SPACING.lg },
  btn_full: { width: '100%' },
  btn_disabled: { opacity: 0.5 },
  btn_primary: { backgroundColor: COLORS.green },
  btn_outline: { backgroundColor: COLORS.white, borderWidth: 2, borderColor: COLORS.green },
  btn_danger: { backgroundColor: COLORS.red },
  btn_orange: { backgroundColor: COLORS.orange },
  btn_ghost: { backgroundColor: 'transparent' },
  btn_sm: { paddingVertical: 7, paddingHorizontal: 12 },
  btn_md: { paddingVertical: 11, paddingHorizontal: 18 },
  btn_lg: { paddingVertical: 14, paddingHorizontal: 24 },
  btnText: { fontFamily: TNR_BOLD, fontWeight: '700' },
  btnText_primary: { color: COLORS.white },
  btnText_outline: { color: COLORS.green },
  btnText_danger: { color: COLORS.white },
  btnText_orange: { color: COLORS.white },
  btnText_ghost: { color: COLORS.green },
  btnText_sm: { fontSize: 13 },
  btnText_md: { fontSize: 14 },
  btnText_lg: { fontSize: 16 },

  // Icon button
  iconBtn: { width: 36, height: 36, borderRadius: RADIUS.full, backgroundColor: COLORS.grayLight, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontSize: 16 },

  // Input
  inputGroup: { marginBottom: SPACING.md },
  inputLabel: { fontSize: 12, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.gray, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 2, borderColor: COLORS.border, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: 11, fontSize: 15, color: COLORS.dark, backgroundColor: COLORS.white, fontFamily: TNR },
  inputFocused: { borderColor: COLORS.green },

  // Badge
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.full },
  badge_green: { backgroundColor: COLORS.greenPale },
  badge_orange: { backgroundColor: '#FFF3E0' },
  badge_red: { backgroundColor: COLORS.redLight },
  badge_gray: { backgroundColor: COLORS.grayLight },
  badgeText: { fontSize: 12, fontFamily: TNR_BOLD, fontWeight: '700' },
  badgeText_green: { color: COLORS.green },
  badgeText_orange: { color: COLORS.orange },
  badgeText_red: { color: COLORS.red },
  badgeText_gray: { color: COLORS.gray },

  // Section Header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  sectionTitle: { fontSize: 22, fontFamily: TNR_BOLD, fontWeight: '800', color: COLORS.dark },
  sectionSub: { fontSize: 13, fontFamily: TNR, color: COLORS.gray, marginTop: 2 },

  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, fontFamily: TNR, color: COLORS.gray, textAlign: 'center' },

  // Stat Card
  statCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, ...SHADOW.small, width: '47%', minHeight: 90, justifyContent: 'center' },
  statValue: { fontSize: 20, fontFamily: TNR_BOLD, fontWeight: '800', textAlign: 'center' },
  statLabel: { fontSize: 11, fontFamily: TNR_BOLD, color: COLORS.gray, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4, textAlign: 'center', lineHeight: 14 },

  // Divider
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.md },

  // Bill Row
  billRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  billRowLeft: { fontSize: 14, fontFamily: TNR, color: COLORS.dark },
  billRowRight: { fontSize: 14, fontFamily: TNR, color: COLORS.dark },
  billRowBold: { fontFamily: TNR_BOLD, fontWeight: '700', fontSize: 16 },

  // List Item
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  listItemTitle: { fontSize: 15, fontFamily: TNR_BOLD, fontWeight: '600', color: COLORS.dark },
  listItemSub: { fontSize: 12, fontFamily: TNR, color: COLORS.gray, marginTop: 2 },
  listItemRight: { marginLeft: SPACING.sm },

  // Toast
  toast: { position: 'absolute', top: 10, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 10, borderRadius: RADIUS.full, zIndex: 9999, ...SHADOW.medium },
  toastText: { color: COLORS.white, fontSize: 14, fontFamily: TNR_BOLD, fontWeight: '600' },
});
