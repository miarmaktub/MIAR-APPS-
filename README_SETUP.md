# MIAR APPS - Chat com Google Gemini

Um app Expo React Native minimalista e funcional que integra a API do Google Gemini para criar um assistente de IA em português.

## 🎯 Características

- **Chat em tempo real** com Google Gemini 2.5 Flash
- **Interface minimalista** com tema verde claro
- **Histórico local** de conversas usando AsyncStorage
- **System prompt em português**: "Você é o MIAR, uma IA assistente que se auto-desenvolve. Ajude o usuário com qualquer tarefa."
- **Standalone Expo** pronto para gerar APK via EAS Build
- **Sem dependências externas complexas** - apenas AsyncStorage e axios

## 📋 Requisitos

- Node.js 18+
- npm ou yarn
- EAS CLI (para gerar APK): `npm install -g eas-cli`
- Conta Expo (para usar EAS Build)

## 🚀 Instalação e Execução

### 1. Clonar o repositório

```bash
git clone https://github.com/MIARAPPS/MIAR-APPS-.git
cd MIAR-APPS-
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Executar localmente

Para testar no seu dispositivo via Expo Go:

```bash
npm start
```

Depois, escaneie o QR code com seu telefone usando o app Expo Go.

Ou execute diretamente em Android:

```bash
npm run android
```

## 🔨 Gerar APK para Android

### Usando EAS Build (Recomendado)

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

O APK será gerado e disponibilizado para download.

### Configuração do EAS

O arquivo `eas.json` já está configurado com o profile `preview` que gera APK:

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

## 📱 Configuração do App

### app.json

- **Nome**: MIAR APPS
- **Slug**: miar-apps
- **Package Android**: com.miarapps.miarapp
- **Bundle iOS**: com.miarapps.miarapp
- **Tema**: Verde claro (#90EE90)

### API Gemini

- **Chave**: AIzaSyDpWSPFF5OmFuSTT3rzhdlRHqrllh2VoKA
- **Modelo**: gemini-2.5-flash
- **Endpoint**: https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
- **Formato**: OpenAI-compatible

## 📂 Estrutura do Projeto

```
miar-apps/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx          # Tela principal do chat
│   │   ├── explore.tsx
│   │   └── _layout.tsx
│   ├── _layout.tsx
│   └── modal.tsx
├── components/                # Componentes reutilizáveis
├── constants/                 # Temas e constantes
├── hooks/                     # Custom React hooks
├── assets/                    # Ícones e imagens
├── app.json                   # Configuração Expo
├── eas.json                   # Configuração EAS Build
├── package.json
└── tsconfig.json
```

## 💬 Como Usar o Chat

1. **Abra o app** - A tela inicial mostra uma mensagem de boas-vindas
2. **Digite sua mensagem** na caixa de texto na parte inferior
3. **Toque em "Enviar"** ou use o botão de envio
4. **Aguarde a resposta** do MIAR (assistente IA)
5. **Histórico é salvo automaticamente** no dispositivo

### Botão "Limpar"

Toque no botão "Limpar" no header para apagar todo o histórico de conversas.

## 🎨 Tema de Cores

- **Verde Claro Principal**: #90EE90
- **Verde Escuro**: #7FD87F
- **Verde Texto**: #1a5f1a
- **Fundo**: #f0f8f0
- **Branco**: #ffffff

## 🔧 Troubleshooting

### Erro: "Cannot find module 'react-native'"

Execute:
```bash
npm install
```

### Erro: "API Key inválida"

Verifique se a chave da API do Gemini está correta no arquivo `app/(tabs)/index.tsx`.

### App não conecta à API

- Verifique sua conexão de internet
- Confirme que a chave da API está ativa
- Verifique se o endpoint está correto

## 📝 Notas Importantes

- O app armazena o histórico de chat **localmente** no dispositivo usando AsyncStorage
- A chave da API do Gemini está **hardcoded** no app (para produção, considere usar um backend)
- O app usa **Expo Router** para navegação
- Compatível com **iOS e Android**

## 🛠️ Desenvolvimento

### Adicionar novas dependências

```bash
npm install <package-name>
```

### Atualizar o chat

Edite o arquivo `app/(tabs)/index.tsx` para modificar a interface ou lógica do chat.

### Testar no web

```bash
npm run web
```

## 📄 Licença

Este projeto é propriedade de MIARAPPS.

## 📞 Suporte

Para dúvidas ou problemas, consulte a documentação do Expo:
- [Expo Documentation](https://docs.expo.dev)
- [Expo Router](https://docs.expo.dev/routing/introduction/)
- [AsyncStorage](https://react-native-async-storage.github.io/async-storage/)

---

**Desenvolvido com Expo React Native 54 e TypeScript 5.9**
