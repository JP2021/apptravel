/**
 * API que extrai texto de PDF (mesmo projeto, roda com npm run dev).
 * Endpoint: POST /extract-pdf  body: { pdfBase64: "..." }  → { text: "..." }
 */

const express = require('express');
const cors = require('cors');
const pdfParse = require('pdf-parse');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.post('/extract-pdf', async (req, res) => {
  try {
    let buffer = null;

    if (req.body?.pdfBase64) {
      buffer = Buffer.from(req.body.pdfBase64, 'base64');
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: 'Envie pdfBase64 no body (PDF em base64).' });
    }

    const data = await pdfParse(buffer);
    const text = (data?.text || '').trim() || '[Nenhum texto extraído do PDF.]';

    res.json({ text });
  } catch (err) {
    console.error('Erro ao extrair PDF:', err);
    res.status(500).json({
      error: 'Falha ao extrair texto do PDF.',
      detail: err?.message || String(err),
    });
  }
});

app.get('/health', (_, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`API de extração de PDF rodando em http://localhost:${PORT}`);
});
