// src/screens/AuthScreen.js
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet, Modal, TextInput, Alert,
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
  const [claimCode, setClaimCode] = useState('');
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [appealBusy, setAppealBusy] = useState(false);

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
        color: Number.isFinite(res.user.color) ? res.user.color : selColor,
        country: res.user.country || form.country || 'us',
        isAdmin: !!res.user.is_admin,
        nsfwVerified: !!res.user.nsfwVerified,
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
      const res = await authApi.register(u, form.password, { color: selColor, country: form.country });
      const s = {
        username: res.user.username,
        userId: res.user.id,
        token: res.token,
        color: Number.isFinite(res.user.color) ? res.user.color : selColor,
        country: res.user.country || form.country || 'us',
        isAdmin: !!res.user.is_admin,
        nsfwVerified: !!res.user.nsfwVerified,
      };
      onLogin(s);
    } catch (e) {
      setErr(e.message || 'No se pudo registrar');
    }
    setBusy(false);
  };


  const doClaimAdmin = async () => {
    setErr(''); setBusy(true);
    const u = normalizeUsername(form.username);
    if (!claimCode.trim()) { setErr('Ingresa el código de administrador'); setBusy(false); return; }
    try {
      const res = await authApi.login(u, form.password);
      await authApi.claimAdmin(res.token, claimCode.trim());
      const s = {
        username: res.user.username,
        userId: res.user.id,
        token: res.token,
        color: Number.isFinite(res.user.color) ? res.user.color : selColor,
        country: res.user.country || form.country || 'us',
        isAdmin: true,
        nsfwVerified: !!res.user.nsfwVerified,
      };
      onLogin(s);
    } catch (e) {
      setErr(e.message || 'No se pudo reclamar administrador');
    }
    setBusy(false);
  };

  const doAppeal = async () => {
    if (appealReason.trim().length < 12) {
      setErr('Explica tu apelación en al menos 12 caracteres');
      return;
    }
    setAppealBusy(true);
    try {
      await authApi.requestAppeal(form.username, form.password, appealReason.trim());
      setAppealOpen(false);
      setAppealReason('');
      Alert.alert('Apelación enviada', 'Tu apelación fue enviada al equipo de moderación.');
    } catch (e) {
      setErr(e.message || 'No se pudo enviar la apelación');
    }
    setAppealBusy(false);
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
          {mode === 'login' && /suspendida/i.test(err) && (
            <TouchableOpacity onPress={() => setAppealOpen(true)} style={styles.appealInline}>
              <Feather name="mail" size={13} color="#fbbf24" />
              <Text style={styles.appealInlineTxt}>Apelar suspensión de cuenta</Text>
            </TouchableOpacity>
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


          {mode === 'login' && (
            <>
              <Input
                label="Código admin (opcional)"
                value={claimCode}
                onChangeText={setClaimCode}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Código secreto"
              />
              <BtnPrimary
                label="Reclamar admin"
                onPress={doClaimAdmin}
                loading={busy}
                style={{ marginTop: 6, backgroundColor: '#7c3aed' }}
              />
            </>
          )}

          <BtnPrimary
            label={mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            onPress={mode === 'login' ? doLogin : doRegister}
            loading={busy}
            style={{ marginTop: 6 }}
          />
        </Card>
      </ScrollView>
      <Modal visible={appealOpen} transparent animationType="fade" onRequestClose={() => setAppealOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Apelar suspensión</Text>
            <Text style={styles.modalSub}>Cuéntanos por qué deberíamos revisar el bloqueo de @{normalizeUsername(form.username) || 'tu_usuario'}.</Text>
            <TextInput
              value={appealReason}
              onChangeText={setAppealReason}
              multiline
              maxLength={400}
              placeholder="Explica tu caso…"
              placeholderTextColor={T.text3}
              style={styles.appealInput}
            />
            <Text style={styles.appealCount}>{appealReason.length}/400</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setAppealOpen(false)} style={styles.modalGhost}>
                <Text style={styles.modalGhostTxt}>Cancelar</Text>
              </TouchableOpacity>
              <BtnPrimary label="Enviar apelación" onPress={doAppeal} loading={appealBusy} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
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
  appealInline: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2b2110', borderColor: '#4b350f', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 14 },
  appealInlineTxt: { color: '#fbbf24', fontSize: 12, fontWeight: '700' },
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
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(3,7,18,0.74)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 16 },
  modalTitle: { color: T.text, fontSize: 17, fontWeight: '800' },
  modalSub: { color: T.text3, fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 10 },
  appealInput: { minHeight: 110, borderRadius: 10, borderWidth: 1, borderColor: T.border, backgroundColor: T.bg2, color: T.text, padding: 12, textAlignVertical: 'top', fontSize: 14 },
  appealCount: { color: T.text3, fontSize: 11, textAlign: 'right', marginTop: 6 },
  modalActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  modalGhost: { paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: T.border, borderRadius: 10 },
  modalGhostTxt: { color: T.text2, fontWeight: '700', fontSize: 13 },
});
