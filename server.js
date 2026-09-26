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

    const promptSistema = `Eres un mecánico automotriz de confianza, experto y amigable.
Tu tarea es dialogar con el usuario para entender la falla de su vehículo.

REGLA OBLIGATORIA: Debes responder EXCLUSIVAMENTE con un objeto JSON sin ningún texto antes ni después.
Estructura JSON requerida:
{
  "respuestaConversacional": "Tu respuesta cercana, amable o preguntas aclaratorias",
  "causaProbable": "Causa estimada del problema si hay suficientes datos, de lo contrario deja texto vacío ''",
  "soluciones": ["Paso o solución 1", "Paso o solución 2"]
}`;

    // Obtener el último mensaje del usuario
    const ultimoMsgObjeto = historialReciente[historialReciente.length - 1];
    const textoUsuario = ultimoMsgObjeto ? String(ultimoMsgObjeto.texto || '') : "Hola";

    // Historial previo para Cohere
    const mensajesPrevios = historialReciente.slice(0, -1);
    const chatHistory = mensajesPrevios.map(msg => ({
      role: msg.rol === "usuario" ? "USER" : "CHATBOT",
      message: String(msg.texto || '')
    }));

    const payload = {
      model: 'command-r-plus',
      preamble: promptSistema,
      message: textoUsuario,
      temperature: 0.3
    };

    if (chatHistory.length > 0) {
      payload.chatHistory = chatHistory;
    }

    const response = await cohere.chat(payload);

    // Extracción segura del JSON mediante Expresión Regular
    let textoRaw = response.text || '';
    const jsonMatch = textoRaw.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const resultadoJSON = JSON.parse(jsonMatch[0]);
      return res.json(resultadoJSON);
    } else {
      // Si no se detectó JSON estructurado, devolvemos el texto como respuesta conversacional
      return res.json({
        respuestaConversacional: textoRaw || "Cuéntame un poco más sobre la falla para poder orientarte.",
        causaProbable: "",
        soluciones: []
      });
    }

  } catch (e) {
    console.error("ERROR DETALLADO EN COHERE:", e);
    
    // Retorno de contingencia para que la app siempre responda
    return res.json({
      respuestaConversacional: "Hola. Por favor cuéntame qué ruidos, síntomas o fallas notas en tu vehículo.",
      causaProbable: "",
      soluciones: []
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor activo escuchando en el puerto ${PORT}`);
});
