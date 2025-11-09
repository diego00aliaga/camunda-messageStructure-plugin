/* * 🚨 ADVERTENCIA DE SEGURIDAD 🚨
 * Esta API key ("AIzaSy...") está expuesta. 
 * Bórrala y crea una nueva en Google AI Studio.
 */

// --- Configuración Exacta del CURL ---

// 1. URL (tal como en tu curl)
const URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// 2. La API Key (tal como en tu header 'X-goog-api-key')
const API_KEY = "AIzaSyD7pA4UTuDDN5Y67CvtRsx8ZHr545cA4Fg";

// 3. El "body" o "-d" (tal como en tu curl)
const payload = {
    contents: [
      {
        parts: [
          {
            text: "responde quien es cr7"
          }
        ]
      }
    ]
  };


async function run() {
  try {
    console.log('Gemini Service (usando fetch) ejecutado correctamente');
    console.log("Llamando a:", URL); // Muestra la URL que estás usando

    // 4. La llamada fetch (POST, con los headers y body de tu curl)
    const response = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': API_KEY // Usando el header de tu curl
      },
      body: JSON.stringify(payload) // Convirtiendo el body a JSON string
    });

    // 5. Manejo de errores
    if (!response.ok) {
      const errorData = await response.json();
      // Esto mostrará el error 404 que probablemente recibirás
      throw new Error(`Error ${response.status}: ${errorData.error.message}`); 
    }

    // 6. Obtener la respuesta
    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;

    console.log(text);
    return text;

  } catch (error) {
    console.error("Error al ejecutar Gemini con fetch:", error.message);
    throw error;
  }
}

// Exporta la función
module.exports = {
  run
};