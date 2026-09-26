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

REGLA OBLIGATORIA: Debes responder EXCLUSIVAMENTE con un JSON válido. No agregues texto explicativo fuera del JSON.
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
      const rolCohere = msg.rol === "usuario" ? "user" : "assistant";
      const textoLimpio = String(msg.texto || '').trim();
      if (textoLimpio.length > 0) {
        messages.push({
          role: rolCohere,
          content: textoLimpio
        });
      }
    });

    const apiKey = (process.env.COHERE_API_KEY || '').trim();

    if (!apiKey) {
      return res.status(500).json({ error: "No existe la variable COHERE_API_KEY en Render." });
    }

    // Petición a la API V2 de Cohere con el nombre de modelo actualizado
    const cohereResponse = await fetch('https://api.cohere.com/v2/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        model: 'command-r-08-2024', // Modelo activo y compatible
        messages: messages,
        temperature: 0.3
      })
    });

    const dataCohere = await cohereResponse.json();

    if (!cohereResponse.ok) {
      console.error("DETALLE ERROR COHERE:", JSON.stringify(dataCohere, null, 2));
      return res.status(500).json({
        error: "Error devuelto por la API de Cohere",
        detalle: dataCohere.message || dataCohere
      });
    }

    let textoRaw = "";
    if (dataCohere.message && dataCohere.message.content && dataCohere.message.content.length > 0) {
      textoRaw = dataCohere.message.content[0].text || "";
    }

    // Limpieza de etiquetas Markdown
    textoRaw = textoRaw.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();

    const jsonMatch = textoRaw.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const resultadoJSON = JSON.parse(jsonMatch[0]);
      return res.json(resultadoJSON);
    } else {
      return res.json({
        respuestaConversacional: textoRaw || "Cuéntame más detalles sobre los síntomas del vehículo.",
        causaProbable: "",
        soluciones: []
      });
    }

  } catch (e) {
    console.error("EXCEPCIÓN EN SERVIDOR:", e);
    return res.status(500).json({
      error: "Error interno en el servidor Node.js",
      mensaje: e.message
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor activo escuchando en el puerto ${PORT}`);
});
