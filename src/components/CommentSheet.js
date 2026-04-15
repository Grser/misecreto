import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, StyleSheet, Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../lib/theme';
import { timeAgo } from '../lib/storage';
import { createComment } from '../lib/api';
import { Avatar } from './Atoms';

const Composer = React.memo(function Composer({
  inputRef,
  text,
  onChangeText,
  replyTo,
  onClearReply,
  onSend,
  nsfw,
  acc,
}) {
  return (
    <View style={[styles.inputArea, nsfw && { borderTopColor: '#3d1a5a' }]}>
      {replyTo && (
        <View style={[styles.repBanner, { borderColor: `${acc}44`, backgroundColor: `${acc}15` }]}>
          <Feather name="corner-down-right" size={12} color={acc} />
          <Text style={{ fontSize: 12, color: acc, fontWeight: '600', flex: 1, marginLeft: 6 }}>
            Respondiendo a @{replyTo.author}
          </Text>
          <TouchableOpacity onPress={onClearReply}>
            <Feather name="x" size={14} color={T.text3} />
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={onChangeText}
          placeholder={replyTo ? `Responde a @${replyTo.author}...` : 'Comenta anónimamente...'}
          placeholderTextColor={T.text3}
          style={[styles.input, nsfw && { backgroundColor: '#0d0614', borderColor: '#3d1a5a' }]}
          maxLength={280}
          blurOnSubmit={false}
          onSubmitEditing={onSend}
        />
        <TouchableOpacity
          onPress={onSend}
          disabled={!text.trim()}
          style={[styles.sendBtn, { backgroundColor: acc, opacity: text.trim() ? 1 : 0.4 }]}>
          <Feather name="send" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
});

export default function CommentSheet({ secret, session, onUpdate, onClose, nsfw = false }) {
  const [text, setText] = useState('');
  const [replyTo, setRep] = useState(null);
  const [expanded, setExp] = useState(new Set());
  const [comments, setComments] = useState(Array.isArray(secret.comments) ? secret.comments : []);
  const inputRef = useRef(null);
  const acc = nsfw ? '#c026d3' : T.blue;

  const send = async () => {
    if (!text.trim()) return;
    try {
      const created = await createComment({
        secret_id: Number(secret.id),
        user_id: Number(session.userId),
        parent_id: replyTo ? Number(replyTo.id) : null,
        content: text.trim(),
      });
      setComments((prev) => [...prev, created]);
      setText('');
      setRep(null);
      onUpdate?.();
    } catch {
      // ignorar para no cerrar el sheet por errores transitorios
    }
  };

  const toggleExp = (id) => setExp((p) => {
    const n = new Set(p);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const roots = useMemo(
    () => comments.filter((c) => c.parent_id === null || c.parent_id === undefined),
    [comments],
  );

  const repliesByParent = useMemo(() => {
    const map = new Map();
    comments.forEach((c) => {
      if (c.parent_id !== null && c.parent_id !== undefined) {
        const key = String(c.parent_id);
        const list = map.get(key) || [];
        list.push(c);
        map.set(key, list);
      }
    });
    return map;
  }, [comments]);

  const renderComment = ({ item: c }) => {
    const exp = expanded.has(c.id);
    const replies = repliesByParent.get(String(c.id)) || [];
    return (
      <View style={styles.cmItem}>
        <Avatar colorIdx={0} size={28} nsfw={nsfw} />
        <View style={{ flex: 1 }}>
          <View style={styles.cmMeta}>
            <Text style={styles.cmAuthor}>@{c.username}</Text>
            <Text style={styles.cmTime}>{timeAgo(new Date(c.created_at).getTime())}</Text>
          </View>
          <Text style={styles.cmText}>{c.content}</Text>
          <View style={styles.cmActs}>
            <TouchableOpacity onPress={() => { setRep({ id: c.id, author: c.username }); inputRef.current?.focus(); }} style={styles.miniBtn}>
              <Feather name="corner-down-right" size={12} color={replyTo?.id === c.id ? acc : T.text3} />
              <Text style={{ fontSize: 11, color: replyTo?.id === c.id ? acc : T.text3, marginLeft: 4 }}>Responder</Text>
            </TouchableOpacity>
          </View>
          {replies.length > 0 && (
            <View style={{ marginTop: 4 }}>
              <TouchableOpacity onPress={() => toggleExp(c.id)} style={styles.showRepliesBtn}>
                <Feather name={exp ? 'chevron-up' : 'chevron-down'} size={12} color={acc} />
                <Text style={{ fontSize: 11, color: acc, fontWeight: '600', marginLeft: 4 }}>
                  {exp ? 'Ocultar' : `${replies.length} respuesta${replies.length > 1 ? 's' : ''}`}
                </Text>
              </TouchableOpacity>
              {exp && replies.map((r) => (
                <View key={r.id} style={styles.replyItem}>
                  <Avatar colorIdx={0} size={22} nsfw={nsfw} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.cmMeta}>
                      <Text style={[styles.cmAuthor, { fontSize: 10 }]}>@{r.username}</Text>
                      <Text style={styles.cmTime}>{timeAgo(new Date(r.created_at).getTime())}</Text>
                    </View>
                    <Text style={[styles.cmText, { fontSize: 12 }]}>{r.content}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheet}>
        <View style={[styles.sheetInner, nsfw && { backgroundColor: '#1a0e24', borderColor: '#3d1a5a' }]}>
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Comentarios</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={18} color={T.text3} />
            </TouchableOpacity>
          </View>
          <View style={[styles.preview, nsfw && { borderLeftColor: '#9333ea', backgroundColor: '#0d0614' }]}>
            <Text style={styles.previewTxt} numberOfLines={2}>{secret.text}</Text>
          </View>
          <FlatList
            data={roots}
            keyExtractor={(c) => String(c.id)}
            renderItem={renderComment}
            ListEmptyComponent={<Text style={styles.empty}>Sin comentarios aún · ¡Sé el primero!</Text>}
            style={styles.list}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          />
          <Composer
            inputRef={inputRef}
            text={text}
            onChangeText={setText}
            replyTo={replyTo}
            onClearReply={() => setRep(null)}
            onSend={send}
            nsfw={nsfw}
            acc={acc}
          />
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
  preview: { marginHorizontal: 16, marginBottom: 10, padding: 10, backgroundColor: T.bg2, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: T.blue },
  previewTxt: { fontSize: 13, color: T.text2, lineHeight: 18 },
  list: { maxHeight: 340 },
  empty: { textAlign: 'center', color: T.text3, fontSize: 13, paddingVertical: 24 },
  cmItem: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  cmMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  cmAuthor: { fontSize: 11, fontWeight: '600', color: T.text2 },
  cmTime: { fontSize: 10, color: T.text3 },
  cmText: { fontSize: 13, color: T.text, lineHeight: 18 },
  cmActs: { flexDirection: 'row', gap: 4, marginTop: 5 },
  miniBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, paddingHorizontal: 6, borderRadius: 10 },
  showRepliesBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 2 },
  replyItem: { flexDirection: 'row', gap: 8, marginTop: 8, paddingLeft: 10, borderLeftWidth: 1.5, borderLeftColor: T.border },
  inputArea: { borderTopWidth: 1, borderTopColor: T.border, padding: 12, paddingBottom: Platform.OS === 'ios' ? 24 : 12 },
  repBanner: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: 8, marginBottom: 8 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border, borderRadius: 20, color: T.text, fontSize: 14, paddingHorizontal: 14, paddingVertical: 10 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
