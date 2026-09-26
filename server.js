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

    // Tomar los últimos 6 mensajes
    const historialReciente = historial.slice(-6);
    const ultimoMsgObjeto = historialReciente[historialReciente.length - 1];
    const textoUsuario = ultimoMsgObjeto ? String(ultimoMsgObjeto.texto || '') : "Hola";

    // Formatear el historial previo excluyendo el último mensaje
    const mensajesPrevios = historialReciente.slice(0, -1);
    const chatHistoryFormatted = mensajesPrevios.map(msg => ({
      role: msg.rol === "usuario" ? "USER" : "CHATBOT",
      message: String(msg.texto || '').trim()
    })).filter(msg => msg.message.length > 0);

    const promptSistema = `Eres un mecánico automotriz de confianza, experto y amigable.
Tu función es dialogar con el usuario para entender los síntomas mecánicos de su vehículo.

FORMATO OBLIGATORIO: Debes responder EXCLUSIVAMENTE con un JSON válido. No agregues texto explicativo fuera del JSON.
Estructura JSON requerida:
{
  "respuestaConversacional": "Tu mensaje amigable o preguntas aclaratorias sobre los síntomas del auto",
  "causaProbable": "Causa estimada si hay suficientes datos, de lo contrario texto vacío ''",
  "soluciones": ["Paso o sugerencia 1", "Paso o sugerencia 2"]
}`;

    // Construcción del payload
    const payload = {
      model: 'command-r-plus',
      preamble: promptSistema,
      message: textoUsuario,
      temperature: 0.3,
      response_format: { type: "json_object" }
    };

    // Solo adjuntar chat_history si contiene mensajes
    if (chatHistoryFormatted.length > 0) {
      payload.chat_history = chatHistoryFormatted;
    }

    const cohereResponse = await fetch('https://api.cohere.com/v1/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.COHERE_API_KEY ? process.env.COHERE_API_KEY.trim() : ''}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const dataCohere = await cohereResponse.json();

    if (!cohereResponse.ok) {
      console.error("ERROR DESDE COHERE API:", JSON.stringify(dataCohere, null, 2));
      return res.status(500).json({
        error: "Fallo en la comunicación con Cohere",
        detalle: dataCohere.message || dataCohere
      });
    }

    let textoRaw = dataCohere.text || '';
    
    // Limpieza de bloques ```json si la IA los incluye
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
    console.error("EXCEPCIÓN EN EL SERVIDOR:", e);
    return res.status(500).json({
      error: "Error interno en el servidor",
      mensaje: e.message
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor activo escuchando en el puerto ${PORT}`);
});
