import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import {
  AIError,
  ASSISTANT_NAME,
  type AIStatus,
  ChatMessage,
  checkAIStatus,
  formatModelName,
  streamChatCompletion,
} from '../lib/aiChat';
import { clearChatHistory, loadChatHistory, saveChatMessage } from '../lib/chatHistory';
import MarkdownMessage from '../components/MarkdownMessage';
import { useAuth } from '../context/auth';
import { useCity } from '../components/CityContext';

const C = {
  bg: '#FBF7F1',
  surface: '#FFFFFF',
  border: '#EADFD1',
  borderStrong: '#DCCDBB',
  ink: '#211A16',
  inkSoft: '#5E5148',
  inkMuted: '#958778',
  brand: '#F07B2E',
  brandDeep: '#D9621A',
  brandTint: '#FDEBDD',
  success: '#12B76A',
  warning: '#F0A52E',
  danger: '#B42318',
  dangerTint: '#FEF3F2',
};

type IconName = keyof typeof Ionicons.glyphMap;

type Suggestion = { icon: IconName; title: string; subtitle: string; prompt: string };

function buildSuggestions(cityName: string, country: string): Suggestion[] {
  return [
    {
      icon: 'thermometer-outline',
      title: 'WBGT vs. air temperature',
      subtitle: 'Why the heat index matters more',
      prompt: 'Explain the difference between WBGT and normal air temperature, and the risk thresholds for outdoor activity.',
    },
    {
      icon: 'business-outline',
      title: `Heat risk in ${cityName}`,
      subtitle: 'Microclimate and urban heat island',
      prompt: `Analyse the heat stress risks and urban microclimate in ${cityName}, ${country}. What should residents watch out for?`,
    },
    {
      icon: 'water-outline',
      title: 'Hydration plan',
      subtitle: 'How much to drink and when',
      prompt: 'Give me a practical hydration plan for a student doing 2 hours of outdoor sport in hot, humid weather.',
    },
    {
      icon: 'leaf-outline',
      title: 'Cooling our city',
      subtitle: 'Proven heat mitigation strategies',
      prompt: 'What are the most effective strategies to reduce urban heat in Southeast Asian cities?',
    },
  ];
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${((h + 11) % 12) + 1}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

function AssistantAvatar({ size = 30 }: { size?: number }) {
  return (
    <LinearGradient
      colors={['#F59A4A', '#E2621B']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name="sparkles" size={size * 0.5} color="#FFFFFF" />
    </LinearGradient>
  );
}

function TypingIndicator() {
  const [dots] = useState(() => [0, 1, 2].map(() => new Animated.Value(0.3)));

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, { toValue: 1, duration: 380, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 380, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [dots]);

  return (
    <View style={styles.typingRow}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[styles.typingDot, { opacity: dot, transform: [{ scale: dot.interpolate({ inputRange: [0.3, 1], outputRange: [0.8, 1.1] }) }] }]}
        />
      ))}
    </View>
  );
}

function ActionButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={14} color={C.inkSoft} />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

export default function AIScreen() {
  const params = useLocalSearchParams<{ query?: string }>();
  const { user } = useAuth();
  const { city } = useCity();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [inputHeight, setInputHeight] = useState(24);
  const [historyLoading, setHistoryLoading] = useState(!!user);
  const [pending, setPending] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; retryText: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);
  const handledParam = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const userId = user?.id;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const busy = pending || streamingId !== null;
  const [aiStatus, setAiStatus] = useState<AIStatus | 'checking'>('checking');
  // Only a confirmed "not configured" disables input; when offline the user can still retry.
  const configured = aiStatus !== 'not_configured';
  const suggestions = buildSuggestions(city.name, city.country);

  const scrollToEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated }));
  }, []);

  useEffect(() => {
    let active = true;
    if (!userId) return;
    loadChatHistory()
      .then((history) => {
        if (active && history.length) setMessages(history);
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    let active = true;
    checkAIStatus().then((status) => {
      if (active) setAiStatus(status);
    });
    return () => {
      active = false;
    };
  }, []);

  const send = useCallback(
    async (text: string, opts: { reuseLastUser?: boolean } = {}) => {
      const query = text.trim();
      if (!query || pending || streamingId) return;

      setError(null);
      setInput('');
      setInputHeight(24);

      let history = messagesRef.current;
      if (!opts.reuseLastUser) {
        const userMessage: ChatMessage = { id: makeId(), role: 'user', content: query, timestamp: Date.now() };
        history = [...history, userMessage];
        messagesRef.current = history;
        setMessages(history);
        if (user) saveChatMessage(user.id, userMessage);
      }

      setPending(true);
      scrollToEnd();

      const controller = new AbortController();
      abortRef.current = controller;
      const assistantId = makeId();
      let started = false;

      try {
        const result = await streamChatCompletion({
          messages: history.slice(-20).map((m) => ({ role: m.role, content: m.content })),
          signal: controller.signal,
          onDelta: (accumulated, model) => {
            if (!started) {
              started = true;
              setPending(false);
              setStreamingId(assistantId);
              setMessages((prev) => [
                ...prev,
                { id: assistantId, role: 'assistant', content: accumulated, timestamp: Date.now(), model },
              ]);
            } else {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated, model: model ?? m.model } : m))
              );
            }
          },
        });

        const finalMessage: ChatMessage = {
          id: assistantId,
          role: 'assistant',
          content: result.content,
          timestamp: Date.now(),
          model: result.model,
        };
        setMessages((prev) =>
          started ? prev.map((m) => (m.id === assistantId ? finalMessage : m)) : [...prev, finalMessage]
        );
        if (user) saveChatMessage(user.id, finalMessage);
        setAiStatus('ready');
      } catch (err) {
        const aiErr = err instanceof AIError ? err : new AIError('unknown', 'Something went wrong. Please try again.');
        if (aiErr.kind === 'network') setAiStatus('offline');
        if (aiErr.kind === 'not_configured') setAiStatus('not_configured');
        if (aiErr.kind === 'aborted') {
          // Keep whatever was streamed before the user pressed stop.
          const partial = messagesRef.current.find((m) => m.id === assistantId);
          if (partial && user) saveChatMessage(user.id, partial);
        } else {
          if (started) setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          setError({ message: aiErr.message, retryText: query });
        }
      } finally {
        abortRef.current = null;
        setPending(false);
        setStreamingId(null);
        scrollToEnd();
      }
    },
    [pending, streamingId, user, scrollToEnd]
  );

  useEffect(() => {
    if (params.query && !handledParam.current && !historyLoading) {
      handledParam.current = true;
      send(String(params.query));
    }
  }, [params.query, historyLoading, send]);

  function handleStop() {
    abortRef.current?.abort();
  }

  function handleRegenerate() {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    const lastIndex = messages.length - 1;
    if (messages[lastIndex]?.role === 'assistant') {
      setMessages(messages.slice(0, lastIndex));
      messagesRef.current = messages.slice(0, lastIndex);
    }
    send(lastUser.content, { reuseLastUser: true });
  }

  async function handleCopy(message: ChatMessage) {
    await Clipboard.setStringAsync(message.content);
    setCopiedId(message.id);
    setTimeout(() => setCopiedId((id) => (id === message.id ? null : id)), 1600);
  }

  function handleNewChat() {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setInput('');
    if (user) clearChatHistory(user.id);
  }

  function handleBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home');
  }

  function handleKeyPress(e: any) {
    if (Platform.OS !== 'web') return;
    if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
      e.preventDefault?.();
      send(input);
    }
  }

  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;
  const showEmpty = !historyLoading && messages.length === 0 && !pending && !error;
  const canSend = input.trim().length > 0 && !busy && configured;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={C.ink} />
          </Pressable>

          <View style={styles.headerCenter}>
            <AssistantAvatar size={34} />
            <View>
              <Text style={styles.headerTitle}>{ASSISTANT_NAME}</Text>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        aiStatus === 'ready' ? C.success : aiStatus === 'checking' ? C.warning : C.danger,
                    },
                  ]}
                />
                <Text style={styles.statusText}>
                  {busy
                    ? 'Responding...'
                    : aiStatus === 'checking'
                      ? 'Connecting...'
                      : aiStatus === 'offline'
                        ? 'Server offline'
                        : aiStatus === 'not_configured'
                          ? 'Not configured'
                          : 'Research assistant'}
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={handleNewChat}
            disabled={messages.length === 0 && !error}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.iconButtonPressed,
              messages.length === 0 && !error && styles.iconButtonDisabled,
            ]}
            accessibilityLabel="Start a new chat"
          >
            <Ionicons name="create-outline" size={20} color={C.ink} />
          </Pressable>
        </View>

        {/* Conversation */}
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[styles.chatContent, showEmpty && styles.chatContentEmpty]}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (busy) scrollToEnd(false);
          }}
        >
          {historyLoading && (
            <View style={styles.centerFill}>
              <ActivityIndicator color={C.brand} />
              <Text style={styles.mutedText}>Loading your conversation</Text>
            </View>
          )}

          {showEmpty && (
            <View style={styles.empty}>
              <View style={styles.emptyBadgeRing}>
                <AssistantAvatar size={64} />
              </View>
              <Text style={styles.emptyTitle}>How can I help you today?</Text>
              <Text style={styles.emptySubtitle}>
                Ask about heat stress, weather and climate. Answers are tailored for {city.name}.
              </Text>

              {(aiStatus === 'not_configured' || aiStatus === 'offline') && (
                <View style={[styles.errorCard, styles.emptyNotice]}>
                  <Ionicons
                    name={aiStatus === 'offline' ? 'cloud-offline-outline' : 'key-outline'}
                    size={18}
                    color={C.danger}
                  />
                  <Text style={styles.errorText}>
                    {aiStatus === 'offline'
                      ? 'Cannot reach the UrbanHeat Watch server. Make sure it is running, then try again.'
                      : 'The AI assistant is not set up on the UrbanHeat Watch server yet. Add OPENROUTER_API_KEY to backend/api/.env and restart the server.'}
                  </Text>
                </View>
              )}

              <View style={styles.suggestionList}>
                {suggestions.map((s) => (
                  <Pressable
                    key={s.title}
                    onPress={() => send(s.prompt)}
                    disabled={!configured}
                    style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]}
                  >
                    <View style={styles.suggestionIcon}>
                      <Ionicons name={s.icon} size={19} color={C.brandDeep} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.suggestionTitle}>{s.title}</Text>
                      <Text style={styles.suggestionSubtitle}>{s.subtitle}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={16} color={C.inkMuted} />
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {messages.map((m) => {
            if (m.role === 'user') {
              return (
                <View key={m.id} style={styles.userRow}>
                  <View style={styles.userBubble}>
                    <Text style={styles.userText} selectable>
                      {m.content}
                    </Text>
                  </View>
                  <Text style={styles.userTime}>{formatTime(m.timestamp)}</Text>
                </View>
              );
            }

            const isStreaming = m.id === streamingId;
            return (
              <View key={m.id} style={styles.assistantRow}>
                <View style={styles.assistantMeta}>
                  <AssistantAvatar size={26} />
                  <Text style={styles.assistantName}>{ASSISTANT_NAME}</Text>
                  <Text style={styles.assistantTime}>{formatTime(m.timestamp)}</Text>
                </View>
                <View style={styles.assistantCard}>
                  <MarkdownMessage content={m.content} isUser={false} />
                </View>
                {!isStreaming && (
                  <View style={styles.actionRow}>
                    <ActionButton
                      icon={copiedId === m.id ? 'checkmark' : 'copy-outline'}
                      label={copiedId === m.id ? 'Copied' : 'Copy'}
                      onPress={() => handleCopy(m)}
                    />
                    {m.id === lastAssistantId && !busy && (
                      <ActionButton icon="refresh" label="Regenerate" onPress={handleRegenerate} />
                    )}
                    {m.model ? <Text style={styles.modelLabel}>{formatModelName(m.model)}</Text> : null}
                  </View>
                )}
              </View>
            );
          })}

          {pending && (
            <View style={styles.assistantRow}>
              <View style={styles.assistantMeta}>
                <AssistantAvatar size={26} />
                <Text style={styles.assistantName}>{ASSISTANT_NAME}</Text>
              </View>
              <View style={[styles.assistantCard, styles.pendingCard]}>
                <TypingIndicator />
                <Text style={styles.mutedText}>Researching</Text>
              </View>
            </View>
          )}

          {error && (
            <View style={styles.assistantRow}>
              <View style={styles.errorCard}>
                <Ionicons name="alert-circle" size={18} color={C.danger} />
                <View style={styles.flex}>
                  <Text style={styles.errorTitle}>Response failed</Text>
                  <Text style={styles.errorText}>{error.message}</Text>
                  <Pressable
                    onPress={() => {
                      const retry = error.retryText;
                      send(retry, { reuseLastUser: true });
                    }}
                    style={({ pressed }) => [styles.retryButton, pressed && styles.actionButtonPressed]}
                  >
                    <Ionicons name="refresh" size={14} color="#FFFFFF" />
                    <Text style={styles.retryText}>Try again</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Composer */}
        <View style={styles.composerWrap}>
          <View style={[styles.composer, !configured && styles.composerDisabled]}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={configured ? `Message ${ASSISTANT_NAME}` : 'AI is not configured'}
              placeholderTextColor={C.inkMuted}
              editable={configured}
              multiline
              onKeyPress={handleKeyPress}
              onContentSizeChange={(e) => setInputHeight(Math.min(120, Math.max(24, e.nativeEvent.contentSize.height)))}
              style={[styles.input, { height: Platform.OS === 'web' ? inputHeight : undefined }]}
            />
            {busy ? (
              <Pressable
                onPress={handleStop}
                style={({ pressed }) => [styles.sendButton, styles.stopButton, pressed && styles.iconButtonPressed]}
                accessibilityLabel="Stop generating"
              >
                <Ionicons name="stop" size={16} color="#FFFFFF" />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => send(input)}
                disabled={!canSend}
                style={({ pressed }) => [
                  styles.sendButton,
                  !canSend && styles.sendButtonDisabled,
                  pressed && canSend && styles.iconButtonPressed,
                ]}
                accessibilityLabel="Send message"
              >
                <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
              </Pressable>
            )}
          </View>
          <Text style={styles.disclaimer}>
            AI can make mistakes. In a heat emergency, call your local emergency number.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: C.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.borderStrong,
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: C.ink, letterSpacing: -0.2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, color: C.inkMuted, fontWeight: '500' },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  iconButtonPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  iconButtonDisabled: { opacity: 0.4 },

  chatContent: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    gap: 18,
  },
  chatContentEmpty: { flexGrow: 1, justifyContent: 'center' },
  centerFill: { alignItems: 'center', gap: 10, paddingVertical: 60 },
  mutedText: { fontSize: 13, color: C.inkMuted, fontWeight: '500' },

  empty: { alignItems: 'center', paddingVertical: 12 },
  emptyBadgeRing: {
    padding: 8,
    borderRadius: 48,
    backgroundColor: C.brandTint,
    marginBottom: 18,
  },
  emptyTitle: { fontSize: 24, fontWeight: '800', color: C.ink, letterSpacing: -0.5, textAlign: 'center' },
  emptySubtitle: {
    fontSize: 14.5,
    color: C.inkSoft,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 320,
  },
  emptyNotice: { marginTop: 18, alignSelf: 'stretch' },
  suggestionList: { alignSelf: 'stretch', gap: 10, marginTop: 26 },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 14,
    shadowColor: '#3D2A1A',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  suggestionPressed: { backgroundColor: '#FFF9F3', borderColor: '#F3C9A6' },
  suggestionIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: C.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionTitle: { fontSize: 14.5, fontWeight: '700', color: C.ink },
  suggestionSubtitle: { fontSize: 12.5, color: C.inkMuted, marginTop: 2 },

  userRow: { alignItems: 'flex-end', gap: 4 },
  userBubble: {
    maxWidth: '84%',
    backgroundColor: C.ink,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  userText: { color: '#FFFFFF', fontSize: 15, lineHeight: 22 },
  userTime: { fontSize: 11, color: C.inkMuted, marginRight: 4 },

  assistantRow: { alignItems: 'stretch', gap: 8 },
  assistantMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  assistantName: { fontSize: 13.5, fontWeight: '700', color: C.ink },
  assistantTime: { fontSize: 11.5, color: C.inkMuted },
  assistantCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderTopLeftRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#3D2A1A',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  pendingCard: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' },
  typingRow: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.brand },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 2 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  actionButtonPressed: { opacity: 0.7 },
  actionLabel: { fontSize: 12, fontWeight: '600', color: C.inkSoft },
  modelLabel: { marginLeft: 'auto', fontSize: 11, color: C.inkMuted, fontWeight: '500' },

  errorCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: C.dangerTint,
    borderWidth: 1,
    borderColor: '#FECDCA',
    borderRadius: 14,
    padding: 14,
  },
  errorTitle: { fontSize: 14, fontWeight: '700', color: C.danger, marginBottom: 2 },
  errorText: { flex: 1, fontSize: 13.5, color: '#7A271A', lineHeight: 19 },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: C.danger,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 10,
  },
  retryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  composerWrap: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.borderStrong,
    borderRadius: 26,
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: 6,
    shadowColor: '#3D2A1A',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  composerDisabled: { opacity: 0.6 },
  input: {
    flex: 1,
    minHeight: 24,
    maxHeight: 120,
    fontSize: 15.5,
    lineHeight: 22,
    color: C.ink,
    paddingTop: Platform.OS === 'ios' ? 9 : 8,
    paddingBottom: 8,
    ...webNoOutline,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#E4D8CB' },
  stopButton: { backgroundColor: C.ink },
  disclaimer: { fontSize: 11, color: C.inkMuted, textAlign: 'center', marginTop: 7 },
});
