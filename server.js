import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        respuestaConversacional: { 
          type: Type.STRING, 
          description: "Respuesta amigable, directa y cercana a la última pregunta o aclaración del usuario." 
        },
        causaProbable: { 
          type: Type.STRING, 
          description: "Resumen de la causa principal estimada basándote en la falla expuesta." 
        },
        soluciones: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING }, 
          description: "Lista de hasta 3 recomendaciones prácticas o pasos a seguir." 
        },
      },
      required: ["respuestaConversacional", "causaProbable", "soluciones"],
    };

    const promptSistema = `Eres un mecánico automotriz de confianza, cercano y muy experto. 
Habla de manera amigable, en segunda persona y directo al punto.
Analiza la conversación previa con el usuario para responder de forma coherente con el contexto acumulado.`;

    const contenidos = [
      { role: "user", parts: [{ text: promptSistema }] },
      ...historial.map(msg => ({
        role: msg.rol === "usuario" ? "user" : "model",
        parts: [{ text: msg.texto }]
      }))
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contenidos,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    return res.json(JSON.parse(response.text));

  } catch (e) {
    console.error("ERROR DETALLADO EN RENDER:", e);
    return res.status(500).json({ error: "Error interno al procesar el diagnóstico." });
  }
});

// Levantar el servidor asociando la dirección a 0.0.0.0 para que Render lo detecte sin problemas
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor activo y escuchando en el puerto ${PORT}`);
});
