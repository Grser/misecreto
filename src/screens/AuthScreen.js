// src/screens/AuthScreen.js
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, COUNTRIES } from '../lib/theme';
import { authApi } from '../lib/api';
import { normalizeUsername, validateRegisterInput } from '../lib/validation';
import { Input, BtnPrimary, Card } from '../components/Atoms';

const AVATAR_COUNT = 8;

export default function AuthScreen({ onLogin }) {
  const [mode, setMode]     = useState('login');
  const [err, setErr]       = useState('');
  const [busy, setBusy]     = useState(false);
  const [selColor, setSel]  = useState(0);
  const [form, setForm]     = useState({ username: '', password: '', country: 'ar' });
  const [showPass, setShow] = useState(false);
  const [ctryOpen, setCtry] = useState(false);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const ICON_NAMES = ['lock','eye-off','star','zap','moon','heart','cloud','shield'];
  const GRAD_COLORS = ['#ec4899','#0ea5e9','#10b981','#f59e0b','#8b5cf6','#d946ef','#3b82f6','#84cc16'];

  const doLogin = async () => {
    setErr(''); setBusy(true);
    const u = normalizeUsername(form.username);
    try {
      const res = await authApi.login(u, form.password);
      const s = {
        username: res.user.username,
        userId: res.user.id,
        token: res.token,
        color: selColor,
        country: form.country,
        isAdmin: !!res.user.is_admin,
        nsfwVerified: false,
      };
      onLogin(s);
    } catch (e) {
      setErr(e.message || 'No se pudo iniciar sesión');
    }
    setBusy(false);
  };

  const doRegister = async () => {
    setErr(''); setBusy(true);
    const u = normalizeUsername(form.username);
    const validationError = validateRegisterInput(u, form.password);
    if (validationError) { setErr(validationError); setBusy(false); return; }
    try {
      const res = await authApi.register(u, form.password);
      const s = {
        username: res.user.username,
        userId: res.user.id,
        token: res.token,
        color: selColor,
        country: form.country,
        isAdmin: !!res.user.is_admin,
        nsfwVerified: false,
      };
      onLogin(s);
    } catch (e) {
      setErr(e.message || 'No se pudo registrar');
    }
    setBusy(false);
  };

  const selCountry = cOf => COUNTRIES.find(c => c.code === cOf) || COUNTRIES[0];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <View style={styles.logoWrap}>
          <Text style={styles.logoText}>Mi<Text style={{ color: T.blue }}>Secreto</Text></Text>
          <Text style={styles.logoSub}>Comparte. De forma anónima.</Text>
        </View>

        {/* Card */}
        <Card style={styles.card}>
          {/* Tabs */}
          <View style={styles.tabRow}>
            {[['login','Iniciar sesión'],['reg','Registrarse']].map(([m, l]) => (
              <TouchableOpacity key={m} onPress={() => { setMode(m); setErr(''); }}
                style={[styles.tabBtn, mode === m && styles.tabBtnActive]}>
                <Text style={[styles.tabTxt, mode === m && styles.tabTxtActive]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Error */}
          {!!err && (
            <View style={styles.errBox}>
              <Feather name="alert-circle" size={13} color="#f87171" />
              <Text style={styles.errTxt}>{err}</Text>
            </View>
          )}

          {/* Username */}
          <Input label="Usuario" value={form.username} onChangeText={set('username')}
            autoCapitalize="none" autoCorrect={false} placeholder="tu_usuario"
            autoComplete="username" />

          {/* Password */}
          <View style={{ marginBottom: 14 }}>
            <Text style={styles.fieldLabel}>Contraseña</Text>
            <View style={styles.passRow}>
              <Input value={form.password} onChangeText={set('password')}
                secureTextEntry={!showPass} placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                style={{ flex: 1, marginBottom: 0 }} />
              <TouchableOpacity onPress={() => setShow(s => !s)} style={styles.eyeBtn}>
                <Feather name={showPass ? 'eye-off' : 'eye'} size={16} color={T.text3} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Register extras */}
          {mode === 'reg' && (<>
            {/* Avatar color picker */}
            <Text style={styles.fieldLabel}>Tu ícono anónimo</Text>
            <View style={styles.iconGrid}>
              {ICON_NAMES.map((icon, i) => (
                <TouchableOpacity key={i} onPress={() => setSel(i)}
                  style={[styles.iconOpt, selColor === i && { borderColor: GRAD_COLORS[i], backgroundColor: GRAD_COLORS[i] + '22' }]}>
                  <Feather name={icon} size={18} color={selColor === i ? GRAD_COLORS[i] : T.text3} />
                </TouchableOpacity>
              ))}
            </View>

            {/* Country */}
            <Text style={[styles.fieldLabel, { marginTop: 6 }]}>Tu país</Text>
            <TouchableOpacity onPress={() => setCtry(o => !o)} style={styles.ctryBtn}>
              <Text style={{ color: T.text, fontSize: 14 }}>
                {selCountry(form.country).flag} {selCountry(form.country).name}
              </Text>
              <Feather name={ctryOpen ? 'chevron-up' : 'chevron-down'} size={16} color={T.text3} />
            </TouchableOpacity>
            {ctryOpen && (
              <View style={styles.ctryDrop}>
                {COUNTRIES.map(c => (
                  <TouchableOpacity key={c.code} onPress={() => { set('country')(c.code); setCtry(false); }}
                    style={[styles.ctryRow, form.country === c.code && { backgroundColor: T.blue + '22' }]}>
                    <Text style={{ color: T.text, fontSize: 14 }}>{c.flag} {c.name}</Text>
                    {form.country === c.code && <Feather name="check" size={14} color={T.blue} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Legal notice */}
            <View style={styles.legalBox}>
              <Feather name="shield" size={12} color={T.text3} style={{ marginRight: 6, marginTop: 1 }} />
              <Text style={styles.legalTxt}>
                Tu identidad real queda vinculada a tu cuenta por razones legales, pero nunca es visible públicamente.
              </Text>
            </View>
          </>)}

          <BtnPrimary
            label={mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            onPress={mode === 'login' ? doLogin : doRegister}
            loading={busy}
            style={{ marginTop: 6 }}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: T.bg },
  scroll:    { padding: 24, paddingBottom: 48, alignItems: 'center' },
  logoWrap:  { alignItems: 'center', marginBottom: 28, marginTop: 24 },
  logoText:  { fontSize: 38, fontWeight: '800', color: '#f8fafc', letterSpacing: -1 },
  logoSub:   { fontSize: 13, color: T.text3, marginTop: 4 },
  card:      { width: '100%', maxWidth: 400, padding: 22, borderRadius: 20 },
  tabRow:    { flexDirection: 'row', backgroundColor: T.bg2, borderRadius: 10, padding: 3, marginBottom: 20 },
  tabBtn:    { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  tabBtnActive: { backgroundColor: T.blue },
  tabTxt:    { fontSize: 13, fontWeight: '600', color: T.text3 },
  tabTxtActive: { color: '#fff' },
  errBox:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1a0a10', borderWidth: 1, borderColor: '#451a1a', borderRadius: 8, padding: 10, marginBottom: 14 },
  errTxt:    { color: '#f87171', fontSize: 12, fontWeight: '600', flex: 1 },
  fieldLabel:{ fontSize: 11, fontWeight: '600', color: T.text3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  passRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn:    { padding: 12 },
  iconGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  iconOpt:   { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  ctryBtn:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border, borderRadius: 10, padding: 12, marginBottom: 4 },
  ctryDrop:  { backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border, borderRadius: 10, marginBottom: 14, overflow: 'hidden' },
  ctryRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border },
  legalBox:  { flexDirection: 'row', backgroundColor: T.bg2, borderRadius: 8, padding: 10, marginTop: 10, marginBottom: 6 },
  legalTxt:  { fontSize: 11, color: T.text3, lineHeight: 16, flex: 1 },
});
