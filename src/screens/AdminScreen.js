// src/screens/AdminScreen.js
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TextInput,
  StyleSheet, Alert, ScrollView,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacityCompat';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { T, COUNTRIES, cOf, COUNTRY_CLR } from '../lib/theme';
import { fullDate, timeAgo } from '../lib/storage';
import { Avatar, CntBadge, Tag, Card, Spinner, BtnDanger } from '../components/Atoms';
import { adminApi } from '../lib/api';

const NAV = [
  { id: 'dash',     icon: 'bar-chart-2', label: 'Dashboard' },
  { id: 'users',    icon: 'users',       label: 'Usuarios' },
  { id: 'appeals',  icon: 'mail',        label: 'Apelaciones' },
  { id: 'posts',    icon: 'lock',        label: 'Posts SFW' },
  { id: 'nsfw',     icon: 'alert-octagon', label: 'NSFW' },
  { id: 'comments', icon: 'message-square', label: 'Comentarios' },
];

export default function AdminScreen({ onBack, session }) {
  const [view,    setView]    = useState('dash');
  const [users,   setUsers]   = useState({});
  const [secrets, setSecrets] = useState([]);
  const [nsfw,    setNsfw]    = useState([]);
  const [search,  setSearch]  = useState('');
  const [busy,    setBusy]    = useState(true);
  const [appeals, setAppeals] = useState([]);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanResults, setScanResults] = useState([]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const snap = await adminApi.snapshot(session.token);
      const all = (snap.items || []).map((row) => ({
        id: String(row.id),
        text: row.content || '',
        author: row.username,
        color: Number(row.color_idx || 0),
        country: 'us',
        likes: Number(row.likes || 0),
        views: 0,
        time: new Date(row.created_at).getTime(),
        comments: [],
        nsfw: Number(row.nsfw) === 1,
        title: row.title || 'Secreto',
      }));
      setUsers(snap.users || {});
      setSecrets(all.filter((x) => !x.nsfw));
      setNsfw(all.filter((x) => x.nsfw));
      setAppeals((snap.appeals || []).map((a) => ({
        id: String(a.id),
        username: a.username,
        reason: a.reason,
        status: a.status || 'pendiente',
        createdAt: Number(a.createdAt || Date.now()),
      })));
    } finally {
      setBusy(false);
    }
  }, [session.token]);

  useEffect(() => { load(); }, [load]);

  const banUser = async (username) => {
    Alert.alert(
      users[username].banned ? 'Reactivar usuario' : 'Suspender usuario',
      `¿${users[username].banned ? 'Reactivar' : 'Suspender'} a @${username}?`,
      [{ text: 'Cancelar' }, {
        text: 'Confirmar', style: 'destructive', onPress: async () => {
          await adminApi.setUserBan(session.token, username, !users[username].banned);
          await load();
        }
      }]
    );
  };

  const setAdminRole = async (username) => {
    const willBeAdmin = !users[username].isAdmin;
    Alert.alert(
      willBeAdmin ? 'Dar rol administrador' : 'Quitar rol administrador',
      `¿${willBeAdmin ? 'Dar' : 'Quitar'} permisos de admin a @${username}?`,
      [{ text: 'Cancelar' }, {
        text: 'Confirmar', style: 'destructive', onPress: async () => {
          await adminApi.setUserAdmin(session.token, username, willBeAdmin);
          await load();
        },
      }]
    );
  };

  const verifyNsfw = async (username) => {
    Alert.alert('Verificación manual', `Marca a @${username} como creador adulto desde backend en la próxima iteración.`);
  };

  const runNsfwAiScan = async () => {
    setScanBusy(true);
    try {
      const res = await adminApi.scanNsfwMismatch(session.token);
      setScanResults((res.items || []).map((row) => ({
        id: String(row.id),
        username: row.username,
        title: row.title || 'Secreto',
        content: row.content || '',
        nsfw: Number(row.nsfw) === 1,
        suggested: Number(row.suggested_nsfw) === 1,
        score: Number(row.ai_score || 0),
        reasons: Array.isArray(row.ai_reasons) ? row.ai_reasons : [],
      })));
    } catch (e) {
      Alert.alert('No se pudo analizar', e.message || 'Error inesperado');
    }
    setScanBusy(false);
  };

  const deletePost = (id, isNsfw) => {
    Alert.alert('Eliminar publicación', '¿Estás seguro?', [
      { text: 'Cancelar' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await adminApi.deleteSecret(session.token, id);
        await load();
      }},
    ]);
  };

  const deleteCm = (secretId, cmId, isNsfw) => {
    Alert.alert('Eliminar comentario', '¿Estás seguro?', [
      { text: 'Cancelar' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        Alert.alert('Próximamente', 'La moderación de comentarios se habilitará por endpoint.');
      }},
    ]);
  };

  const all = [...secrets, ...nsfw];
  const q   = search.toLowerCase();
  const fil = arr => q ? arr.filter(x => JSON.stringify(x).toLowerCase().includes(q)) : arr;

  const stats = {
    users:    Object.keys(users).length,
    posts:    secrets.length,
    nsfw:     nsfw.length,
    comments: all.reduce((a, s) => a + (s.comments?.length || 0), 0),
    likes:    all.reduce((a, s) => a + s.likes, 0),
    banned:   Object.values(users).filter(u => u.banned).length,
    appeals: appeals.length,
  };

  const STAT_CARDS = [
    { label: 'Usuarios',    val: stats.users,    icon: 'users',         color: T.blue },
    { label: 'Posts SFW',   val: stats.posts,    icon: 'lock',          color: T.indigo },
    { label: 'Posts NSFW',  val: stats.nsfw,     icon: 'alert-octagon', color: T.purple },
    { label: 'Comentarios', val: stats.comments, icon: 'message-circle',color: T.green },
    { label: 'Likes',       val: stats.likes,    icon: 'heart',         color: T.rose },
    { label: 'Suspendidos', val: stats.banned,   icon: 'slash',         color: '#ef4444' },
    { label: 'Apelaciones', val: stats.appeals,  icon: 'mail',          color: '#f59e0b' },
  ];

  if (!session?.isAdmin) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.center}>
          <Feather name="shield-off" size={28} color="#f87171" />
          <Text style={{ color: T.text2, marginTop: 10 }}>Acceso solo para administradores.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topbar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Feather name="arrow-left" size={18} color={T.text2} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.topTitle}>Mi<Text style={{ color: T.blue }}>Secreto</Text></Text>
          <Text style={styles.topSub}>Panel de Administración</Text>
        </View>
        <TouchableOpacity onPress={load} style={styles.refreshBtn}>
          <Feather name="refresh-cw" size={16} color={T.blue} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {/* Sidebar nav (horizontal on mobile) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.sidebar} contentContainerStyle={styles.sidebarContent}>
          {NAV.map(n => (
            <TouchableOpacity key={n.id} onPress={() => setView(n.id)}
              style={[styles.navItem, view === n.id && { backgroundColor: '#0f1f3d', borderColor: T.blue }]}>
              <Feather name={n.icon} size={15} color={view === n.id ? '#60a5fa' : T.text3} />
              <Text style={[styles.navTxt, view === n.id && { color: '#60a5fa' }]}>{n.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Search bar */}
        {view !== 'dash' && (
          <View style={styles.searchWrap}>
            <Feather name="search" size={14} color={T.text3} style={{ marginRight: 8 }} />
            <TextInput
              value={search} onChangeText={setSearch}
              placeholder="Buscar..." placeholderTextColor={T.text3}
              style={styles.searchInput}
            />
          </View>
        )}

        {busy
          ? <View style={styles.center}><Spinner /></View>
          : <ScrollView contentContainerStyle={styles.content}>

          {/* ── DASHBOARD ── */}
          {view === 'dash' && (<>
            <Text style={styles.secTitle}>Resumen general</Text>
            <View style={styles.statsGrid}>
              {STAT_CARDS.map(s => (
                <View key={s.label} style={[styles.statCard, { borderColor: s.color + '44' }]}>
                  <Feather name={s.icon} size={20} color={s.color} />
                  <Text style={[styles.statNum, { color: s.color }]}>{s.val}</Text>
                  <Text style={styles.statLbl}>{s.label}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.secTitle, { marginTop: 20 }]}>Posts recientes</Text>
            {all.slice(0, 5).map(s => <AdminPostRow key={s.id} secret={s} onDelete={() => deletePost(s.id, !!s.nsfw)} />)}
          </>)}

          {/* ── USERS ── */}
          {view === 'users' && fil(Object.entries(users)).map(([uname, u]) => {
            const up = all.filter(s => s.author === uname).length;
            const ul = all.filter(s => s.author === uname).reduce((a, s) => a + s.likes, 0);
            return (
              <View key={uname} style={[styles.userRow, u.banned && { opacity: 0.5 }]}>
                <Avatar colorIdx={u.color || 0} size={38} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.userNameRow}>
                    <Text style={styles.userNameTxt}>@{uname}</Text>
                    {u.banned && <Tag label="SUSPENDIDO" color="#ef4444" />}
                    {u.isAdmin && <Tag label="ADMIN" color={T.blue} />}
                    {u.nsfwVerified && <Tag label="NSFW ✓" color="#c026d3" />}
                  </View>
                  <Text style={styles.userMeta}>{cOf(u.country).flag} {cOf(u.country).name} · {up} posts · ❤️{ul} · {fullDate(u.createdAt)}</Text>
                </View>
                <View style={styles.userActions}>
                  <TouchableOpacity onPress={() => setAdminRole(uname)}
                    style={[styles.smallBtn, { backgroundColor: u.isAdmin ? '#0b162b' : T.bg3, borderColor: u.isAdmin ? '#1d4ed8' : T.border }]}>
                    <Feather name="shield" size={11} color={u.isAdmin ? '#60a5fa' : T.text3} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => verifyNsfw(uname)}
                    style={[styles.smallBtn, { backgroundColor: u.nsfwVerified ? '#1a0a24' : T.bg3, borderColor: u.nsfwVerified ? '#7c3aed' : T.border }]}>
                    <Feather name="alert-octagon" size={11} color={u.nsfwVerified ? '#c026d3' : T.text3} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => banUser(uname)}
                    style={[styles.smallBtn, { backgroundColor: u.banned ? '#0a2318' : '#1a0a10', borderColor: u.banned ? '#166534' : '#451a1a' }]}>
                    <Feather name={u.banned ? 'user-check' : 'user-x'} size={11} color={u.banned ? '#22c55e' : '#f87171'} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {/* ── POSTS SFW ── */}
          {view === 'appeals' && (<>
            {!!appeals.length && <Text style={styles.appealHint}>Estas apelaciones fueron creadas por usuarios suspendidos desde pantalla de login.</Text>}
            {fil(appeals).map((a) => (
              <View key={a.id} style={styles.appealRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.appealUser}>@{a.username}</Text>
                  <Tag label={String(a.status || 'pendiente').toUpperCase()} color={a.status === 'pendiente' ? '#f59e0b' : T.blue} />
                </View>
                <Text style={styles.appealDate}>{fullDate(a.createdAt)}</Text>
                <Text style={styles.appealReason}>{a.reason}</Text>
              </View>
            ))}
            {!fil(appeals).length && <EmptyState text="No hay apelaciones de suspensión" />}
          </>)}

          {/* ── POSTS SFW ── */}
          {view === 'posts' && fil(secrets).map(s => <AdminPostRow key={s.id} secret={s} onDelete={() => deletePost(s.id, false)} expanded />)}
          {view === 'posts' && !fil(secrets).length && <EmptyState text="No hay publicaciones SFW" />}

          {/* ── POSTS NSFW ── */}
          {view === 'nsfw' && (<>
            <View style={styles.nsfwBanner}>
              <Feather name="alert-octagon" size={18} color="#c026d3" />
              <Text style={styles.nsfwBannerTxt}>Modera el contenido adulto. Elimina todo lo que viole los términos o sea ilegal.</Text>
            </View>
            <TouchableOpacity onPress={runNsfwAiScan} style={styles.scanBtn}>
              <Feather name="cpu" size={15} color="#a78bfa" />
              <Text style={styles.scanBtnTxt}>{scanBusy ? 'Analizando…' : 'Revisar con IA si hay +18 fuera de NSFW'}</Text>
            </TouchableOpacity>
            {!!scanResults.length && scanResults.map((it) => (
              <View key={`scan-${it.id}`} style={styles.scanRow}>
                <Text style={styles.scanTitle}>@{it.username} · {it.nsfw ? 'Está en NSFW' : 'Está en SFW'} → IA sugiere {it.suggested ? 'NSFW' : 'SFW'} ({Math.round(it.score * 100)}%)</Text>
                <Text style={styles.scanBody} numberOfLines={2}>{it.content}</Text>
                {!!it.reasons.length && <Text style={styles.scanReasons}>Señales: {it.reasons.join(', ')}</Text>}
              </View>
            ))}
            {fil(nsfw).map(s => <AdminPostRow key={s.id} secret={s} onDelete={() => deletePost(s.id, true)} expanded nsfw />)}
            {!fil(nsfw).length && <EmptyState text="No hay publicaciones NSFW" />}
          </>)}

          {/* ── COMMENTS ── */}
          {view === 'comments' && all.filter(s => s.comments?.length).map(s => (
            <View key={s.id} style={{ marginBottom: 14 }}>
              <View style={styles.cmSecHeader}>
                {s.nsfw && <Feather name="alert-octagon" size={11} color="#c026d3" />}
                <Text style={styles.cmSecTxt} numberOfLines={1}>@{s.author}: "{s.text.slice(0, 50)}..."</Text>
              </View>
              {fil(s.comments || []).map(c => (
                <View key={c.id} style={[styles.cmRow, s.nsfw && { backgroundColor: '#1a0e24', borderColor: '#3d1a5a' }]}>
                  <Avatar colorIdx={c.color || 0} size={28} nsfw={s.nsfw} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cmAuthor}>@{c.author} · {fullDate(c.time)} · ❤️{c.likes}</Text>
                    <Text style={styles.cmTxt}>{c.text}</Text>
                    {c.replies?.map(r => (
                      <Text key={r.id} style={styles.replyTxt}>↳ @{r.author}: {r.text}</Text>
                    ))}
                  </View>
                  <TouchableOpacity onPress={() => deleteCm(s.id, c.id, !!s.nsfw)} style={styles.delBtn}>
                    <Feather name="trash-2" size={14} color="#f87171" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ))}
          {view === 'comments' && !all.some(s => s.comments?.length) && <EmptyState text="No hay comentarios" />}

        </ScrollView>}
      </View>
    </SafeAreaView>
  );
}

const AdminPostRow = ({ secret, onDelete, expanded, nsfw = false }) => (
  <View style={[styles.postRow, nsfw && { backgroundColor: '#1a0e24', borderColor: '#3d1a5a' }]}>
    <Avatar colorIdx={secret.color || 0} size={32} nsfw={nsfw} />
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={styles.postMeta}>
        <Text style={styles.postAuthor}>@{secret.author}</Text>
        <CntBadge code={secret.country} />
        {nsfw && <Tag label="NSFW" color="#c026d3" />}
        <Text style={styles.postDate}>{fullDate(secret.time)}</Text>
      </View>
      <Text style={styles.postTxt} numberOfLines={expanded ? undefined : 2}>{secret.text}</Text>
      <View style={styles.postStats}>
        {[['heart', secret.likes], ['message-circle', secret.comments?.length || 0], ['eye', secret.views || 0]].map(([icon, v]) => (
          <View key={icon} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Feather name={icon} size={11} color={T.text3} /><Text style={styles.postStatTxt}>{v}</Text>
          </View>
        ))}
      </View>
    </View>
    <TouchableOpacity onPress={onDelete} style={styles.delBtn}>
      <Feather name="trash-2" size={14} color="#f87171" />
    </TouchableOpacity>
  </View>
);

const EmptyState = ({ text }) => (
  <View style={{ alignItems: 'center', paddingVertical: 40 }}>
    <Feather name="inbox" size={32} color={T.text3} />
    <Text style={{ color: T.text3, fontSize: 14, marginTop: 10 }}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: T.bg },
  topbar:  { flexDirection: 'row', alignItems: 'center', backgroundColor: T.bg2, borderBottomWidth: 1, borderBottomColor: T.border, padding: 14, gap: 12 },
  backBtn: { backgroundColor: T.bg3, borderWidth: 1, borderColor: T.border, borderRadius: 8, padding: 8 },
  topTitle:{ fontSize: 17, fontWeight: '800', color: '#f8fafc' },
  topSub:  { fontSize: 11, color: '#ef4444', fontWeight: '600', marginTop: 1 },
  refreshBtn:{ backgroundColor: T.bg3, borderWidth: 1, borderColor: T.border, borderRadius: 8, padding: 8 },
  body:    { flex: 1 },
  sidebar: { maxHeight: 56, borderBottomWidth: 1, borderBottomColor: T.border, flexGrow: 0 },
  sidebarContent:{ paddingHorizontal: 10, paddingVertical: 8, gap: 6, alignItems: 'center' },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: 'transparent' },
  navTxt:  { fontSize: 12, fontWeight: '600', color: T.text3 },
  searchWrap:{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.bg2, borderBottomWidth: 1, borderBottomColor: T.border, paddingHorizontal: 14, paddingVertical: 8 },
  searchInput:{ flex: 1, color: T.text, fontSize: 14 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 14, paddingBottom: 40 },
  secTitle:{ fontSize: 14, fontWeight: '700', color: T.text, marginBottom: 12 },
  statsGrid:{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: { width: '30%', flexGrow: 1, backgroundColor: T.bg2, borderWidth: 1, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4 },
  statNum:  { fontSize: 24, fontWeight: '800' },
  statLbl:  { fontSize: 11, color: T.text3, textAlign: 'center' },
  userRow:  { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  userNameRow:{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  userNameTxt:{ fontSize: 13, fontWeight: '700', color: T.text },
  userMeta:{ fontSize: 11, color: T.text3, marginTop: 3 },
  userActions:{ flexDirection: 'row', gap: 6, flexShrink: 0 },
  smallBtn:{ width: 30, height: 30, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  appealHint: { color: T.text3, fontSize: 12, marginBottom: 10 },
  appealRow: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 12, marginBottom: 8 },
  appealUser: { fontSize: 13, color: T.text, fontWeight: '700' },
  appealDate: { color: T.text3, fontSize: 11, marginTop: 4 },
  appealReason: { color: T.text2, fontSize: 13, marginTop: 8, lineHeight: 18 },
  nsfwBanner:{ flexDirection: 'row', gap: 10, backgroundColor: '#1a0e24', borderWidth: 1, borderColor: '#3d1a5a', borderRadius: 10, padding: 12, marginBottom: 14, alignItems: 'center' },
  nsfwBannerTxt:{ fontSize: 12, color: '#a78bfa', flex: 1, lineHeight: 16 },
  scanBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#1f1330', borderWidth: 1, borderColor: '#4c1d95', padding: 10, borderRadius: 10, marginBottom: 10 },
  scanBtnTxt: { color: '#c4b5fd', fontSize: 12, fontWeight: '700' },
  scanRow: { backgroundColor: '#1a0e24', borderWidth: 1, borderColor: '#3d1a5a', borderRadius: 10, padding: 10, marginBottom: 8 },
  scanTitle: { color: '#ddd6fe', fontSize: 12, fontWeight: '700' },
  scanBody: { color: '#e9d5ff', fontSize: 12, marginTop: 4 },
  scanReasons: { color: '#a78bfa', fontSize: 11, marginTop: 4 },
  postRow: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', gap: 10 },
  postMeta:{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 },
  postAuthor:{ fontSize: 12, fontWeight: '600', color: T.text2 },
  postDate:{ fontSize: 10, color: T.text3 },
  postTxt: { fontSize: 13, color: T.text, lineHeight: 18, marginBottom: 6 },
  postStats:{ flexDirection: 'row', gap: 10 },
  postStatTxt:{ fontSize: 11, color: T.text3 },
  delBtn:  { width: 32, height: 32, backgroundColor: '#1a0a10', borderWidth: 1, borderColor: '#451a1a', borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cmSecHeader:{ flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: T.bg2, borderRadius: 6, padding: 8, marginBottom: 4 },
  cmSecTxt:{ fontSize: 11, color: T.text3, flex: 1 },
  cmRow:   { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 10, padding: 10, marginBottom: 6, flexDirection: 'row', gap: 8 },
  cmAuthor:{ fontSize: 10, color: T.text3, marginBottom: 2 },
  cmTxt:   { fontSize: 13, color: T.text, lineHeight: 18 },
  replyTxt:{ fontSize: 11, color: T.text3, marginTop: 3 },
});
