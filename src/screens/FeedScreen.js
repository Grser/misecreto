import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, RefreshControl, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { T } from '../lib/theme';
import { adminApi, createSecret, fetchSecrets } from '../lib/api';
import { SecretCard, NsfwCard } from '../components/SecretCard';
import CommentSheet from '../components/CommentSheet';

const EMOJIS = ['😶','🐱','🦊','🐸','🦄','👻','🎭','🐧','🦁','🐺','🦋','🐙','🐨','🦝','🐻','🦜','🐬','🦉','🐯','🦔'];

const toSecret = (row) => ({
  id: String(row.id),
  text: row.content || '',
  author: row.username,
  color: Number(row.color_idx || 0),
  likes: Number(row.likes || 0),
  dislikes: 0,
  views: 0,
  likedBy: [],
  dislikedBy: [],
  time: new Date(row.created_at).getTime(),
  comments: [],
  nsfw: Number(row.nsfw) === 1,
  title: row.title || '',
  userId: Number(row.user_id),
});

export const EmojiAvatar = ({ colorIdx = 0, size = 36, nsfw = false }) => {
  const emoji = EMOJIS[colorIdx % EMOJIS.length];
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: '#1d4ed8', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, borderWidth: 1.5, borderColor: nsfw ? '#7c3aed' : '#2563eb',
    }}>
      <Text style={{ fontSize: size * 0.52 }}>{emoji}</Text>
    </View>
  );
};

const FeedComposer = memo(function FeedComposer({ isNsfw, posting, onSubmit, sessionColor }) {
  const [draft, setDraft] = useState('');
  const handleSubmit = useCallback(async () => {
    const content = draft.trim();
    if (!content || posting) return;
    const ok = await onSubmit(content);
    if (ok) setDraft('');
  }, [draft, onSubmit, posting]);

  return (
    <View style={[styles.writeCard, isNsfw && styles.writeCardNsfw]}>
      <View style={styles.writeTop}>
        <EmojiAvatar colorIdx={sessionColor} size={36} nsfw={isNsfw} />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={isNsfw ? 'Secreto adulto anónimo... 🔞' : 'Comparte tu secreto anónimamente...'}
          placeholderTextColor={T.text3}
          multiline
          maxLength={500}
          style={[styles.writeInput, isNsfw && { color: '#e9d5ff' }]}
          textAlignVertical="top"
          blurOnSubmit={false}
        />
      </View>
      <View style={styles.writeFooter}>
        <Text style={[styles.charCount, draft.length > 460 && { color: '#ef4444' }]}>{draft.length}/500</Text>
        <TouchableOpacity onPress={handleSubmit} disabled={!draft.trim() || posting} style={[styles.postBtn, (!draft.trim() || posting) && { opacity: 0.4 }]}>
          <Text style={styles.postBtnTxt}>{posting ? '...' : 'Publicar'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

export default function FeedScreen({ session, onLogout, onOpenAdmin }) {
  const [secrets, setSecrets] = useState([]);
  const [tab, setTab] = useState('trending');
  const [active, setActive] = useState(null);
  const [posting, setPosting] = useState(false);
  const [refresh, setRefresh] = useState(false);
  const [nsfwOk, setNsfwOk] = useState(false);
  const [showProf, setProf] = useState(false);

  const isNsfw = tab === 'nsfw';

  const load = useCallback(async () => {
    setRefresh(true);
    try {
      const rows = await fetchSecrets();
      setSecrets(rows.map(toSecret));
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo cargar el feed');
    }
    setRefresh(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const post = useCallback(async (content) => {
    setPosting(true);
    try {
      await createSecret({
        user_id: Number(session.userId || process.env.EXPO_PUBLIC_DEV_USER_ID || 1),
        title: isNsfw ? 'Secreto NSFW' : 'Secreto',
        content,
        nsfw: isNsfw ? 1 : 0,
        color_idx: Number(session.color || 0),
      });
      await load();
      return true;
    } catch (e) {
      Alert.alert('No se pudo publicar', e.message || 'Error de servidor');
      return false;
    } finally {
      setPosting(false);
    }
  }, [isNsfw, load, session.color, session.userId]);

  const list = useMemo(() => {
    const sorted = [...secrets].sort((a, b) => b.time - a.time);
    if (tab === 'mios') return sorted.filter((s) => s.author === session.username);
    if (isNsfw) return sorted.filter((s) => s.nsfw);
    return sorted.filter((s) => !s.nsfw);
  }, [isNsfw, secrets, session.username, tab]);

  const updateActiveComments = useCallback((comments) => {
    setActive((prev) => (prev ? { ...prev, comments } : prev));
    setSecrets((prev) => prev.map((s) => (String(s.id) === String(active?.id) ? { ...s, comments } : s)));
  }, [active?.id]);

  const quickBanFromFeed = (username) => {
    if (!session.isAdmin || username === session.username) return;
    Alert.alert('Suspender usuario', `¿Quieres suspender a @${username} desde el feed?`, [{ text: 'Cancelar' }, {
      text: 'Suspender', style: 'destructive', onPress: async () => {
        try {
          await adminApi.setUserBan(session.token, username, true);
          Alert.alert('Usuario suspendido', `@${username} fue suspendido correctamente.`);
        } catch (e) {
          Alert.alert('No se pudo suspender', e.message || 'Error desconocido');
        }
      },
    }]);
  };

  return (
    <SafeAreaView style={[styles.root, isNsfw && { backgroundColor: '#100818' }]} edges={['top']}>
      <View style={styles.topnav}>
        <Text style={styles.logo}>Mi<Text style={{ color: isNsfw ? '#c026d3' : T.blue }}>Secreto</Text></Text>
        <View style={{ flex: 1 }} />
        {session.isAdmin && (
          <TouchableOpacity onPress={onOpenAdmin} style={styles.adminBtn}><Feather name="shield" size={14} color="#f87171" /></TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => setProf(true)} style={{ marginLeft: 8 }}><EmojiAvatar colorIdx={session.color} size={32} nsfw={isNsfw} /></TouchableOpacity>
      </View>

      {isNsfw && !nsfwOk ? (
        <View style={styles.gateWrap}><TouchableOpacity onPress={() => setNsfwOk(true)} style={styles.postBtn}><Text style={styles.postBtnTxt}>Entrar a NSFW</Text></TouchableOpacity></View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(s) => s.id}
          renderItem={({ item: s }) => isNsfw
            ? <NsfwCard secret={s} session={session} onComment={setActive} onLike={() => {}} onBanAuthor={session.isAdmin ? quickBanFromFeed : null} />
            : <SecretCard secret={s} session={session} onComment={setActive} onLike={() => {}} onDislike={() => {}} onBanAuthor={session.isAdmin ? quickBanFromFeed : null} />}
          ListHeaderComponent={<FeedComposer isNsfw={isNsfw} posting={posting} onSubmit={post} sessionColor={session.color} />}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 90 }}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={load} tintColor={isNsfw ? '#c026d3' : T.blue} />}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <View style={styles.bottomNav}>
        {[
          { id: 'trending', icon: 'trending-up', label: 'Trending' },
          { id: 'mios', icon: 'lock', label: 'Míos' },
          { id: 'nsfw', icon: 'alert-octagon', label: 'NSFW' },
        ].map(({ id, icon, label }) => (
          <TouchableOpacity key={id} onPress={() => setTab(id)} style={styles.bnav}>
            <Feather name={icon} size={20} color={tab === id ? '#60a5fa' : 'rgba(255,255,255,0.35)'} />
            <Text style={[styles.bnavTxt, { color: tab === id ? '#60a5fa' : 'rgba(255,255,255,0.35)' }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {active && <CommentSheet secret={active} session={session} onUpdate={updateActiveComments} onClose={() => setActive(null)} nsfw={isNsfw} />}

      {showProf && (
        <Modal visible animationType="slide" transparent onRequestClose={() => setProf(false)}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setProf(false)}>
            <View style={{ marginTop: 'auto', backgroundColor: T.card, padding: 20 }}>
              <Text style={{ color: T.text, fontWeight: '700', marginBottom: 10 }}>@{session.username}</Text>
              <TouchableOpacity onPress={onLogout}><Text style={{ color: '#f87171' }}>Cerrar sesión</Text></TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  topnav: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.bg2, borderBottomWidth: 1, borderBottomColor: T.border, paddingHorizontal: 14, paddingVertical: 10 },
  logo: { fontSize: 20, fontWeight: '800', color: '#f8fafc', letterSpacing: -0.5 },
  adminBtn: { backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 8, padding: 7 },
  writeCard: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 16, padding: 14, marginBottom: 10 },
  writeCardNsfw: { backgroundColor: '#1a0e24', borderColor: '#3d1a5a' },
  writeTop: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  writeInput: { flex: 1, color: T.text, fontSize: 15, minHeight: 72, lineHeight: 22, textAlignVertical: 'top' },
  writeFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: T.border },
  charCount: { fontSize: 12, color: T.text3 },
  postBtn: { borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: T.blue },
  postBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  bottomNav: { flexDirection: 'row', backgroundColor: T.bg2, borderTopWidth: 1, borderTopColor: T.border, paddingBottom: 10, paddingTop: 8 },
  bnav: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 },
  bnavTxt: { fontSize: 10, fontWeight: '600' },
  gateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
