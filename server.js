import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

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

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/api/diagnosticar', async (req, res) => {
  try {
    const { historial } = req.body;

    if (!historial || !Array.isArray(historial) || historial.length === 0) {
      return res.status(400).json({ error: "No se envió un historial válido." });
    }

    // MANTENER SOLO LOS ÚLTIMOS 6 MENSAJES PARA EVITAR TIMEOUTS
    const historialReciente = historial.slice(-6);

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        respuestaConversacional: { 
          type: Type.STRING, 
          description: "Respuesta amigable, directa y natural. Haz preguntas si necesitas más contexto." 
        },
        causaProbable: { 
          type: Type.STRING, 
          description: "Causa estimada si hay suficientes datos." 
        },
        soluciones: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING }, 
          description: "Sugerencias de acción si aplica." 
        },
      },
      required: ["respuestaConversacional"],
    };

    const promptSistema = `Eres un mecánico automotriz experto y amigable. 
Mantén una conversación fluida. Si falta información para diagnosticar, pregunta amablemente.
Solo proporciona causaProbable y soluciones cuando los síntomas estén claros.`;

    const contenidos = [
      { role: "user", parts: [{ text: promptSistema }] },
      ...historialReciente.map(msg => ({
        role: msg.rol === "usuario" ? "user" : "model",
        parts: [{ text: String(msg.texto || '') }]
      }))
    ];

    let response;
    let intentos = 0;
    const maxIntentos = 2;

    while (intentos < maxIntentos) {
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: contenidos,
          config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
          },
        });
        break;
      } catch (apiError) {
        intentos++;
        if (intentos >= maxIntentos) throw apiError;
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    return res.json(JSON.parse(response.text));

  } catch (e) {
    console.error("ERROR DETALLADO EN RENDER:", e);
    return res.status(500).json({ error: "Error interno al procesar el mensaje." });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
