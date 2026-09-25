import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();
const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/api/diagnosticar', async (req, res) => {
  try {
    const { descripcion } = req.body;
    if (!descripcion) return res.status(400).json({ error: "Escribe la falla." });

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        causaProbable: { type: Type.STRING },
        soluciones: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["causaProbable", "soluciones"],
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Eres un mecánico experto. Revisa esta falla y dame 1 causa probable y 3 soluciones breves:\n"${descripcion}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    return res.json(JSON.parse(response.text));
  } catch (e) {
    return res.status(500).json({ error: "Error en el servidor." });
  }
});

app.listen(process.env.PORT || 3000);
