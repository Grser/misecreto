// src/components/Atoms.js
import React, { useState } from 'react';
import {
  View, Text, TextInput,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import TouchableOpacity from './TouchableOpacityCompat';
import { Feather, Ionicons } from '@expo/vector-icons';
import { T, GRADIENTS, COUNTRY_CLR, cOf } from '../lib/theme';

// ── Avatar with gradient ring + Feather icon ──────────────────────────────
const ICON_NAMES = ['lock','eye-off','star','zap','moon','heart','cloud','shield'];

export const Avatar = ({ colorIdx = 0, size = 38, nsfw = false }) => {
  const [start, end] = GRADIENTS[colorIdx % 8];
  const iconName = ICON_NAMES[colorIdx % 8];
  const iconSize = Math.round(size * 0.42);
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: start,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: nsfw ? '#7c3aed' : end,
      shadowColor: start, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
    }}>
      <Feather name={iconName} size={iconSize} color="#fff" />
    </View>
  );
};

// ── Country badge ─────────────────────────────────────────────────────────
export const CntBadge = ({ code }) => {
  const clr = COUNTRY_CLR[code] || '#334155';
  const c = cOf(code);
  return (
    <View style={{ backgroundColor: clr, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
      <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.4 }}>{c.label}</Text>
    </View>
  );
};

// ── Pill tag ──────────────────────────────────────────────────────────────
export const Tag = ({ label, color = T.blue }) => (
  <View style={{ backgroundColor: color + '22', borderRadius: 20, borderWidth: 1, borderColor: color + '55', paddingHorizontal: 8, paddingVertical: 2 }}>
    <Text style={{ color, fontSize: 10, fontWeight: '700' }}>{label}</Text>
  </View>
);

// ── Input ─────────────────────────────────────────────────────────────────
export const Input = ({ label, nsfw = false, style, ...props }) => {
  const [focused, setFocused] = useState(false);
  const borderClr = focused ? (nsfw ? '#9333ea' : T.blue) : T.border;
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? (
        <Text style={styles.label}>{label}</Text>
      ) : null}
      <TextInput
        placeholderTextColor={T.text3}
        {...props}
        style={[styles.input, { borderColor: borderClr }, style]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
};

// ── Primary button ────────────────────────────────────────────────────────
export const BtnPrimary = ({ label, onPress, disabled, loading, nsfw = false, style }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled || loading}
    activeOpacity={0.8}
    style={[styles.btnPrimary, nsfw && styles.btnNsfw, disabled && { opacity: 0.4 }, style]}
  >
    {loading
      ? <ActivityIndicator color="#fff" size="small" />
      : <Text style={styles.btnPrimaryText}>{label}</Text>
    }
  </TouchableOpacity>
);

// ── Ghost button ──────────────────────────────────────────────────────────
export const BtnGhost = ({ label, onPress, style, icon }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.btnGhost, style]}>
    {icon ? <Feather name={icon} size={14} color={T.text2} style={{ marginRight: 6 }} /> : null}
    <Text style={styles.btnGhostText}>{label}</Text>
  </TouchableOpacity>
);

// ── Danger button ─────────────────────────────────────────────────────────
export const BtnDanger = ({ label, onPress, style }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.btnDanger, style]}>
    <Text style={styles.btnDangerText}>{label}</Text>
  </TouchableOpacity>
);

// ── Divider ───────────────────────────────────────────────────────────────
export const Divider = ({ color = T.border }) => (
  <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: color, marginVertical: 10 }} />
);

// ── Section title ─────────────────────────────────────────────────────────
export const SectionTitle = ({ text, color = T.text3 }) => (
  <Text style={{ fontSize: 10, fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>{text}</Text>
);

// ── Card wrapper ──────────────────────────────────────────────────────────
export const Card = ({ children, style, nsfw = false }) => (
  <View style={[styles.card, nsfw && styles.cardNsfw, style]}>{children}</View>
);

// ── Spinner ───────────────────────────────────────────────────────────────
export const Spinner = ({ color = T.blue }) => (
  <ActivityIndicator color={color} size="small" />
);

// ── Stat block ────────────────────────────────────────────────────────────
export const StatBlock = ({ value, label }) => (
  <View style={{ alignItems: 'center' }}>
    <Text style={{ fontSize: 20, fontWeight: '800', color: T.text }}>{value}</Text>
    <Text style={{ fontSize: 11, color: T.text3, marginTop: 1 }}>{label}</Text>
  </View>
);

// ── Action button (for cards) ─────────────────────────────────────────────
export const ActBtn = ({ icon, count, onPress, active, color }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7}
    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, backgroundColor: active ? color + '22' : 'transparent' }}>
    <Feather name={icon} size={14} color={active ? color : T.text3} />
    {count !== undefined && (
      <Text style={{ fontSize: 12, color: active ? color : T.text3, fontWeight: '600' }}>{count}</Text>
    )}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  label: {
    fontSize: 11, fontWeight: '600', color: T.text3,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  input: {
    backgroundColor: T.bg2, borderWidth: 1, borderRadius: 10,
    color: T.text, fontSize: 14, paddingHorizontal: 14, paddingVertical: 11,
  },
  btnPrimary: {
    backgroundColor: T.blue, borderRadius: 10, paddingVertical: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  btnNsfw: { backgroundColor: '#9333ea' },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnGhost: {
    borderWidth: 1, borderColor: T.border, borderRadius: 10,
    paddingVertical: 9, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  btnGhostText: { color: T.text2, fontSize: 13, fontWeight: '500' },
  btnDanger: {
    backgroundColor: '#1a0a10', borderWidth: 1, borderColor: '#451a1a',
    borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14, alignItems: 'center',
  },
  btnDangerText: { color: '#f87171', fontSize: 12, fontWeight: '600' },
  card: {
    backgroundColor: T.card, borderWidth: 1,
    borderColor: T.border, borderRadius: 16,
  },
  cardNsfw: { backgroundColor: '#1a0e24', borderColor: '#3d1a5a' },
});
