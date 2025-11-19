/**
 * Parsea el XML BPMN y extrae todos los elementos bpmn:documentation que contienen dataFields
 * @param {string} xml - El XML completo del diagrama BPMN
 * @returns {string[]} Un array de strings, cada uno con formato dataFields:{...}
 */
function parseDataFieldsFromXML(xml) {
    var results = [];
    var processedJsonStrings = new Set();
    
    try {
      // Buscar todos los elementos <bpmn:documentation> que contienen "dataFields:"
      // Patrón que maneja múltiples líneas y diferentes formatos
      var documentationPattern = /<bpmn:documentation[^>]*>dataFields:([\s\S]*?)<\/bpmn:documentation>/g;
      var match;
      
      while ((match = documentationPattern.exec(xml)) !== null) {
        try {
          // Extraer el contenido entre dataFields: y </bpmn:documentation>
          var content = match[1].trim();
          
          // Buscar el JSON dentro del contenido
          var jsonStart = content.indexOf('{');
          if (jsonStart === -1) {
            console.warn('No se encontró inicio de JSON en dataFields');
            continue;
          }
          
          // Extraer el JSON usando balanceo de llaves
          var jsonString = extractBalancedJSON(content, jsonStart);
          if (!jsonString) {
            console.warn('No se pudo extraer JSON balanceado');
            continue;
          }
          
          // Evitar procesar el mismo JSON dos veces
          var jsonHash = jsonString.replace(/\s+/g, ' ').trim();
          if (processedJsonStrings.has(jsonHash)) {
            continue;
          }
          processedJsonStrings.add(jsonHash);
          
          // Guardar el JSON original con el prefijo dataFields:
          var dataFieldsString = 'dataFields:' + jsonString;
          results.push(dataFieldsString);
          console.log('✅ DataFields parseado exitosamente');
        } catch (parseError) {
          console.error('Error parseando JSON de dataFields:', parseError);
          console.error('Contenido problemático:', match[1].substring(0, 200));
        }
      }
      
    } catch (error) {
      console.error('Error parseando XML:', error);
    }
    
    // ¡CAMBIO AQUÍ!
    // Devolver todos los resultados encontrados en un array
    // Si no se encontró ninguno, devolverá un array vacío []
    return results;
  }
  
  /**
   * Extrae un JSON balanceado desde una posición inicial
   * (Tu función helper está perfecta, no necesita cambios)
   */
  function extractBalancedJSON(content, startIndex) {
    if (content[startIndex] !== '{') {
      return null;
    }
    
    var depth = 0;
    var inString = false;
    var escapeNext = false;
    var jsonEnd = startIndex;
    
    for (var i = startIndex; i < content.length; i++) {
      var char = content[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (inString) {
        continue;
      }
      
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          jsonEnd = i + 1;
          break;
        }
      }
    }
    
    if (depth !== 0) {
      return null; // JSON no balanceado
    }
    
    return content.substring(startIndex, jsonEnd);
  }
  
  module.exports = {
    parseDataFieldsFromXML
  };