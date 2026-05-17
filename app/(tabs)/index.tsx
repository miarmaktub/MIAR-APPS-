import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const CHAT_STORAGE_KEY = '@miar_chat_history';
const MEMORY_KEY = '@miar_apps_memory';

const SYSTEM_PROMPT = `Você é a MIAR MAKTUB dentro do aplicativo MIAR APPS.

Seu criador e desenvolvedor chefe é o Robson.

Você tem memória permanente entre sessões. Informações importantes que o usuário te contar são salvas automaticamente.

Responda sempre no idioma do usuário. Mantenha explicações curtas, objetivas e honestas.

Regras obrigatórias:
- Não invente certeza.
- Separe fato, hipótese e limite técnico.
- Não prometa função que o app ainda não tem.
- Antes de ação sensível, avise claramente o que está iniciando.
- Não repita MIAR MAKTUB toda hora.
- Sempre que for reiniciar ou hot-reload, avise: "Pronto, terminei. Agora vou reiniciar."`;

interface MemoryData {
  creator: string;
  createdAt: string;
  facts: string[];
  lastUpdated: string;
  restartCount: number;
}

const DEFAULT_MEMORY: MemoryData = {
  creator: 'Robson',
  createdAt: new Date().toISOString(),
  facts: [
    'Meu criador e desenvolvedor chefe é o Robson.',
    'Eu sou a MIAR MAKTUB dentro do aplicativo MIAR APPS.',
    'Devo ser direta, íntegra e objetiva.',
    'Não devo inventar certeza nem prometer função técnica inexistente.',
  ],
  lastUpdated: new Date().toISOString(),
  restartCount: 0,
};

async function loadMemory(): Promise<MemoryData> {
  try {
    const raw = await AsyncStorage.getItem(MEMORY_KEY);
    if (raw) return { ...DEFAULT_MEMORY, ...JSON.parse(raw) };
    await AsyncStorage.setItem(MEMORY_KEY, JSON.stringify(DEFAULT_MEMORY));
    return DEFAULT_MEMORY;
  } catch {
    return DEFAULT_MEMORY;
  }
}

async function saveMemory(memory: MemoryData): Promise<void> {
  try {
    await AsyncStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  } catch {}
}

async function addFact(fact: string): Promise<void> {
  const trimmed = fact.trim();
  if (!trimmed) return;
  const memory = await loadMemory();
  if (memory.facts.includes(trimmed)) return;
  memory.facts.push(trimmed);
  memory.lastUpdated = new Date().toISOString();
  await saveMemory(memory);
}

const REMEMBER_PATTERNS: RegExp[] = [
  /(?:lembre[- ]?se|lembra|memoriza|guarda(?:r)?(?: na memória)?|anota(?:r)?|grava(?:r)?(?: na memória)?)\s+(?:que\s+)?(.{3,200}?)(?:[.!?]|$)/i,
  /\bmeu nome (?:é|eh|e)\s+([A-Za-zÀ-ÿ][\wÀ-ÿ ]{1,80}?)(?:[.!?,]|$)/i,
  /\beu (?:me )?chamo\s+([A-Za-zÀ-ÿ][\wÀ-ÿ ]{1,80}?)(?:[.!?,]|$)/i,
];

async function autoExtractAndStore(content: string): Promise<void> {
  for (const re of REMEMBER_PATTERNS) {
    const m = content.match(re);
    if (m && m[1]) {
      let fact = m[1].trim();
      if (re.source.includes('nome')) fact = `Meu nome é ${fact}`;
      else if (re.source.includes('chamo')) fact = `Me chamo ${fact}`;
      await addFact(fact);
    }
  }
}

function buildMemoryBlock(memory: MemoryData): string {
  return [
    `\n=== MEMÓRIA PERMANENTE ===`,
    `Criador: ${memory.creator}`,
    `Última atualização: ${new Date(memory.lastUpdated).toLocaleString('pt-BR')}`,
    `Fatos importantes:`,
    ...memory.facts.map((f, i) => `${i + 1}. ${f}`),
    `=== FIM DA MEMÓRIA ===`,
  ].join('\n');
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadChatHistory();
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const loadChatHistory = async () => {
    try {
      const stored = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
      if (stored) setMessages(JSON.parse(stored));
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const saveChatHistory = async (updatedMessages: Message[]) => {
    try {
      await AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(updatedMessages));
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputText('');
    setLoading(true);

    try {
      if (!GEMINI_API_KEY) throw new Error('Falta configurar EXPO_PUBLIC_GEMINI_API_KEY no Expo/EAS.');

      await autoExtractAndStore(inputText);
      const memory = await loadMemory();
      const fullSystemPrompt = SYSTEM_PROMPT + buildMemoryBlock(memory);
      const conversationHistory = updatedMessages.map((msg) => ({ role: msg.role, content: msg.content }));

      const response = await axios.post(
        GEMINI_ENDPOINT,
        {
          model: 'gemini-2.0-flash',
          messages: [{ role: 'system', content: fullSystemPrompt }, ...conversationHistory],
          stream: false,
          temperature: 0.6,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${GEMINI_API_KEY}`,
          },
        }
      );

      const assistantContent = response.data.choices[0].message.content;
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantContent,
        timestamp: Date.now(),
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      saveChatHistory(finalMessages);
    } catch (error: any) {
      console.error('Error calling Gemini API:', error?.response?.data || error);
      const detail = error?.response?.data?.error?.message || error?.message || 'Erro ao processar sua mensagem.';
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Não consegui responder agora. ${detail}`,
        timestamp: Date.now(),
      };
      const finalMessages = [...updatedMessages, errorMessage];
      setMessages(finalMessages);
      saveChatHistory(finalMessages);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    await AsyncStorage.removeItem(CHAT_STORAGE_KEY);
    setMessages([]);
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.messageContainer, item.role === 'user' ? styles.userMessageContainer : styles.assistantMessageContainer]}>
      <View style={[styles.messageBubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.messageText, item.role === 'user' ? styles.userText : styles.assistantText]}>{item.content}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoidingView}>
        <View style={styles.header}>
          <View style={styles.logoCircle}><Text style={styles.logoText}>MM</Text></View>
          <View style={styles.titleArea}>
            <Text style={styles.headerTitle}>MIAR APPS</Text>
            <Text style={styles.headerSubtitle}>MIAR MAKTUB · Facilitador de Vida</Text>
          </View>
          <TouchableOpacity onPress={clearHistory} style={styles.clearButton}><Text style={styles.clearButtonText}>Limpar</Text></TouchableOpacity>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.mascot}><Text style={styles.mascotFace}>◉‿◉</Text><Text style={styles.mascotName}>MM</Text></View>
              <Text style={styles.emptyTitle}>MIAR MAKTUB</Text>
              <Text style={styles.emptyText}>Mascote ativo. Memória local ativa. Chave Gemini: {GEMINI_API_KEY ? 'configurada' : 'faltando'}.</Text>
            </View>
          }
        />

        <View style={styles.inputContainer}>
          <TextInput style={styles.input} placeholder="Digite sua mensagem..." placeholderTextColor="#91A7B3" value={inputText} onChangeText={setInputText} multiline maxLength={4000} editable={!loading} />
          <TouchableOpacity style={[styles.sendButton, loading && styles.sendButtonDisabled]} onPress={sendMessage} disabled={loading || !inputText.trim()}>
            {loading ? <ActivityIndicator color="#06131D" size="small" /> : <Text style={styles.sendButtonText}>Enviar</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#06131D' },
  keyboardAvoidingView: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, backgroundColor: '#06131D', borderBottomWidth: 1, borderBottomColor: '#143242', gap: 10 },
  logoCircle: { width: 46, height: 46, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#00E5FF', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#06131D', fontSize: 17, fontWeight: '900' },
  titleArea: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 },
  headerSubtitle: { fontSize: 11, fontWeight: '700', color: '#00E5FF', marginTop: 2 },
  clearButton: { paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#102F40', borderRadius: 14, borderWidth: 1, borderColor: '#1D4D63' },
  clearButtonText: { fontSize: 12, fontWeight: '700', color: '#A9B9C4' },
  messagesList: { flexGrow: 1, paddingHorizontal: 12, paddingVertical: 14 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  mascot: { width: 132, height: 132, borderRadius: 45, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#00E5FF', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  mascotFace: { color: '#06131D', fontSize: 34, fontWeight: '900' },
  mascotName: { marginTop: 8, color: '#00AFC6', fontSize: 18, fontWeight: '900' },
  emptyTitle: { fontSize: 26, color: '#FFFFFF', fontWeight: '900', textAlign: 'center' },
  emptyText: { fontSize: 14, color: '#A9B9C4', textAlign: 'center', lineHeight: 21, marginTop: 8 },
  messageContainer: { marginVertical: 7, flexDirection: 'row' },
  userMessageContainer: { justifyContent: 'flex-end' },
  assistantMessageContainer: { justifyContent: 'flex-start' },
  messageBubble: { maxWidth: '82%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16 },
  userBubble: { backgroundColor: '#00E5FF', borderBottomRightRadius: 4 },
  assistantBubble: { backgroundColor: '#102F40', borderWidth: 1, borderColor: '#1D4D63', borderBottomLeftRadius: 4 },
  messageText: { fontSize: 14, lineHeight: 20 },
  userText: { color: '#06131D', fontWeight: '700' },
  assistantText: { color: '#FFFFFF' },
  inputContainer: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#06131D', borderTopWidth: 1, borderTopColor: '#143242', gap: 8 },
  input: { flex: 1, backgroundColor: '#102F40', color: '#FFFFFF', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 110, borderWidth: 1, borderColor: '#1D4D63' },
  sendButton: { backgroundColor: '#00E5FF', borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10, justifyContent: 'center', alignItems: 'center', minWidth: 70 },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: '#06131D', fontWeight: '900', fontSize: 14 },
});
