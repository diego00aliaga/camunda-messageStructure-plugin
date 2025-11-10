
const geminiService = require('./service/gemini-service');
const xmlParser = require('./service/xml-parse');
const logger = require('./log/logger');
const htmlDialog = require('./service/html-dialog');
const nestjsGenerator = require('./service/nestjs-generator');

module.exports = function (electronApp, menuState) {
    return [{
      label: 'Generar Código',
      accelerator: 'CommandOrControl+-',
      enabled: () => menuState.bpmn, 
      action: function() {
        // Verificar que tenemos acceso a la ventana del renderizado
        if (!electronApp.mainWindow || !electronApp.mainWindow.webContents) {
          logger.log('No hay acceso a la ventana del renderizado', 'ERROR');
          // No podemos mostrar un diálogo HTML si no hay acceso a webContents
          return;
        }

        logger.log('Iniciando obtención de XML del diagrama BPMN...');

        // Paso 1: Obtener el XML desde el proceso de renderizado
        electronApp.mainWindow.webContents.executeJavaScript(`
          (async function() {
            try {
              // Intentar diferentes formas de acceder a bpmnjs
              var bpmnjs = null;
              
              // Opción 1: Si está expuesto globalmente
              if (window.__pluginBpmnjs && window.__pluginBpmnjs.saveXML) {
                bpmnjs = window.__pluginBpmnjs;
              }
              // Opción 2: Buscar en el contexto del modelo de Camunda
              else if (window.bpmnjs && window.bpmnjs.saveXML) {
                bpmnjs = window.bpmnjs;
              }
              // Opción 3: Intentar acceder a través del contexto de React/Modeler
              else if (window.__bpmnjsInstance && window.__bpmnjsInstance.saveXML) {
                bpmnjs = window.__bpmnjsInstance;
              }
              
              if (!bpmnjs || !bpmnjs.saveXML) {
                throw new Error('No se pudo encontrar la instancia de bpmn-js. Asegúrate de que el plugin esté cargado correctamente.');
              }
              
              // Obtener el XML
              var result = await bpmnjs.saveXML();
              return {
                success: true,
                xml: result.xml
              };
            } catch (error) {
              console.error('Error obteniendo XML:', error);
              return {
                success: false,
                error: error.message || 'Error desconocido al obtener XML'
              };
            }
          })()
        `)
        .then(function(response) {
          if (!response || !response.success) {
            throw new Error(response ? response.error : 'No se recibió respuesta del proceso de renderizado');
          }
          
          var xml = response.xml;
          logger.log(`XML obtenido exitosamente, longitud: ${xml.length}`);
          
          // Paso 2: Parsear el XML para extraer todos los dataFields
          var parsedData = xmlParser.parseDataFieldsFromXML(xml);
          logger.log(`Datos parseados, longitud: ${parsedData.length}`);
          
          // Paso 3: Llamar a Gemini Service con los datos parseados
          return geminiService.run(parsedData);
        })
        .then(function(result) {
          // Manejar la respuesta que ahora es un objeto con {success, result, logs, metadata}
          const responseText = typeof result === 'string' ? result : (result.result || JSON.stringify(result));
          const logs = result.logs || [];
          const metadata = result.metadata || {};
          
          // Guardar el código PlantUML para usarlo después
          const plantUMLCode = responseText;
          
          // Preparar el detalle del resultado (mostrar más contenido)
          const fullDetail = responseText.length > 5000 
            ? responseText.substring(0, 5000) + '\n\n... (truncado, se muestran los primeros 5000 caracteres)'
            : responseText;
          
          const metadataText = metadata.timestamp 
            ? `\n\n--- Metadatos ---\nTimestamp: ${metadata.timestamp}\nInput: ${metadata.inputLength} caracteres\nOutput: ${metadata.outputLength} caracteres`
            : '';
          
          const detailWithMetadata = fullDetail + metadataText;
          
          // Mostrar resultado en un diálogo HTML
          if (electronApp.mainWindow && electronApp.mainWindow.webContents) {
            htmlDialog.showSuccessDialog(
              electronApp.mainWindow.webContents,
              'Diagrama UML Generado',
              'Diagrama PlantUML generado exitosamente',
              detailWithMetadata,
              logs.length > 0 ? ['Generar Código', 'Ver Logs'] : ['Generar Código']
            ).then(function(buttonIndex) {
              // Si el usuario presionó "Generar Código" (índice 0)
              if (buttonIndex === 0) {
                // Mostrar diálogo de confirmación antes de generar
                htmlDialog.showInfoDialog(
                  electronApp.mainWindow.webContents,
                  'Generar Proyecto NestJS',
                  'Se generará un proyecto NestJS completo a partir del diagrama UML.',
                  'Esto puede tardar varios minutos. El proyecto se creará en el directorio actual.\n\n¿Deseas continuar?',
                  ['Cancelar', 'Continuar']
                ).then(function(confirmIndex) {
                  if (confirmIndex === 1) {
                    // Usuario confirmó, generar el proyecto
                    generateNestJSProject(plantUMLCode, electronApp);
                  }
                }).catch(function(err) {
                  logger.log(`Error mostrando diálogo de confirmación: ${err.message}`, 'ERROR');
                });
              }
              // Si el usuario presionó "Ver Logs" (índice 1) y hay logs
              else if (buttonIndex === 1 && logs.length > 0) {
                // Mostrar logs en un nuevo diálogo
                htmlDialog.showInfoDialog(
                  electronApp.mainWindow.webContents,
                  'Logs del Proceso',
                  'Registro de eventos:',
                  logs.join('\n'),
                  ['OK']
                ).catch(function(err) {
                  logger.log(`Error mostrando diálogo de logs: ${err.message}`, 'ERROR');
                });
              }
            }).catch(function(err) {
              logger.log(`Error mostrando diálogo HTML: ${err.message}`, 'ERROR');
            });
          }
        })
        .catch(function(error) {
          logger.log(`Error al ejecutar Gemini: ${error.message}`, 'ERROR');
          
          // Mostrar error al usuario usando diálogo HTML
          if (electronApp.mainWindow && electronApp.mainWindow.webContents) {
            htmlDialog.showErrorDialog(
              electronApp.mainWindow.webContents,
              'Error',
              'Error al ejecutar Gemini',
              error.message || 'Error desconocido'
            ).catch(function(err) {
              logger.log(`Error mostrando diálogo de error: ${err.message}`, 'ERROR');
            });
          }
        });
      }
    }, 
]}

/**
 * Función auxiliar para generar el proyecto NestJS
 */
function generateNestJSProject(plantUMLCode, electronApp) {
  if (!electronApp || !electronApp.mainWindow || !electronApp.mainWindow.webContents) {
    logger.log('No hay acceso a webContents para mostrar diálogos', 'ERROR');
    return;
  }
  
  const webContents = electronApp.mainWindow.webContents;
  
  // Mostrar diálogo de progreso (no bloqueante)
  htmlDialog.showInfoDialog(
    webContents,
    'Generando Proyecto NestJS',
    'Por favor espera...',
    'Esto puede tardar varios minutos. El proceso incluye:\n1. Generación del script bash\n2. Creación del proyecto NestJS\n3. Generación de módulos, controladores y servicios\n\nNo cierres esta ventana.',
    ['OK']
  ).catch(() => {
    // Ignorar errores al mostrar el diálogo de progreso
  });
  
  logger.log('Iniciando generación del proyecto NestJS...');
  
  // Generar el proyecto
  nestjsGenerator.run(plantUMLCode)
    .then(function(result) {
      logger.log('Proyecto NestJS generado exitosamente');
      
      const successMessage = `¡Proyecto NestJS generado exitosamente!\n\n` +
        `Script generado: ${result.scriptPath}\n` +
        `Directorio: ${result.outputDir}\n` +
        `Código de salida: ${result.exitCode}\n\n` +
        `El proyecto ha sido creado y configurado completamente.`;
      
      // Mostrar diálogo de éxito
      htmlDialog.showSuccessDialog(
        webContents,
        'Proyecto Generado',
        'El proyecto NestJS ha sido generado exitosamente',
        successMessage,
        ['OK']
      ).catch(function(err) {
        logger.log(`Error mostrando diálogo de éxito: ${err.message}`, 'ERROR');
      });
    })
    .catch(function(error) {
      logger.log(`Error generando proyecto NestJS: ${error.message}`, 'ERROR');
      
      // Mostrar error
      htmlDialog.showErrorDialog(
        webContents,
        'Error al Generar Proyecto',
        'Ocurrió un error al generar el proyecto NestJS',
        error.message || 'Error desconocido'
      ).catch(function(err) {
        logger.log(`Error mostrando diálogo de error: ${err.message}`, 'ERROR');
      });
    });
}
  