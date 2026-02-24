# API de extração de texto de PDF (mesmo projeto)

O app **não** carrega PDF na página. Esta API roda no mesmo projeto e só extrai o texto do PDF; o resultado é salvo em cache (AsyncStorage) e usado no envio à IA.

## Rodar tudo junto

Na raiz do projeto:

```bash
npm install
npm run dev
```

Isso sobe a API em `http://localhost:3001` e o Expo juntos. Depois abra o app (web/mobile) e use **"Processar anexos e montar roteiro com IA"**.

- Só a API: `npm run api`
- Só o Expo: `npm start`
