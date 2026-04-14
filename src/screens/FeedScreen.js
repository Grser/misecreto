// src/screens/FeedScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, RefreshControl, Modal, Image, ScrollView,
  Platform, Alert, AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { T, COUNTRIES, GRADIENTS } from '../lib/theme';
import { sGet, sSet, SK, NK, uid, cleanSecrets, checkStorageConnection } from '../lib/storage';
import { CntBadge, Tag, ActBtn } from '../components/Atoms';
import { SecretCard, NsfwCard } from '../components/SecretCard';
import CommentSheet from '../components/CommentSheet';

/* ─── EMOJI AVATAR ───────────────────────────────────────────────────────── */
const EMOJIS = ['😶','🐱','🦊','🐸','🦄','👻','🎭','🐧','🦁','🐺','🦋','🐙','🐨','🦝','🐻','🦜','🐬','🦉','🐯','🦔'];
export const EmojiAvatar = ({ colorIdx = 0, size = 36, nsfw = false }) => {
  const emoji = EMOJIS[colorIdx % EMOJIS.length];
  const [start, end] = GRADIENTS[colorIdx % 8];
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: start, alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, borderWidth: 1.5, borderColor: nsfw ? '#7c3aed' : end,
    }}>
      <Text style={{ fontSize: size * 0.52 }}>{emoji}</Text>
    </View>
  );
};

/* ─── DURATION OPTIONS ───────────────────────────────────────────────────── */
const DURATION_OPTS = [
  { label: 'Permanente', value: 0 },
  { label: '5 min',      value: 5 },
  { label: '15 min',     value: 15 },
  { label: '30 min',     value: 30 },
  { label: '1 hora',     value: 60 },
  { label: '6 horas',    value: 360 },
  { label: '24 horas',   value: 1440 },
  { label: '7 días',     value: 10080 },
];

const isExpired = (s) => s.expiresAt && Date.now() > s.expiresAt;

/* ─── BOTTOM TABS (no Recientes/Top at top) ─────────────────────────────── */
const BOTTOM_TABS = [
  { id: 'trending',  icon: 'trending-up',   label: 'Trending' },
  { id: 'mios',      icon: 'lock',          label: 'Míos' },
  { id: 'nsfw',      icon: 'alert-octagon', label: 'NSFW', special: true },
];

export default function FeedScreen({ session, onLogout, onOpenAdmin }) {
  const [secrets,  setSecrets] = useState([]);
  const [nsfwSec,  setNsfw]    = useState([]);
  const [tab,      setTab]     = useState('trending');
  const [filter,   setFilter]  = useState('all');
  const [active,   setActive]  = useState(null);
  const [draft,    setDraft]   = useState('');
  const [posting,  setPosting] = useState(false);
  const [refresh,  setRefresh] = useState(false);
  const [nsfwOk,   setNsfwOk]  = useState(false);
  const [showProf, setProf]    = useState(false);
  const [photo,    setPhoto]   = useState(null);
  const [duration, setDur]     = useState(0);
  const [showDur,  setShowDur] = useState(false);
  const [dbStatus, setDbStatus] = useState('checking');
  const appStateRef = React.useRef(AppState.currentState);

  const isNsfw = tab === 'nsfw';
  const sk     = isNsfw ? NK : SK;
  const acc    = isNsfw ? '#c026d3' : T.blue;

  /* load & filter expired */
  const load = useCallback(async (silent = false) => {
    if (!silent) setRefresh(true);
    const [raw, rawN] = await Promise.all([sGet(SK), sGet(NK)]);
    const strip = arr => cleanSecrets((arr || []).filter(s => !isExpired(s)));
    setSecrets(strip(raw));
    setNsfw(strip(rawN));
    if (!silent) setRefresh(false);
  }, []);

  React.useEffect(() => {
    load();
    (async () => {
      const ok = await checkStorageConnection();
      setDbStatus(ok ? 'connected' : 'error');
    })();
  }, [load]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      load(true);
    }, 5000);

    const sub = AppState.addEventListener('change', (nextState) => {
      const wasBackground = appStateRef.current !== 'active';
      if (wasBackground && nextState === 'active') load(true);
      appStateRef.current = nextState;
    });

    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [load]);

  const update = (all, forNsfw) => {
    const c = cleanSecrets(all.filter(s => !isExpired(s)));
    forNsfw ? setNsfw(c) : setSecrets(c);
    if (active) setActive(c.find(x => x.id === active.id) || null);
  };

  /* image picker */
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso necesario', 'Necesitamos acceso a tu galería.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [4, 3], quality: 0.55, base64: true,
    });
    if (!result.canceled && result.assets?.[0]?.base64) {
      setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
      setShowDur(true);
    }
  };

  const removePhoto = () => { setPhoto(null); setDur(0); setShowDur(false); };

  /* sorted list */
  const getSorted = () => {
    let list = [...(isNsfw ? nsfwSec : secrets)];
    if (filter !== 'all') list = list.filter(s => s.country === filter);
    if (tab === 'mios') list = list.filter(s => s.author === session.username);
    else list.sort((a, b) => (b.views || 0) - (a.views || 0));
    return list;
  };

  /* post */
  const post = async () => {
    const hasText  = draft.trim().length > 0;
    const hasPhoto = !!photo;
    if ((!hasText && !hasPhoto) || posting) return;
    setPosting(true);
    const all     = await sGet(sk) || [];
    const expires = duration > 0 ? Date.now() + duration * 60 * 1000 : null;
    all.unshift({
      id: uid(), text: draft.trim(), photo: photo || null,
      expiresAt: expires, durationMinutes: duration,
      author: session.username, color: session.color, country: session.country,
      likes: 0, dislikes: 0, views: 0, likedBy: [], dislikedBy: [],
      time: Date.now(), comments: [], nsfw: isNsfw,
    });
    await sSet(sk, all);
    setDraft(''); removePhoto(); setPosting(false);
    update(all, isNsfw);
  };

  /* like / dislike */
  const toggleLike = async (id) => {
    const all = await sGet(sk) || [];
    const s = all.find(x => x.id === id); if (!s) return;
    s.likedBy = s.likedBy || []; s.dislikedBy = s.dislikedBy || [];
    const i = s.likedBy.indexOf(session.username);
    if (i > -1) { s.likedBy.splice(i, 1); s.likes--; }
    else { s.likedBy.push(session.username); s.likes++; const di = s.dislikedBy.indexOf(session.username); if (di > -1) { s.dislikedBy.splice(di, 1); s.dislikes--; } }
    await sSet(sk, all); update(all, isNsfw);
  };

  const toggleDislike = async (id) => {
    const all = await sGet(SK) || [];
    const s = all.find(x => x.id === id); if (!s) return;
    s.likedBy = s.likedBy || []; s.dislikedBy = s.dislikedBy || [];
    const i = s.dislikedBy.indexOf(session.username);
    if (i > -1) { s.dislikedBy.splice(i, 1); s.dislikes--; }
    else { s.dislikedBy.push(session.username); s.dislikes++; const li = s.likedBy.indexOf(session.username); if (li > -1) { s.likedBy.splice(li, 1); s.likes--; } }
    await sSet(SK, all); update(all, false);
  };

  const openComment = async (sec) => {
    const all = await sGet(sk) || [];
    const s = all.find(x => x.id === sec.id); if (!s) return;
    s.views = (s.views || 0) + 1;
    await sSet(sk, all); update(all, isNsfw);
    setActive({ ...s });
  };

  const list = getSorted();

  /* ── Write card header ── */
  const renderHeader = () => (
    <>
      {/* NSFW banner */}
      {isNsfw && (
        <View style={styles.nsfwBanner}>
          <Text style={{ fontSize: 18 }}>🔞</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.nsfwBannerTitle}>Zona NSFW</Text>
            <Text style={styles.nsfwBannerSub}>Toca cada post para revelar. Contenido ilegal prohibido.</Text>
          </View>
        </View>
      )}

      {/* Write card */}
      <View style={[styles.writeCard, isNsfw && styles.writeCardNsfw]}>
        <View style={styles.writeTop}>
          <EmojiAvatar colorIdx={session.color} size={36} nsfw={isNsfw} />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={isNsfw ? 'Secreto adulto anónimo... 🔞' : 'Comparte tu secreto anónimamente...'}
            placeholderTextColor={T.text3}
            multiline
            maxLength={500}
            style={[styles.writeInput, isNsfw && { color: '#e9d5ff' }]}
            textAlignVertical="top"
            scrollEnabled={false}
            blurOnSubmit={false}
          />
        </View>

        {/* Photo preview */}
        {photo && (
          <View style={styles.photoWrap}>
            <Image source={{ uri: photo }} style={styles.photoImg} resizeMode="cover" />
            <TouchableOpacity onPress={removePhoto} style={styles.photoRemove}>
              <Feather name="x" size={14} color="#fff" />
            </TouchableOpacity>
            {duration > 0 && (
              <View style={styles.durBadge}>
                <Feather name="clock" size={10} color="#fff" />
                <Text style={styles.durBadgeTxt}>{DURATION_OPTS.find(d => d.value === duration)?.label}</Text>
              </View>
            )}
          </View>
        )}

        {/* Duration picker */}
        {showDur && (
          <View style={styles.durRow}>
            <Text style={styles.durRowLabel}>⏱ Duración:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {DURATION_OPTS.map(opt => (
                <TouchableOpacity key={opt.value} onPress={() => setDur(opt.value)}
                  style={[styles.durChip, duration === opt.value && { backgroundColor: acc, borderColor: acc }]}>
                  <Text style={[styles.durChipTxt, duration === opt.value && { color: '#fff' }]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Footer */}
        <View style={[styles.writeFooter, { borderTopColor: isNsfw ? '#3d1a5a' : T.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={pickImage} style={styles.imgBtn}>
              <Feather name="image" size={18} color={photo ? acc : T.text3} />
            </TouchableOpacity>
            <View style={styles.anonTag}>
              <Feather name={isNsfw ? 'alert-octagon' : 'lock'} size={11} color={isNsfw ? '#9333ea' : T.text3} />
              <Text style={[styles.anonTxt, isNsfw && { color: '#9333ea' }]}>
                {isNsfw ? 'Contenido adulto' : '100% anónimo'}
              </Text>
            </View>
          </View>
          <View style={styles.writeRight}>
            <Text style={[styles.charCount, draft.length > 460 && { color: '#ef4444' }]}>{draft.length}/500</Text>
            <TouchableOpacity
              onPress={post}
              disabled={(draft.trim().length < 1 && !photo) || posting}
              style={[styles.postBtn, { backgroundColor: acc },
                ((draft.trim().length < 1 && !photo) || posting) && { opacity: 0.4 }]}>
              <Text style={styles.postBtnTxt}>{posting ? '...' : 'Publicar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Country filters */}
      <FlatList
        horizontal
        data={[{ code: 'all', name: 'Todos', flag: '' }, ...COUNTRIES]}
        keyExtractor={c => c.code}
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 10, flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 0, gap: 6 }}
        renderItem={({ item: c }) => (
          <TouchableOpacity onPress={() => setFilter(c.code)}
            style={[styles.chip, filter === c.code && { backgroundColor: acc, borderColor: acc }]}>
            <Text style={[styles.chipTxt, filter === c.code && { color: '#fff' }]}>
              {c.flag ? c.flag + ' ' : ''}{c.name}
            </Text>
          </TouchableOpacity>
        )}
      />
    </>
  );

  return (
    <SafeAreaView style={[styles.root, isNsfw && { backgroundColor: '#100818' }]} edges={['top']}>

      {/* Top nav — only logo + admin + avatar */}
      <View style={[styles.topnav, isNsfw && styles.topnavNsfw]}>
        <Text style={styles.logo}>Mi<Text style={{ color: isNsfw ? '#c026d3' : T.blue }}>Secreto</Text></Text>
        <View style={{ flex: 1 }} />
        <View style={[styles.dbPill, dbStatus === 'connected' ? styles.dbPillOk : styles.dbPillErr]}>
          <View style={[styles.dbDot, dbStatus === 'connected' ? styles.dbDotOk : styles.dbDotErr]} />
          <Text style={styles.dbTxt}>DB {dbStatus === 'checking' ? 'verificando...' : dbStatus === 'connected' ? 'conectada' : 'sin conexión'}</Text>
        </View>
        {session.isAdmin && (
          <TouchableOpacity onPress={onOpenAdmin} style={styles.adminBtn}>
            <Feather name="shield" size={14} color="#f87171" />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => setProf(true)} style={{ marginLeft: 8 }}>
          <EmojiAvatar colorIdx={session.color} size={32} nsfw={isNsfw} />
        </TouchableOpacity>
      </View>

      {/* Feed or gate */}
      {isNsfw && !nsfwOk ? (
        <NsfwGate onEnter={() => setNsfwOk(true)} onBack={() => setTab('trending')} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={s => s.id}
          renderItem={({ item: s }) => isNsfw
            ? <NsfwCard secret={s} session={session} onComment={openComment} onLike={() => toggleLike(s.id)} />
            : <SecretCard secret={s} session={session} onComment={openComment} onLike={() => toggleLike(s.id)} onDislike={() => toggleDislike(s.id)} />
          }
          ListHeaderComponent={renderHeader()}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name={tab === 'mios' ? 'lock' : isNsfw ? 'alert-octagon' : 'message-circle'} size={34} color={T.text3} />
              <Text style={styles.emptyTxt}>
                {tab === 'mios' ? 'Aún no publicaste nada' : isNsfw ? 'Sin contenido NSFW aún' : 'Sin secretos aún\n¡Sé el primero!'}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 90 }}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={load} tintColor={acc} />}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Bottom nav */}
      <View style={[styles.bottomNav, isNsfw && { backgroundColor: '#0d0614', borderTopColor: '#3d1a5a' }]}>
        {BOTTOM_TABS.map(({ id, icon, label, special }) => {
          const isActive = tab === id;
          const clr = isActive ? (special ? '#c026d3' : '#60a5fa') : 'rgba(255,255,255,0.35)';
          return (
            <TouchableOpacity key={id} onPress={() => setTab(id)} style={styles.bnav}>
              <Feather name={icon} size={20} color={clr} />
              <Text style={[styles.bnavTxt, { color: clr }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Comment sheet */}
      {active && (
        <CommentSheet
          secret={active} session={session}
          storageKey={isNsfw ? NK : SK}
          onUpdate={all => update(all, isNsfw)}
          onClose={() => setActive(null)}
          nsfw={isNsfw}
        />
      )}

      {/* Profile */}
      {showProf && (
        <ProfileModal
          session={session}
          secrets={[...secrets, ...nsfwSec]}
          onClose={() => setProf(false)}
          onLogout={onLogout}
        />
      )}
    </SafeAreaView>
  );
}

/* ─── NSFW GATE ─────────────────────────────────────────────────────────── */
function NsfwGate({ onEnter, onBack }) {
  return (
    <View style={styles.gateWrap}>
      <View style={styles.gateCard}>
        <Text style={{ fontSize: 48, marginBottom: 14 }}>🔞</Text>
        <Text style={styles.gateTitle}>Contenido para adultos</Text>
        <Text style={styles.gateSub}>Solo podés acceder si tenés 18 años o más. Al continuar confirmás tu mayoría de edad.</Text>
        <View style={styles.gateWarn}>
          <Feather name="alert-triangle" size={12} color="#f87171" />
          <Text style={styles.gateWarnTxt}>El acceso queda registrado. Contenido ilegal sobre menores está <Text style={{ color: '#f87171', fontWeight: '700' }}>prohibido</Text>.</Text>
        </View>
        <TouchableOpacity onPress={onEnter} style={styles.gateBtn}>
          <Text style={styles.gateBtnTxt}>Soy mayor de 18 · Entrar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onBack} style={{ marginTop: 10 }}>
          <Text style={{ color: T.text3, fontSize: 12, textDecorationLine: 'underline' }}>Volver al feed</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ─── PROFILE MODAL ─────────────────────────────────────────────────────── */
function ProfileModal({ session, secrets, onClose, onLogout }) {
  const mine   = secrets.filter(s => s.author === session.username);
  const tLikes = mine.reduce((a, s) => a + s.likes, 0);
  const tCms   = mine.reduce((a, s) => a + (s.comments?.length || 0), 0);
  const [start, end] = GRADIENTS[session.color % 8];
  const emoji  = EMOJIS[session.color % EMOJIS.length];

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 0.18, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} activeOpacity={1} />
      <View style={profSt.sheet}>
        <View style={profSt.handle} />
        <View style={profSt.header}>
          <Text style={profSt.title}>Mi Perfil</Text>
          <TouchableOpacity onPress={onClose} style={profSt.closeBtn}>
            <Feather name="x" size={16} color={T.text3} />
          </TouchableOpacity>
        </View>
        <View style={profSt.avatarRow}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: start, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: end }}>
            <Text style={{ fontSize: 28 }}>{emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={profSt.username}>@{session.username}</Text>
            <Text style={profSt.member}>Miembro anónimo verificado 🔒</Text>
            <View style={profSt.statsRow}>
              {[['Secretos', mine.length], ['Likes', tLikes], ['Comentarios', tCms]].map(([l, v]) => (
                <View key={l} style={{ alignItems: 'center' }}>
                  <Text style={profSt.statNum}>{v}</Text>
                  <Text style={profSt.statLbl}>{l}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <FlatList
          data={mine.sort((a, b) => b.time - a.time)}
          keyExtractor={s => s.id}
          style={profSt.list}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={{ color: T.text3, textAlign: 'center', fontSize: 13, padding: 24 }}>Aún no publicaste secretos</Text>}
          renderItem={({ item: s }) => (
            <View style={[profSt.myCard, s.nsfw && { backgroundColor: '#1a0e24', borderColor: '#3d1a5a' }]}>
              {s.nsfw && <Tag label="🔞 NSFW" color="#c026d3" />}
              {s.photo && <Image source={{ uri: s.photo }} style={profSt.myPhoto} resizeMode="cover" />}
              {!!s.text && <Text style={profSt.myTxt}>{s.text}</Text>}
              {s.expiresAt && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Feather name="clock" size={10} color={T.amber} />
                  <Text style={{ fontSize: 10, color: T.amber }}>
                    Expira en ~{DURATION_OPTS.find(d => d.value === s.durationMinutes)?.label || 'breve'}
                  </Text>
                </View>
              )}
              <View style={profSt.myStats}>
                {[['heart', s.likes], ['message-circle', s.comments?.length || 0], ['eye', s.views || 0]].map(([icon, v]) => (
                  <View key={icon} style={profSt.myStatItem}>
                    <Feather name={icon} size={11} color={T.text3} />
                    <Text style={profSt.myStatTxt}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        />
        <TouchableOpacity onPress={onLogout} style={profSt.logoutBtn}>
          <Feather name="log-out" size={14} color="#f87171" style={{ marginRight: 8 }} />
          <Text style={profSt.logoutTxt}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: T.bg },
  topnav:        { flexDirection: 'row', alignItems: 'center', backgroundColor: T.bg2, borderBottomWidth: 1, borderBottomColor: T.border, paddingHorizontal: 14, paddingVertical: 10 },
  topnavNsfw:    { backgroundColor: '#0d0614', borderBottomColor: '#3d1a5a' },
  logo:          { fontSize: 20, fontWeight: '800', color: '#f8fafc', letterSpacing: -0.5 },
  adminBtn:      { backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 8, padding: 7 },
  dbPill:        { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8 },
  dbPillOk:      { borderColor: 'rgba(16,185,129,0.45)', backgroundColor: 'rgba(16,185,129,0.12)' },
  dbPillErr:     { borderColor: 'rgba(239,68,68,0.45)', backgroundColor: 'rgba(239,68,68,0.12)' },
  dbDot:         { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  dbDotOk:       { backgroundColor: '#34d399' },
  dbDotErr:      { backgroundColor: '#f87171' },
  dbTxt:         { fontSize: 10, fontWeight: '700', color: T.text2 },
  nsfwBanner:    { flexDirection: 'row', gap: 10, backgroundColor: '#1a0e24', borderWidth: 1, borderColor: '#3d1a5a', borderRadius: 12, padding: 12, marginBottom: 10, alignItems: 'center' },
  nsfwBannerTitle:{ fontSize: 13, fontWeight: '700', color: '#f0abfc' },
  nsfwBannerSub: { fontSize: 11, color: '#a78bfa', marginTop: 1 },
  // write
  writeCard:     { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 16, padding: 14, marginBottom: 10 },
  writeCardNsfw: { backgroundColor: '#1a0e24', borderColor: '#3d1a5a' },
  writeTop:      { flexDirection: 'row', gap: 10, marginBottom: 8 },
  writeInput:    {
    flex: 1, color: T.text, fontSize: 15, minHeight: 72, lineHeight: 22,
    paddingTop: 2, paddingBottom: 0,
    // KEY FIX: no fixed height, no border that grabs focus weirdly on web
    textAlignVertical: 'top',
  },
  writeFooter:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1 },
  anonTag:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  anonTxt:       { fontSize: 11, color: T.text3 },
  writeRight:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  charCount:     { fontSize: 12, color: T.text3 },
  postBtn:       { borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16 },
  postBtnTxt:    { color: '#fff', fontSize: 13, fontWeight: '700' },
  imgBtn:        { padding: 4 },
  // photo
  photoWrap:     { position: 'relative', marginBottom: 10 },
  photoImg:      { width: '100%', height: 180, borderRadius: 10 },
  photoRemove:   { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 12, width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  durBadge:      { position: 'absolute', bottom: 6, left: 6, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8 },
  durBadgeTxt:   { color: '#fff', fontSize: 10, fontWeight: '600' },
  // duration
  durRow:        { marginBottom: 10 },
  durRowLabel:   { fontSize: 11, color: T.text3, fontWeight: '600', marginBottom: 6 },
  durChip:       { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: T.border, backgroundColor: T.bg2 },
  durChipTxt:    { fontSize: 12, color: T.text2 },
  // chip
  chip:          { backgroundColor: T.bg3, borderWidth: 1, borderColor: T.border, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 13 },
  chipTxt:       { fontSize: 12, color: T.text3, fontWeight: '500' },
  // empty
  empty:         { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTxt:      { fontSize: 14, color: T.text3, textAlign: 'center', lineHeight: 20 },
  // bottom nav
  bottomNav:     { flexDirection: 'row', backgroundColor: T.bg2, borderTopWidth: 1, borderTopColor: T.border, paddingBottom: Platform.OS === 'ios' ? 24 : 10, paddingTop: 8 },
  bnav:          { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 },
  bnavTxt:       { fontSize: 10, fontWeight: '600' },
  // gate
  gateWrap:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  gateCard:      { backgroundColor: '#1a0e24', borderWidth: 1, borderColor: '#3d1a5a', borderRadius: 20, padding: 28, alignItems: 'center', width: '100%' },
  gateTitle:     { fontSize: 22, fontWeight: '800', color: '#f0abfc', marginBottom: 8 },
  gateSub:       { fontSize: 13, color: '#a78bfa', textAlign: 'center', lineHeight: 20, marginBottom: 18 },
  gateWarn:      { flexDirection: 'row', gap: 6, backgroundColor: '#0d0614', borderRadius: 8, padding: 10, marginBottom: 18, alignItems: 'flex-start' },
  gateWarnTxt:   { fontSize: 11, color: '#a78bfa', flex: 1, lineHeight: 16 },
  gateBtn:       { backgroundColor: '#9333ea', borderRadius: 10, paddingVertical: 13, width: '100%', alignItems: 'center' },
  gateBtnTxt:    { color: '#fff', fontSize: 15, fontWeight: '700' },
});

const profSt = StyleSheet.create({
  sheet:     { flex: 0.82, backgroundColor: T.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: T.border },
  handle:    { width: 36, height: 4, backgroundColor: T.border2, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  title:     { fontSize: 15, fontWeight: '700', color: T.text },
  closeBtn:  { width: 30, height: 30, borderRadius: 15, backgroundColor: T.bg2, alignItems: 'center', justifyContent: 'center' },
  avatarRow: { flexDirection: 'row', gap: 14, padding: 16, paddingTop: 4, borderBottomWidth: 1, borderBottomColor: T.border },
  username:  { fontSize: 17, fontWeight: '800', color: T.text },
  member:    { fontSize: 12, color: T.text3, marginTop: 2 },
  statsRow:  { flexDirection: 'row', gap: 16, marginTop: 8 },
  statNum:   { fontSize: 17, fontWeight: '800', color: T.text },
  statLbl:   { fontSize: 11, color: T.text3 },
  list:      { flex: 1 },
  myCard:    { backgroundColor: T.bg2, borderRadius: 10, padding: 12, marginBottom: 8 },
  myPhoto:   { width: '100%', height: 120, borderRadius: 8, marginBottom: 8 },
  myTxt:     { fontSize: 13, color: T.text2, lineHeight: 18, marginVertical: 4 },
  myStats:   { flexDirection: 'row', gap: 12, marginTop: 4 },
  myStatItem:{ flexDirection: 'row', alignItems: 'center', gap: 4 },
  myStatTxt: { fontSize: 11, color: T.text3 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a0a10', borderTopWidth: 1, borderTopColor: '#451a1a', padding: 16 },
  logoutTxt: { color: '#f87171', fontSize: 14, fontWeight: '600' },
});
