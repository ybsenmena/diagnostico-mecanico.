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
    const ultimoMsgObjeto = historialReciente[historialReciente.length - 1];
    const textoUsuario = ultimoMsgObjeto ? String(ultimoMsgObjeto.texto || '') : "Hola";

    const mensajesPrevios = historialReciente.slice(0, -1);
    const chatHistory = mensajesPrevios.map(msg => ({
      role: msg.rol === "usuario" ? "USER" : "CHATBOT",
      message: String(msg.texto || '')
    }));

    const promptSistema = `Eres un mecánico automotriz de confianza, experto y amigable.
Tu función es dialogar con el usuario para entender los síntomas mecánicos de su vehículo.

FORMATO OBLIGATORIO: Debes responder EXCLUSIVAMENTE con un JSON válido. No agregues texto antes ni después.
Estructura:
{
  "respuestaConversacional": "Tu mensaje amigable o preguntas aclaratorias",
  "causaProbable": "Causa estimada si hay suficientes datos, de lo contrario texto vacío ''",
  "soluciones": ["Paso o sugerencia 1", "Paso o sugerencia 2"]
}`;

    // Petición HTTP directa a Cohere V1 Chat API
    const cohereResponse = await fetch('https://api.cohere.com/v1/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        model: 'command-r-plus',
        preamble: promptSistema,
        message: textoUsuario,
        chat_history: chatHistory.length > 0 ? chatHistory : undefined,
        temperature: 0.4
      })
    });

    const dataCohere = await cohereResponse.json();

    if (!cohereResponse.ok) {
      console.error("Error devuelto por la API de Cohere:", dataCohere);
      return res.status(500).json({
        error: "Error en la respuesta de Cohere",
        detalle: dataCohere.message || dataCohere
      });
    }

    let textoRaw = dataCohere.text || '';
    const jsonMatch = textoRaw.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const resultadoJSON = JSON.parse(jsonMatch[0]);
      return res.json(resultadoJSON);
    } else {
      return res.json({
        respuestaConversacional: textoRaw,
        causaProbable: "",
        soluciones: []
      });
    }

  } catch (e) {
    console.error("ERROR GRAVE EN SERVIDOR:", e);
    return res.status(500).json({
      error: "Excepción en el servidor Node.js",
      mensaje: e.message
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor activo escuchando en el puerto ${PORT}`);
});
