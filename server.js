import express from 'express';
import dotenv from 'dotenv';

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

app.post('/api/diagnosticar', async (req, res) => {
  try {
    const { historial } = req.body;

    if (!historial || !Array.isArray(historial) || historial.length === 0) {
      return res.status(400).json({ error: "No se envió un historial válido." });
    }

    const historialReciente = historial.slice(-6);

    const promptSistema = `Eres un mecánico automotriz de confianza, experto y amigable.
Tu función es dialogar con el usuario para entender los síntomas mecánicos de su vehículo.

FORMATO OBLIGATORIO: Debes responder EXCLUSIVAMENTE con un JSON válido. No agregues texto explicativo fuera del JSON.
Estructura JSON requerida:
{
  "respuestaConversacional": "Tu mensaje amigable o preguntas aclaratorias sobre los síntomas del auto",
  "causaProbable": "Causa estimada si hay suficientes datos, de lo contrario texto vacío ''",
  "soluciones": ["Paso o sugerencia 1", "Paso o sugerencia 2"]
}`;

    const messages = [
      { role: "system", content: promptSistema }
    ];

    historialReciente.forEach(msg => {
      const role = msg.rol === "usuario" ? "user" : "assistant";
      const content = String(msg.texto || '').trim();
      if (content.length > 0) {
        messages.push({ role, content });
      }
    });

    const apiKey = (process.env.GROQ_API_KEY || '').trim();

    if (!apiKey) {
      console.error("ERROR: No se encontró la variable GROQ_API_KEY.");
      return res.status(500).json({ error: "Falta la API Key de Groq en las variables de entorno." });
    }

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192', // Modelo activo de alta velocidad
        messages: messages,
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    });

    const dataGroq = await groqResponse.json();

    if (!groqResponse.ok) {
      console.error("ERROR RESPUESTA GROQ:", JSON.stringify(dataGroq, null, 2));
      return res.status(500).json({
        error: "Error en la respuesta de Groq",
        detalle: dataGroq.error || dataGroq
      });
    }

    let textoRaw = dataGroq.choices[0]?.message?.content || '';
    textoRaw = textoRaw.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();

    const jsonMatch = textoRaw.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const resultadoJSON = JSON.parse(jsonMatch[0]);
      return res.json(resultadoJSON);
    } else {
      return res.json({
        respuestaConversacional: textoRaw || "Cuéntame más detalles sobre las fallas de tu vehículo.",
        causaProbable: "",
        soluciones: []
      });
    }

  } catch (e) {
    console.error("EXCEPCIÓN EN SERVIDOR:", e);
    return res.status(500).json({
      error: "Error interno en el servidor",
      mensaje: e.message
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor activo escuchando en el puerto ${PORT}`);
});
