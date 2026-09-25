import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();
const app = express();
app.use(express.json());

// Permitir conexiones desde AppCreator24
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/api/diagnosticar', async (req, res) => {
  try {
    const { descripcion } = req.body;
    console.log("Consulta recibida:", descripcion);

    if (!descripcion) {
      return res.status(400).json({ error: "Por favor escribe la falla." });
    }

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        causaProbable: { type: Type.STRING },
        soluciones: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["causaProbable", "soluciones"],
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Eres un mecánico de confianza, amigable y muy experto. Habla de forma personal, directa y sin modismos raros ni tecnicismos complicados, como si le estuvieras explicando el problema a un amigo en tu taller. Analiza el siguiente síntoma del auto y devuelve la causa más probable y 3 soluciones prácticas:\n"${descripcion}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    console.log("Respuesta generada con éxito");
    return res.json(JSON.parse(response.text));

  } catch (e) {
    console.error("ERROR DETALLADO:", e);
    return res.status(500).json({ error: "Error interno al procesar el diagnóstico." });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Servidor escuchando en puerto " + (process.env.PORT || 3000));
});
