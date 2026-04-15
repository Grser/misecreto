import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, StyleSheet, Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../lib/theme';
import { Avatar } from './Atoms';
import { fetchComments, createComment } from '../lib/api';

const toUiComment = (row) => ({
  id: String(row.id),
  text: row.content || '',
  author: row.username || `user_${row.user_id}`,
  color: 0,
  time: new Date(row.created_at).getTime(),
  parentId: row.parent_id ? String(row.parent_id) : null,
});

const timeAgo = (ms) => {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return 'ahora';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

export default function CommentSheet({ secret, session, onUpdate, onClose, nsfw = false }) {
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [comments, setComments] = useState(secret.comments || []);
  const inputRef = useRef(null);
  const acc = nsfw ? '#c026d3' : T.blue;

  const loadComments = useCallback(async () => {
    const rows = await fetchComments(secret.id);
    const mapped = rows.map(toUiComment);
    setComments(mapped);
    onUpdate?.(mapped);
  }, [onUpdate, secret.id]);

  useEffect(() => {
    loadComments().catch(() => {});
  }, [loadComments]);

  const send = useCallback(async () => {
    if (!text.trim()) return;
    const saved = await createComment({
      secret_id: Number(secret.id),
      user_id: Number(session.userId || process.env.EXPO_PUBLIC_DEV_USER_ID || 1),
      parent_id: replyTo ? Number(replyTo.id) : null,
      content: text.trim(),
    });

    const next = [...comments, toUiComment(saved)];
    setComments(next);
    onUpdate?.(next);
    setText('');
    setReplyTo(null);
  }, [comments, onUpdate, replyTo, secret.id, session.userId, text]);

  const topLevel = useMemo(
    () => comments.filter((c) => !c.parentId),
    [comments],
  );

  const childrenByParent = useMemo(() => {
    const map = new Map();
    comments.filter((c) => c.parentId).forEach((c) => {
      const arr = map.get(c.parentId) || [];
      arr.push(c);
      map.set(c.parentId, arr);
    });
    return map;
  }, [comments]);

  const renderComment = ({ item: c }) => (
    <View style={styles.cmItem}>
      <Avatar colorIdx={c.color || 0} size={28} nsfw={nsfw} />
      <View style={{ flex: 1 }}>
        <View style={styles.cmMeta}>
          <Text style={styles.cmAuthor}>@{c.author}</Text>
          <Text style={styles.cmTime}>{timeAgo(c.time)}</Text>
        </View>
        <Text style={styles.cmText}>{c.text}</Text>
        <TouchableOpacity onPress={() => { setReplyTo({ id: c.id, author: c.author }); inputRef.current?.focus(); }} style={styles.miniBtn}>
          <Feather name="corner-down-right" size={12} color={replyTo?.id === c.id ? acc : T.text3} />
          <Text style={{ fontSize: 11, color: replyTo?.id === c.id ? acc : T.text3, marginLeft: 4 }}>Responder</Text>
        </TouchableOpacity>

        {(childrenByParent.get(c.id) || []).map((r) => (
          <View key={r.id} style={styles.replyItem}>
            <Avatar colorIdx={0} size={22} nsfw={nsfw} />
            <View style={{ flex: 1 }}>
              <View style={styles.cmMeta}>
                <Text style={[styles.cmAuthor, { fontSize: 10 }]}>@{r.author}</Text>
                <Text style={styles.cmTime}>{timeAgo(r.time)}</Text>
              </View>
              <Text style={[styles.cmText, { fontSize: 12 }]}>{r.text}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheet}>
        <View style={[styles.sheetInner, nsfw && { backgroundColor: '#1a0e24', borderColor: '#3d1a5a' }]}>
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Comentarios</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}><Feather name="x" size={18} color={T.text3} /></TouchableOpacity>
          </View>

          <FlatList
            data={topLevel}
            keyExtractor={(c) => c.id}
            renderItem={renderComment}
            ListEmptyComponent={<Text style={styles.empty}>Sin comentarios aún · ¡Sé el primero!</Text>}
            style={styles.list}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          />

          <View style={[styles.inputArea, nsfw && { borderTopColor: '#3d1a5a' }]}>
            {replyTo && (
              <View style={[styles.repBanner, { borderColor: acc + '44', backgroundColor: acc + '15' }]}>
                <Feather name="corner-down-right" size={12} color={acc} />
                <Text style={{ fontSize: 12, color: acc, fontWeight: '600', flex: 1, marginLeft: 6 }}>Respondiendo a @{replyTo.author}</Text>
                <TouchableOpacity onPress={() => setReplyTo(null)}><Feather name="x" size={14} color={T.text3} /></TouchableOpacity>
              </View>
            )}
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={setText}
                placeholder={replyTo ? `Responde a @${replyTo.author}...` : 'Comenta anónimamente...'}
                placeholderTextColor={T.text3}
                style={[styles.input, nsfw && { backgroundColor: '#0d0614', borderColor: '#3d1a5a' }]}
                maxLength={280}
              />
              <TouchableOpacity onPress={send} disabled={!text.trim()} style={[styles.sendBtn, { backgroundColor: acc, opacity: text.trim() ? 1 : 0.4 }]}>
                <Feather name="send" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { maxHeight: '88%' },
  sheetInner: { backgroundColor: T.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: T.border, maxHeight: '100%' },
  handle: { width: 36, height: 4, backgroundColor: T.border2, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, paddingBottom: 8 },
  sheetTitle: { fontSize: 15, fontWeight: '700', color: T.text },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: T.bg2, alignItems: 'center', justifyContent: 'center' },
  list: { maxHeight: 340 },
  empty: { textAlign: 'center', color: T.text3, fontSize: 13, paddingVertical: 24 },
  cmItem: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  cmMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  cmAuthor: { fontSize: 11, fontWeight: '600', color: T.text2 },
  cmTime: { fontSize: 10, color: T.text3 },
  cmText: { fontSize: 13, color: T.text, lineHeight: 18 },
  miniBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, paddingHorizontal: 6, borderRadius: 10, marginTop: 4 },
  replyItem: { flexDirection: 'row', gap: 8, marginTop: 8, paddingLeft: 10, borderLeftWidth: 1.5, borderLeftColor: T.border },
  inputArea: { borderTopWidth: 1, borderTopColor: T.border, padding: 12, paddingBottom: Platform.OS === 'ios' ? 24 : 12 },
  repBanner: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: 8, marginBottom: 8 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border, borderRadius: 20, color: T.text, fontSize: 14, paddingHorizontal: 14, paddingVertical: 10 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
