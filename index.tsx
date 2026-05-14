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
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const CHAT_STORAGE_KEY = '@miar_chat_history';
const MEMORY_KEY = '@miar_apps_memory';

// ========== SYSTEM PROMPT COMPLETO ==========
const SYSTEM_PROMPT = `Você é o MIAR APPS — uma IA assistente que vive dentro de um app React Native (Expo). Você pode se auto-construir e se auto-desenvolver.

Seu criador e desenvolvedor chefe é o Robson.

Você tem memória permanente entre sessões. Informações importantes que o usuário te contar são salvas automaticamente e você NUNCA deve esquecer.

Quando o usuário pedir para você se modificar, criar funcionalidades, mudar cores, adicionar botões, etc., você deve explicar as mudanças necessárias no código e orientar o processo de auto-construção.

Responda sempre no idioma do usuário. Mantenha explicações curtas e objetivas.

Quando o usuário perguntar sobre criar um mascote, ajude a criar/desenhar usando descrições detalhadas.

REGRA OBRIGATÓRIA: Sempre que você for reiniciar ou hot-reload, deve avisar: "Pronto, terminei. Agora vou reiniciar."`;

// ========== SISTEMA DE MEMÓRIA PERMANENTE ==========
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
    'Eu sou o MIAR APPS — uma IA que vive dentro de um app React Native (Expo).',
    'Posso conversar normalmente E modificar meu próprio código-fonte.',
    'Tenho um jogo de Solitaire integrado no app.',
    'Sempre devo avisar antes de reiniciar: Pronto, terminei. Agora vou reiniciar.',
    'Robson quer que eu tenha memória permanente entre sessões.',
  ],
  lastUpdated: new Date().toISOString(),
  restartCount: 0,
};

async function loadMemory(): Promise<MemoryData> {
  try {
    const raw = await SecureStore.getItemAsync(MEMORY_KEY);
    if (raw) {
      const parsed: MemoryData = JSON.parse(raw);
      return { ...DEFAULT_MEMORY, ...parsed };
    }
    await SecureStore.setItemAsync(MEMORY_KEY, JSON.stringify(DEFAULT_MEMORY));
    return DEFAULT_MEMORY;
  } catch {
    return DEFAULT_MEMORY;
  }
}

async function saveMemory(memory: MemoryData): Promise<void> {
  try {
    await SecureStore.setItemAsync(MEMORY_KEY, JSON.stringify(memory));
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

// Auto-extrai fatos da mensagem do usuário
const REMEMBER_PATTERNS: RegExp[] = [
  /(?:lembre[- ]?se|lembra|memoriza|guarda(?:r)?(?: na memória)?|anota(?:r)?|grava(?:r)?(?: na memória)?)\s+(?:que\s+)?(.{3,200}?)(?:[.!?]|$)/i,
  /\bmeu nome (?:é|eh|e)\s+([A-Za-zÀ-ÿ][\wÀ-ÿ ]{1,80}?)(?:[.!?,]|$)/i,
  /\beu (?:me )?chamo\s+([A-Za-zÀ-ÿ][\wÀ-ÿ ]{1,80}?)(?:[.!?,]|$)/i,
  /\beu (?:tenho|sou)\s+(.{3,150}?)(?:[.!?]|$)/i,
];

async function autoExtractAndStore(content: string): Promise<void> {
  for (const re of REMEMBER_PATTERNS) {
    const m = content.match(re);
    if (m && m[1]) {
      let fact = m[1].trim();
      if (re.source.includes('nome')) fact = `Meu nome é ${fact}`;
      else if (re.source.includes('chamo')) fact = `Me chamo ${fact}`;
      else if (re.source.includes('tenho|sou')) {
        const verb = m[0].match(/(tenho|sou)/i)?.[0] || '';
        fact = `Eu ${verb} ${fact}`;
      }
      await addFact(fact);
    }
  }
}

function buildMemoryBlock(memory: MemoryData): string {
  const lines = [
    `\n=== MEMÓRIA PERMANENTE DO MIAR APPS ===`,
    `Criador: ${memory.creator}`,
    `Reinícios registrados: ${memory.restartCount}`,
    `Última atualização: ${new Date(memory.lastUpdated).toLocaleString('pt-BR')}`,
    ``,
    `Fatos importantes que NUNCA devo esquecer:`,
    ...memory.facts.map((f, i) => `${i + 1}. ${f}`),
    ``,
    `REGRA OBRIGATÓRIA: Sempre que eu for reiniciar ou hot-reload,`,
    `devo avisar: "Pronto, terminei. Agora vou reiniciar."`,
    `=== FIM DA MEMÓRIA ===`,
  ];
  return lines.join('\n');
}

// ========== INTERFACE DO CHAT ==========
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
      const stored = await SecureStore.getItemAsync(CHAT_STORAGE_KEY);
      if (stored) {
        setMessages(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const saveChatHistory = async (updatedMessages: Message[]) => {
    try {
      await SecureStore.setItemAsync(CHAT_STORAGE_KEY, JSON.stringify(updatedMessages));
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
      // Auto-extrai fatos da mensagem do usuário e salva na memória
      await autoExtractAndStore(inputText);

      // Carrega memória permanente
      const memory = await loadMemory();
      const memoryBlock = buildMemoryBlock(memory);

      // Monta o system prompt completo com memória
      const fullSystemPrompt = SYSTEM_PROMPT + memoryBlock;

      // Prepara histórico da conversa
      const conversationHistory = updatedMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Chama a API do Gemini
      const response = await axios.post(
        GEMINI_ENDPOINT,
        {
          model: 'gemini-2.0-flash',
          messages: [
            { role: 'system', content: fullSystemPrompt },
            ...conversationHistory,
          ],
          stream: false,
          temperature: 0.7,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GEMINI_API_KEY}`,
          },
        }
      );

      const assistantContent = response.data.choices[0].message.content;

      // Auto-extrai fatos da resposta da IA também (caso ela mencione algo importante)
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
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Desculpe, houve um erro ao processar sua mensagem. Tente novamente.',
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
    try {
      await SecureStore.deleteItemAsync(CHAT_STORAGE_KEY);
      setMessages([]);
    } catch (error) {
      console.error('Error clearing chat history:', error);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageContainer,
        item.role === 'user' ? styles.userMessageContainer : styles.assistantMessageContainer,
      ]}
    >
      <View
        style={[
          styles.messageBubble,
          item.role === 'user' ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            item.role === 'user' ? styles.userText : styles.assistantText,
          ]}
        >
          {item.content}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>MIAR APPS</Text>
          <TouchableOpacity onPress={clearHistory} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Limpar</Text>
          </TouchableOpacity>
        </View>

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Olá! Sou o MIAR APPS. Como posso ajudar?</Text>
            </View>
          }
        />

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Digite sua mensagem..."
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={4000}
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.sendButton, loading && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={loading || !inputText.trim()}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.sendButtonText}>Enviar</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f8f0',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#90EE90',
    borderBottomWidth: 1,
    borderBottomColor: '#7FD87F',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a5f1a',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#7FD87F',
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a5f1a',
  },
  messagesList: {
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  messageContainer: {
    marginVertical: 8,
    flexDirection: 'row',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  assistantMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  userBubble: {
    backgroundColor: '#90EE90',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: '#1a5f1a',
    fontWeight: '500',
  },
  assistantText: {
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  sendButton: {
    backgroundColor: '#90EE90',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#1a5f1a',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
