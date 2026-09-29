import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, SafeAreaView, StatusBar,
} from 'react-native';
import { io } from 'socket.io-client';
import { API_URL } from './config';

export default function App() {
  const [username, setUsername] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [online, setOnline] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [error, setError] = useState('');
  const socketRef = useRef(null);
  const listRef = useRef(null);
  const typingTimer = useRef(null);

  useEffect(() => {
    if (!username) return;

    fetch(`${API_URL}/api/messages`)
      .then((r) => r.json())
      .then(setMessages)
      .catch(() => setError('Could not load chat history'));

    const socket = io(API_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => { setError(''); socket.emit('join', username); });
    socket.on('connect_error', () => setError('Connection lost. Reconnecting...'));
    socket.on('new_message', (m) =>
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m])));
    socket.on('online_users', setOnline);
    socket.on('typing', (u) => setTypingUsers((p) => (p.includes(u) ? p : [...p, u])));
    socket.on('stop_typing', (u) => setTypingUsers((p) => p.filter((x) => x !== u)));

    return () => socket.disconnect();
  }, [username]);

  const onChange = (v) => {
    setText(v);
    const s = socketRef.current;
    if (!s) return;
    s.emit('typing', username);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => s.emit('stop_typing', username), 1200);
  };

  const send = () => {
    if (!text.trim()) return;
    socketRef.current?.emit('send_message', { username, text }, (res) => {
      if (!res?.ok) setError(res?.error || 'Failed to send');
    });
    socketRef.current?.emit('stop_typing', username);
    setText('');
  };

  const fmt = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (!username) {
    return (
      <SafeAreaView style={s.login}>
        <Text style={s.title}>Join Chat</Text>
        <TextInput style={s.input} placeholder="Enter username" value={nameInput} onChangeText={setNameInput} />
        <TouchableOpacity style={s.btn} onPress={() => nameInput.trim() && setUsername(nameInput.trim())}>
          <Text style={s.btnText}>Continue</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <Text style={s.headerTitle}>Chat</Text>
        <Text style={s.sub}>{online.length} online: {online.join(', ')}</Text>
      </View>
      {!!error && <Text style={s.error}>{error}</Text>}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => String(m.id)}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => {
          const mine = item.username === username;
          return (
            <View style={[s.bubble, mine ? s.mine : s.theirs]}>
              {!mine && <Text style={s.user}>{item.username}</Text>}
              <Text style={mine ? s.mineText : s.theirText}>{item.text}</Text>
              <Text style={[s.time, mine && { color: '#dbe7ff' }]}>{fmt(item.createdAt)}</Text>
            </View>
          );
        }}
      />
      {typingUsers.length > 0 && <Text style={s.typing}>{typingUsers.join(', ')} typing...</Text>}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.inputRow}>
          <TextInput style={[s.input, { flex: 1 }]} placeholder="Type your message..." value={text} onChangeText={onChange} onSubmitEditing={send} />
          <TouchableOpacity style={s.send} onPress={send}><Text style={s.btnText}>Send</Text></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  login: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 16 },
  container: { flex: 1, backgroundColor: '#f4f6fa' },
  header: { padding: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e3e6ec' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  sub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  error: { backgroundColor: '#fee2e2', color: '#991b1b', padding: 8, textAlign: 'center' },
  bubble: { maxWidth: '78%', padding: 10, borderRadius: 14, marginBottom: 8 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#2563eb' },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#fff' },
  mineText: { color: '#fff' },
  theirText: { color: '#111' },
  user: { fontSize: 12, fontWeight: '700', color: '#2563eb', marginBottom: 2 },
  time: { fontSize: 10, color: '#9ca3af', marginTop: 4, alignSelf: 'flex-end' },
  typing: { paddingHorizontal: 14, paddingBottom: 4, color: '#6b7280', fontStyle: 'italic' },
  inputRow: { flexDirection: 'row', padding: 10, backgroundColor: '#fff', alignItems: 'center' },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 10, backgroundColor: '#fff' },
  send: { marginLeft: 8, backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 },
  btn: { backgroundColor: '#2563eb', padding: 14, borderRadius: 10, marginTop: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
});
