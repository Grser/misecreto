// src/components/SecretCard.js
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, cOf, COUNTRY_CLR, GRADIENTS } from '../lib/theme';
import { timeAgo } from '../lib/storage';
import { CntBadge, Tag } from './Atoms';

const EMOJIS = ['😶','🐱','🦊','🐸','🦄','👻','🎭','🐧','🦁','🐺','🦋','🐙','🐨','🦝','🐻','🦜','🐬','🦉','🐯','🦔'];

/* emoji avatar shared by both card types */
const EmojiAv = ({ colorIdx = 0, size = 36, nsfw = false }) => {
  const emoji = EMOJIS[colorIdx % EMOJIS.length];
  const [start, end] = GRADIENTS[colorIdx % 8];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: start, alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderWidth: 1.5, borderColor: nsfw ? '#7c3aed' : end }}>
      <Text style={{ fontSize: size * 0.52 }}>{emoji}</Text>
    </View>
  );
};

const totCm = (s) => (s.comments || []).reduce((a, c) => a + 1 + (c.replies?.length || 0), 0);

/* ─── SFW CARD ───────────────────────────────────────────────────────────── */
export const SecretCard = ({ secret, session, onComment, onLike, onDislike }) => {
  const liked    = secret.likedBy?.includes(session.username);
  const disliked = secret.dislikedBy?.includes(session.username);
  const isMine   = secret.author === session.username;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.head}>
        <EmojiAv colorIdx={secret.color} size={36} />
        <View style={styles.metaWrap}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.uid}>@{secret.author}</Text>
            {isMine && <Tag label="yo" color={T.blue} />}
          </View>
          <Text style={styles.timeText}>{timeAgo(secret.time)}</Text>
        </View>
        <View style={styles.rightMeta}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Feather name="eye" size={11} color={T.text3} />
            <Text style={styles.views}>{(secret.views || 0).toLocaleString('es')}</Text>
          </View>
          <CntBadge code={secret.country} />
        </View>
      </View>

      {/* Tap area */}
      <TouchableOpacity onPress={() => onComment(secret)} activeOpacity={0.85}>
        {/* Photo */}
        {secret.photo && (
          <Image source={{ uri: secret.photo }} style={styles.photo} resizeMode="cover" />
        )}
        {/* Text */}
        {!!secret.text && (
          <Text style={styles.body}>{secret.text}</Text>
        )}
      </TouchableOpacity>

      {/* Expiry */}
      {secret.expiresAt && (
        <View style={styles.expRow}>
          <Feather name="clock" size={10} color={T.amber} />
          <Text style={styles.expTxt}>Temporal · {secret.durationMinutes >= 1440 ? `${Math.round(secret.durationMinutes/1440)}d` : secret.durationMinutes >= 60 ? `${Math.round(secret.durationMinutes/60)}h` : `${secret.durationMinutes}min`}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <ActBtn icon="heart" count={secret.likes} onPress={() => onLike(secret.id)} active={liked} color={T.rose} />
        <ActBtn icon="thumbs-down" count={secret.dislikes} onPress={() => onDislike(secret.id)} active={disliked} color={T.blue} />
        <ActBtn icon="message-circle" count={totCm(secret)} onPress={() => onComment(secret)} color={T.indigo} />
        <ActBtn icon="link-2" onPress={() => {}} color={T.green} />
      </View>
    </View>
  );
};

/* ─── NSFW CARD ──────────────────────────────────────────────────────────── */
export const NsfwCard = ({ secret, session, onComment, onLike }) => {
  const [revealed, setRev] = useState(false);
  const liked  = secret.likedBy?.includes(session.username);
  const isMine = secret.author === session.username;

  return (
    <View style={[styles.card, styles.nsfwCard]}>
      {/* Header */}
      <View style={styles.head}>
        <EmojiAv colorIdx={secret.color} size={36} nsfw />
        <View style={styles.metaWrap}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.uid, { color: '#d8b4fe' }]}>@{secret.author}</Text>
            {isMine && <Tag label="yo" color="#c026d3" />}
          </View>
          <Text style={[styles.timeText, { color: '#7c3aed' }]}>{timeAgo(secret.time)}</Text>
        </View>
        <View style={styles.rightMeta}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Feather name="eye" size={11} color="#7c3aed" />
            <Text style={[styles.views, { color: '#7c3aed' }]}>{(secret.views || 0).toLocaleString('es')}</Text>
          </View>
          <CntBadge code={secret.country} />
        </View>
      </View>

      {/* Blur reveal tap area */}
      <TouchableOpacity onPress={() => setRev(r => !r)} activeOpacity={0.9} style={{ marginBottom: 6 }}>
        <View style={{ position: 'relative' }}>
          {/* Photo */}
          {secret.photo && (
            <Image source={{ uri: secret.photo }} style={[styles.photo, { opacity: revealed ? 1 : 0.06 }]} resizeMode="cover" />
          )}
          {/* Text */}
          {!!secret.text && (
            <Text style={[styles.body, { color: '#e9d5ff', opacity: revealed ? 1 : 0.08 }]}>{secret.text}</Text>
          )}
          {/* Overlay */}
          {!revealed && (
            <View style={styles.blurOverlay}>
              <Feather name="eye" size={16} color="#fff" />
              <Text style={styles.revealTxt}>Toca para revelar</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Expiry */}
      {secret.expiresAt && (
        <View style={styles.expRow}>
          <Feather name="clock" size={10} color={T.amber} />
          <Text style={styles.expTxt}>Temporal</Text>
        </View>
      )}

      {/* Actions */}
      <View style={[styles.actions, { borderTopColor: '#3d1a5a' }]}>
        <ActBtn icon="heart" count={secret.likes} onPress={() => onLike(secret.id)} active={liked} color="#c026d3" />
        <ActBtn icon="message-circle" count={totCm(secret)} onPress={() => onComment(secret)} color="#9333ea" />
        <ActBtn icon="link-2" onPress={() => {}} color={T.green} />
      </View>
    </View>
  );
};

/* ─── ActBtn local ───────────────────────────────────────────────────────── */
const ActBtn = ({ icon, count, onPress, active, color }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7}
    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, backgroundColor: active ? color + '22' : 'transparent' }}>
    <Feather name={icon} size={14} color={active ? color : T.text3} />
    {count !== undefined && (
      <Text style={{ fontSize: 12, color: active ? color : T.text3, fontWeight: '600' }}>{count}</Text>
    )}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card:        { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 16, padding: 14, marginBottom: 10 },
  nsfwCard:    { backgroundColor: '#1a0e24', borderColor: '#3d1a5a' },
  head:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  metaWrap:    { flex: 1, minWidth: 0 },
  uid:         { fontSize: 12, fontWeight: '600', color: T.text2 },
  timeText:    { fontSize: 11, color: T.text3, marginTop: 1 },
  rightMeta:   { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  views:       { fontSize: 11, color: T.text3, fontWeight: '600' },
  photo:       { width: '100%', height: 180, borderRadius: 10, marginBottom: 8 },
  body:        { fontSize: 14, lineHeight: 22, color: T.text, marginBottom: 8 },
  expRow:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  expTxt:      { fontSize: 10, color: T.amber, fontWeight: '600' },
  actions:     { flexDirection: 'row', gap: 2, borderTopWidth: 1, borderTopColor: T.border, paddingTop: 8, marginTop: 2 },
  blurOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,5,35,0.88)', borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  revealTxt:   { color: '#fff', fontSize: 13, fontWeight: '700' },
});
