// src/App.js
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sGet, UK, SSK } from './lib/storage';
import { ADMIN } from './lib/theme';
import AuthScreen  from './screens/AuthScreen';
import FeedScreen  from './screens/FeedScreen';
import AdminScreen from './screens/AdminScreen';

export default function App() {
  const [session,   setSess]  = useState(null);
  const [loading,   setLoad]  = useState(true);
  const [showAdmin, setAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SSK);
        if (raw) {
          const s = JSON.parse(raw);
          if (s.username === ADMIN.user) {
            setSess(s); setLoad(false); return;
          }
          const users = await sGet(UK) || {};
          const u = users[s.username];
          if (u && !u.banned) {
            setSess({ ...s, nsfwVerified: u.nsfwVerified || false });
          } else {
            await AsyncStorage.removeItem(SSK);
          }
        }
      } catch {}
      setLoad(false);
    })();
  }, []);

  const onLogin = async (s) => {
    try { await AsyncStorage.setItem(SSK, JSON.stringify(s)); } catch {}
    setSess(s);
    if (s.isAdmin) setAdmin(true);
  };

  const onLogout = async () => {
    try { await AsyncStorage.removeItem(SSK); } catch {}
    setSess(null);
    setAdmin(false);
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <StatusBar style="light" />
        <ActivityIndicator color="#3b82f6" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#060910" translucent={false} />
      {!session && <AuthScreen onLogin={onLogin} />}
      {session && showAdmin && session.isAdmin && <AdminScreen onBack={() => setAdmin(false)} />}
      {session && !showAdmin && <FeedScreen session={session} onLogout={onLogout} onOpenAdmin={() => setAdmin(true)} />}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#060910', alignItems: 'center', justifyContent: 'center' },
});
