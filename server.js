import express from 'express';
import dotenv from 'dotenv';
import { CohereClient } from 'cohere-ai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

// Permitir peticiones desde AppCreator24 (CORS)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Inicializar cliente de Cohere
const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

app.post('/api/diagnosticar', async (req, res) => {
  try {
    const { historial } = req.body;

    if (!historial || !Array.isArray(historial) || historial.length === 0) {
      return res.status(400).json({ error: "No se envió un historial válido." });
    }

    // Mantener los últimos 6 mensajes para fluidez conversacional
    const historialReciente = historial.slice(-6);

    const promptSistema = `Eres un mecánico automotriz de confianza, muy experto, cercano y amigable. 
Mantén una conversación fluida con el usuario. Si te da un síntoma muy breve, responde haciéndole preguntas aclaratorias.
Solo proporciona causaProbable y soluciones cuando tengas contexto suficiente de la falla.

IMPORTANTE: Tu respuesta DEBE SER EXCLUSIVAMENTE un objeto JSON válido, sin bloques de código markdown, con esta estructura exacta:
{
  "respuestaConversacional": "Tu mensaje amigable o preguntas aclaratorias aquí",
  "causaProbable": "Causa estimada si aplica, o déjalo vacío ''",
  "soluciones": ["Sugerencia 1", "Sugerencia 2"]
}`;

    // Mapeo del historial para la API de Cohere
    const chatHistory = historialReciente.map(msg => ({
      role: msg.rol === "usuario" ? "USER" : "CHATBOT",
      message: String(msg.texto || '')
    }));

    // El último mensaje del usuario
    const ultimoMensaje = chatHistory.pop();

    const response = await cohere.chat({
      model: 'command-r-plus',
      preamble: promptSistema,
      message: ultimoMensaje ? ultimoMensaje.message : "Hola",
      chatHistory: chatHistory,
      temperature: 0.6,
      responseFormat: { type: "json_object" }
    });

    const resultadoJSON = JSON.parse(response.text);
    return res.json(resultadoJSON);

  } catch (e) {
    console.error("ERROR DETALLADO EN COHERE:", e);
    return res.status(500).json({ error: "Error interno al procesar el mensaje." });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor activo con Cohere escuchando en el puerto ${PORT}`);
});
