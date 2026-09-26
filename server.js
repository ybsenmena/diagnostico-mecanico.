import express from 'express';
import dotenv from 'dotenv';
import { CohereClient } from 'cohere-ai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

app.post('/api/diagnosticar', async (req, res) => {
  try {
    const { historial } = req.body;

    if (!historial || !Array.isArray(historial) || historial.length === 0) {
      return res.status(400).json({ error: "No se envió un historial válido." });
    }

    const historialReciente = historial.slice(-6);

    const promptSistema = `Eres un mecánico automotriz de confianza, muy experto, cercano y amigable. 
Mantén una conversación fluida. Si falta información para diagnosticar, responde amablemente haciendo preguntas aclaratorias.
Solo proporciona causaProbable y soluciones cuando los síntomas estén claros.

DEBES responder ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "respuestaConversacional": "Tu respuesta amigable o preguntas aquí",
  "causaProbable": "Causa estimada si aplica, o texto vacío ''",
  "soluciones": ["Solución 1", "Solución 2"]
}`;

    const chatHistory = historialReciente.map(msg => ({
      role: msg.rol === "usuario" ? "USER" : "CHATBOT",
      message: String(msg.texto || '')
    }));

    const ultimoMensaje = chatHistory.pop();

    const response = await cohere.chat({
      model: 'command-r-plus',
      preamble: promptSistema,
      message: ultimoMensaje ? ultimoMensaje.message : "Hola",
      chatHistory: chatHistory,
      temperature: 0.5,
      responseFormat: { type: "json_object" }
    });

    // Limpieza de caracteres de bloque markdown de código si la IA los incluye
    let textoLimpio = response.text.trim();
    if (textoLimpio.startsWith("```")) {
      textoLimpio = textoLimpio.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    }

    const resultadoJSON = JSON.parse(textoLimpio);
    return res.json(resultadoJSON);

  } catch (e) {
    console.error("ERROR DETALLADO EN COHERE:", e);
    
    // Respuesta de respaldo limpia si falla el parseo
    return res.json({
      respuestaConversacional: "Hola, cuéntame un poco más sobre la falla o síntoma que presenta tu vehículo para poder ayudarte.",
      causaProbable: "",
      soluciones: []
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor activo escuchando en el puerto ${PORT}`);
});
