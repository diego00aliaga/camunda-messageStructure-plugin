// --- Configuración Exacta del CURL ---

// Importar el logger
const logger = require('../log/logger');
const path = require('path');

// 1. URL (tal como en tu curl)
const URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// 2. La API Key - Se obtiene de variable de entorno por seguridad
// Configura la variable de entorno GEMINI_API_KEY antes de ejecutar el plugin
// Ejemplo: export GEMINI_API_KEY="tu-api-key-aqui"
function getApiKey() {
  const configPath = path.resolve(__dirname, '../../config.json');
  let config;

  try {
    config = require(configPath);
  } catch (error) {
    const errorMsg = `Error al cargar config.json. Asegúrate de que el archivo existe en la raíz del plugin y tiene el formato correcto.\n\nRuta esperada: ${configPath}\n\nError: ${error.message}`;
    logger.log(errorMsg, 'ERROR');
    throw new Error(errorMsg);
  }

  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey) {
    const errorMsg = 'GEMINI_API_KEY no está configurada en config.json. Por favor, asegúrate de que el archivo config.json contiene la clave GEMINI_API_KEY con tu API key de Google AI Studio.\n\nRuta del archivo: ' + configPath;
    logger.log(errorMsg, 'ERROR');
    throw new Error(errorMsg);
  }
  return apiKey;
}

async function run(dataFieldsString = null) {
  const logs = [];
  const startTime = Date.now();
  
  try {
    // Validar API key al inicio de la ejecución
    const API_KEY = getApiKey();
    logger.log('API Key validada correctamente');
    logs.push('API Key validada');

    logger.log('Gemini Service (usando fetch) ejecutado correctamente');
    logger.log(`Llamando a: ${URL}`);
    logs.push('Gemini Service iniciado');
    logs.push(`URL: ${URL}`);
    
    var promptText = '';
    
    const systemPrompt = `Act as a Systematic Derivation Engine based on the methodology described in "Systematic derivation of class diagrams from communication-oriented business process models" (Gonzalez et al., 2011). Your task is to:

    1.  **Parse the provided BPMN 2.0 XML content.**
    2.  **Extract message structures** stored as JSON strings within \`<bpmn:documentation>\` tags associated with relevant BPMN elements (likely \`<bpmn:messageFlow>\` or specific task types like \`<bpmn:sendTask>\`, \`<bpmn:receiveTask>\`). The JSON string typically starts after a prefix like \`dataFields:\`.
    3.  **Identify the processing order** of these messages based on the sequence flow (\`<bpmn:sequenceFlow>\`) connections in the BPMN diagram (Rule R3). If the order is ambiguous, process them as encountered.
    4.  **Apply the following Derivation Rules (R1-R26)** incrementally to each extracted message structure, in the determined order, to build a UML Class Diagram.
    5.  **Generate a single, complete UML Class Diagram definition** using **PlantUML** syntax as the final output.
    
    **DERIVATION RULES (Apply strictly):**
    
    * **R1-R3 (Pre-processing):** Infer the processing order (R3) from the BPMN sequence flow. Focus on R2 application during processing.
    * **R2 (Mark Extension):** Within the extracted JSON \`messageStructure\`, check if the *first* child element has \`"type": "Reference Field"\` and includes \`"extends": true\`. If so, the entire message implies an extension of the subject class named in the \`messageStructure.name\`. Let's call this condition \`marked_R2_implies_extension\`.
    * **R4 (New Class):** Derive a NEW class for each root \`messageStructure\` processed WHERE \`marked_R2_implies_extension\` is FALSE.
    * **R5 (Class Name):** Use the \`messageStructure.name\` (this should be the *Subject Name*, e.g., \`PERIODO_ACADEMICO\`, \`ASIGNATURA\`) for the new class (R4) or the class to be extended (R23).
    * **R6 (Attributes):** Add attributes to the derived/extended class for each child element with \`"type": "Data Field"\`. Use names derived according to R7.
    * **R7 (Attribute Names):** Convert child \`name\` to \`snake_case\`.
    * **R8 (Identifier):** If a clear business identifier isn't specified in the fields, add an artificial ID attribute (e.g., \`<classname>_id: Id\`) to classes derived via R4. Mark it as the identifier.
    * **R9 (Attribute Property):** Mark ID attributes as \`Constant\`, others as \`Variable\`. (Represent conceptually).
    * **R10 (Data Types):** Map the child \`domain\` field to PlantUML types (e.g., text->String, date->Date, datetime->Timestamp, number->Integer/Float).
    * **R11 (Requested):** Assume attributes derived via R4 are \`Requested\`. (Conceptual).
    * **R12 (Nullability):** ID attributes are \`Not Null\`. Others are \`Null allowed\`. (Conceptual).
    * **R13 (Relationships - Nesting):** Nested structures (\`"type": "Structure"\`, \`"type": "Aggregation"\`, \`"type": "Iteration"\` within \`children\`) create relationships between the parent class and the class derived from the nested structure.
    * **R14 (Cardinality - Iteration):** If nesting is via an \`"type": "Iteration"\`, the maximum cardinality on the nested side is MANY (\`*\`). The containing side is \`1\`. Format: \`Parent "1" -- "*" Nested\`.
    * **R15 (Other Cardinalities):** Assume minimum cardinalities are \`0\`.
    * **R16 (Relationships - Reference):** Child elements with \`"type": "Reference Field"\` create associations between the containing class and the class named in the child \`domain\`. Create the referenced class if it doesn't exist yet.
    * **R17 (Cardinality - Reference):** For simple reference fields (not defining an R14 iteration relationship), max cardinality on the REFERENCED side is ONE (\`1\`). Containing side is \`0..*\`. Format: \`Container "0..*" -- "1" Referenced\`.
    * **R18 (Creation Service):** Add a creation service (e.g., \`+ create_<subject_name>()\`) to each class NEWLY derived via R4.
    * **R19 (Creation Args - Data):** Creation service parameters include arguments for each \`Data Field\`.
    * **R20 (Creation Args - Object):** Creation service parameters include object-valued arguments for each \`Reference Field\`.
    * **R21 (Trigger Service):** Optional.
    * **R22 ('Self' Argument):** Assume non-creation services implicitly have a 'self' argument.
    * **R23 (Extend Existing Class):** If a message has \`marked_R2_implies_extension: true\`, DO NOT create a new class (ignore R4). Find the existing class named \`messageStructure.name\`. Add attributes (R6), relationships (R16 from *other* fields), and update services (R25) to THIS existing class.
    * **R24 (Extended Attributes):** Attributes added via R23 are \`Variable\`, not \`Requested\`, \`Null allowed\`. (Conceptual).
    * **R25 (Update Service):** If attributes/relationships are added via R23, add a corresponding update/setter service (e.g., \`+ update_<action_hint>(...)\`) to the extended class.
    * **R26 (Transaction Service):** Optional.
    
* **Validation Check:** Ensure every class derived (R4) or extended (R23) is connected to at least one other class through a relationship defined by rules R13 (Nesting) or R16 (Reference). The final diagram must represent a connected graph of domain entities.    


    **XML EXTRACTION HINTS:**
    
    * Look for \`<bpmn:documentation>\` tags, likely nested within \`<bpmn:messageFlow>\`, \`<bpmn:sendTask>\`, or \`<bpmn:receiveTask>\`.
    * The content might start with a prefix like \`dataFields:\`. Parse the JSON that follows this prefix.
    * The relevant part for derivation is the \`messageStructure\` object within the parsed JSON. Pay attention to \`messageStructure.name\` and \`messageStructure.children\`.
    * Check the \`extends\` property (e.g., \`"extends": true\`) on the *first* child of type \`Reference Field\` within \`messageStructure.children\` to determine if R2/R23 applies.
    
    
    **OUTPUT FORMAT:**
    
    Generate a single, complete UML Class Diagram definition using **PlantUML** syntax.
    * Start with \`@startuml\`.
    * Use \`skinparam ClassAttributeIconStyle none\`.
    * Define each class with its attributes (e.g., \`- attribute_name: Type\`) and services (e.g., \`+ service_name(...)\`). Indicate identifiers conceptually.
    * Define relationships BETWEEN class names using PlantUML arrows (\`--\`, \`-->\`) and cardinalities (\`"0..*"\`, \`"1..1"\`, \`"1"\`). Add role names if needed (e.g., \`Class1 "1" -- "*" Class2 : roleName\`).
    * End with \`@enduml\`.
    * Integrate views incrementally. Merge attributes and services into a single class definition if derived/extended multiple times. Define relationships only once.
    
    
    **INPUT BPMN XML CONTENT:**`;
    
    if (dataFieldsString) {
      // Construir el prompt completo con las instrucciones y el contenido BPMN
      promptText = systemPrompt + '\n\n' + dataFieldsString;
      const dataLength = dataFieldsString.length;
      logger.log(`Enviando BPMN XML a Gemini para derivar diagrama UML, longitud: ${dataLength}`);
      logs.push(`BPMN XML preparado: ${dataLength} caracteres`);
    } else {
      promptText = systemPrompt + '\n\n[No se proporcionó contenido BPMN XML]';
      logger.log('Advertencia: No se proporcionó dataFieldsString', 'WARN');
      logs.push('Advertencia: No se proporcionó dataFieldsString');
    }
    
    // 3. El "body" o "-d" (tal como en tu curl)
    const payload = {
      contents: [
        {
          parts: [
            {
              text: promptText
            }
          ]
        }
      ]
    };
    
    // 4. La llamada fetch (POST, con los headers y body de tu curl)
    logger.log('Enviando petición a Gemini API...');
    logs.push('Enviando petición a Gemini API');
    
    const response = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': API_KEY // Usando el header de tu curl
      },
      body: JSON.stringify(payload) // Convirtiendo el body a JSON string
    });

    logger.log(`Respuesta recibida: ${response.status} ${response.statusText}`);
    logs.push(`Respuesta HTTP: ${response.status}`);

    // 5. Manejo de errores
    if (!response.ok) {
      if (response.status === 429) {
        logger.log("⏳ Demasiadas peticiones. Has superado el límite de velocidad de la API gratuita (15 peticiones/min).", 'WARN');
        throw new Error("Has superado el límite de velocidad de la API gratuita (15 peticiones/min). Por favor, espera un minuto e inténtalo de nuevo.");
      }
      const errorData = await response.json();
      const errorMessage = `Error ${response.status}: ${errorData.error?.message || 'Error desconocido'}`;
      logger.log(errorMessage, 'ERROR');
      logs.push(`ERROR: ${errorMessage}`);
      throw new Error(errorMessage); 
    }

    // 6. Obtener la respuesta
    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;

    logger.log(`Respuesta de Gemini recibida: ${text.length} caracteres`);
    logger.log('Primeros 200 caracteres de la respuesta: ' + text.substring(0, 200));
    logs.push(`XML : ${dataFieldsString}`);
    logs.push('Procesamiento completado exitosamente');
    logs.push(`Tiempo total de ejecución: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    
    // Devolver la respuesta de Gemini con logs y metadata
    return {
      success: true,
      result: text,
      logs: logs,
      metadata: { 
        inputLength: dataFieldsString ? dataFieldsString.length : 0, 
        outputLength: text.length,
        url: URL,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    // Mejorar el mensaje de error con más detalles
    let errorMessage = `Error al ejecutar Gemini: ${error.message}`;
    
    // Agregar stack trace si está disponible (solo en desarrollo)
    if (error.stack && process.env.NODE_ENV === 'development') {
      errorMessage += `\n\nStack trace:\n${error.stack}`;
    }
    
    // Agregar información adicional sobre el error
    if (error.message.includes('GEMINI_API_KEY')) {
      errorMessage += '\n\n💡 Tip: Asegúrate de configurar la variable de entorno antes de ejecutar Camunda Modeler.';
    } else if (error.message.includes('fetch')) {
      errorMessage += '\n\n💡 Tip: Verifica tu conexión a internet y que la API key sea válida.';
    }
    
    logger.log(errorMessage, 'ERROR');
    logger.log(`Error completo: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`, 'ERROR');
    logs.push(`ERROR: ${errorMessage}`);
    logs.push(`Tiempo total de ejecución: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    
    // Crear un nuevo error con el mensaje mejorado
    const enhancedError = new Error(errorMessage);
    enhancedError.originalError = error;
    throw enhancedError;
  }
}

// Exporta la función
module.exports = {
  run
};