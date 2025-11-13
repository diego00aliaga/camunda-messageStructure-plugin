
const { dialog } = require('electron');
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
          
          // Mostrar diálogo de progreso mientras se genera el diagrama UML
          if (electronApp.mainWindow && electronApp.mainWindow.webContents) {
            htmlDialog.showInfoDialog(
              electronApp.mainWindow.webContents,
              'Generando Diagrama UML',
              'Procesando con Gemini AI...',
              'Por favor espera mientras se genera el diagrama PlantUML a partir de tu diagrama BPMN.\n\nEsto puede tardar unos segundos.\n\nNo cierres esta ventana.',
              [] // Se quita el botón 'OK' para que sea no interactivo
            ).catch(function(err) {
              // Ignorar errores al mostrar el diálogo de progreso
              logger.log(`Error mostrando diálogo de progreso: ${err.message}`, 'WARN');
            });
          }
          
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
          
          // Mostrar resultado en un diálogo HTML (cerrando el diálogo de progreso)
          if (electronApp.mainWindow && electronApp.mainWindow.webContents) {
            htmlDialog.showSuccessDialog(
              electronApp.mainWindow.webContents,
              'Diagrama UML Generado',
              'Diagrama PlantUML generado exitosamente',
              detailWithMetadata,
              logs.length > 0 ? ['Generar Código', 'Ver Logs'] : ['Generar Código'],
              true  // closeExisting = true para cerrar el diálogo de progreso
            ).then(function(buttonIndex) {
              // Si el usuario presionó "Generar Código" (índice 0)
              if (buttonIndex === 0) {
                // Mostrar diálogo de confirmación antes de generar
                htmlDialog.showInfoDialog(
                  electronApp.mainWindow.webContents,
                  'Generar Proyecto NestJS',
                  'Se generará un proyecto NestJS completo a partir del diagrama UML.',
                  'Esto puede tardar varios minutos. Se te pedirá que selecciones el directorio donde se creará el proyecto.\n\n¿Deseas continuar?',
                  ['Cancelar', 'Continuar']
                ).then(function(confirmIndex) {
                  if (confirmIndex === 1) {
                    // Usuario confirmó, mostrar diálogo para seleccionar directorio
                    selectOutputDirectory(plantUMLCode, electronApp);
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
          // Log detallado del error
          const errorDetails = {
            message: error.message,
            stack: error.stack,
            name: error.name,
            originalError: error.originalError
          };
          logger.log(`Error al ejecutar Gemini: ${error.message}`, 'ERROR');
          logger.log(`Detalles del error: ${JSON.stringify(errorDetails, null, 2)}`, 'ERROR');
          logger.log(`Archivo de log disponible en: ${logger.getLogPath()}`, 'INFO');
          
          // Construir mensaje de error más detallado
          let errorMessage = error.message || 'Error desconocido';
          
          // Agregar información sobre el log si el error es complejo
          if (error.stack || error.originalError) {
            errorMessage += `\n\n📋 Para más detalles, revisa el archivo de log:\n${logger.getLogPath()}`;
          }
          
          // Mostrar error al usuario usando diálogo HTML (cerrando el diálogo de progreso)
          if (electronApp.mainWindow && electronApp.mainWindow.webContents) {
            htmlDialog.showErrorDialog(
              electronApp.mainWindow.webContents,
              'Error',
              'Error al ejecutar Gemini',
              errorMessage,
              ['OK', 'Ver Log'],
              true  // closeExisting = true para cerrar el diálogo de progreso
            ).then(function(buttonIndex) {
              // Si el usuario presionó "Ver Log" (índice 1)
              if (buttonIndex === 1) {
                // Leer y mostrar el contenido del log
                try {
                  const fs = require('fs');
                  const logPath = logger.getLogPath();
                  let logContent = 'No se pudo leer el archivo de log.';
                  
                  if (fs.existsSync(logPath)) {
                    const logs = fs.readFileSync(logPath, 'utf8');
                    // Mostrar las últimas 50 líneas del log
                    const logLines = logs.split('\n');
                    const recentLogs = logLines.slice(-50).join('\n');
                    logContent = recentLogs || 'El archivo de log está vacío.';
                  }
                  
                  htmlDialog.showInfoDialog(
                    electronApp.mainWindow.webContents,
                    'Log del Plugin',
                    'Últimas entradas del log:',
                    `Ruta del log: ${logPath}\n\n--- Últimas 50 líneas ---\n\n${logContent}`,
                    ['OK']
                  ).catch(function(dialogErr) {
                    logger.log(`Error mostrando diálogo de log: ${dialogErr.message}`, 'ERROR');
                  });
                } catch (logErr) {
                  logger.log(`Error leyendo log: ${logErr.message}`, 'ERROR');
                  htmlDialog.showErrorDialog(
                    electronApp.mainWindow.webContents,
                    'Error',
                    'Error al leer el log',
                    `No se pudo leer el archivo de log: ${logErr.message}\n\nRuta: ${logger.getLogPath()}`,
                    ['OK']
                  ).catch(() => {});
                }
              }
            }).catch(function(err) {
              logger.log(`Error mostrando diálogo de error: ${err.message}`, 'ERROR');
            });
          }
        });
      }
    }, 
]}

/**
 * Función auxiliar para seleccionar el directorio de salida
 */
function selectOutputDirectory(plantUMLCode, electronApp) {
  if (!electronApp || !electronApp.mainWindow) {
    logger.log('No hay acceso a la ventana principal', 'ERROR');
    return;
  }
  
  const BrowserWindow = require('electron').BrowserWindow;
  const focusedWindow = BrowserWindow.getFocusedWindow() || electronApp.mainWindow;
  
  // Mostrar diálogo para seleccionar directorio
  dialog.showOpenDialog(focusedWindow, {
    title: 'Seleccionar directorio para el proyecto NestJS',
    defaultPath: require('os').homedir(),
    properties: ['openDirectory', 'createDirectory']
  }).then(function(result) {
    if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
      const selectedDir = result.filePaths[0];
      logger.log(`Directorio seleccionado: ${selectedDir}`);
      
      // Generar el proyecto en el directorio seleccionado
      generateNestJSProject(plantUMLCode, electronApp, selectedDir);
    } else {
      logger.log('Usuario canceló la selección de directorio');
    }
  }).catch(function(err) {
    logger.log(`Error al seleccionar directorio: ${err.message}`, 'ERROR');
    
    // Mostrar error al usuario
    if (electronApp.mainWindow && electronApp.mainWindow.webContents) {
      htmlDialog.showErrorDialog(
        electronApp.mainWindow.webContents,
        'Error',
        'Error al seleccionar directorio',
        err.message || 'Error desconocido'
      ).catch(function(dialogErr) {
        logger.log(`Error mostrando diálogo de error: ${dialogErr.message}`, 'ERROR');
      });
    }
  });
}

/**
 * Función auxiliar para generar el proyecto NestJS
 */
function generateNestJSProject(plantUMLCode, electronApp, outputDir = null) {
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
    []
  ).catch(() => {
    // Ignorar errores al mostrar el diálogo de progreso
  });
  
  logger.log('Iniciando generación del proyecto NestJS...');
  if (outputDir) {
    logger.log(`Directorio de salida seleccionado: ${outputDir}`);
  }
  
  // Generar el proyecto en el directorio seleccionado
  nestjsGenerator.run(plantUMLCode, outputDir)
    .then(function(result) {
      logger.log('Proyecto NestJS generado exitosamente');
      
      const logs = result.logs || [];
      const stdout = result.stdout || '';
      const stderr = result.stderr || '';
      
      // Combinar todos los logs
      const allLogs = [
        ...logs,
        ...(stdout ? ['\n--- Salida del Script ---', stdout] : []),
        ...(stderr ? ['\n--- Errores del Script ---', stderr] : [])
      ];
      
      const successMessage = `¡Proyecto NestJS generado exitosamente!\n\n` +
        `Script generado: ${result.scriptPath}\n` +
        `Directorio: ${result.outputDir}\n` +
        `Código de salida: ${result.exitCode}\n\n` +
        `El proyecto ha sido creado y configurado completamente.`;
      
      // Mostrar diálogo de éxito con opción de ver logs
      const buttons = allLogs.length > 0 ? ['OK', 'Ver Logs'] : ['OK'];
      
      htmlDialog.showSuccessDialog(
        webContents,
        'Proyecto Generado',
        'El proyecto NestJS ha sido generado exitosamente',
        successMessage,
        buttons
      ).then(function(buttonIndex) {
        // Si el usuario presionó "Ver Logs" (índice 1)
        if (buttonIndex === 1 && allLogs.length > 0) {
          // Mostrar logs en un nuevo diálogo
          htmlDialog.showInfoDialog(
            webContents,
            'Logs del Proceso de Generación',
            'Registro completo del proceso:',
            allLogs.join('\n'),
            ['OK']
          ).catch(function(err) {
            logger.log(`Error mostrando diálogo de logs: ${err.message}`, 'ERROR');
          });
        }
      }).catch(function(err) {
        logger.log(`Error mostrando diálogo de éxito: ${err.message}`, 'ERROR');
      });
    })
    .catch(function(error) {
      logger.log(`Error generando proyecto NestJS: ${error.message}`, 'ERROR');
      
      // Obtener logs del error si están disponibles
      const errorLogs = error.logs || [];
      const errorStdout = error.stdout || '';
      const errorStderr = error.stderr || error.message || '';
      
      // Combinar todos los logs del error
      const allErrorLogs = [
        ...errorLogs,
        ...(errorStdout ? ['\n--- Salida del Script ---', errorStdout] : []),
        ...(errorStderr ? ['\n--- Errores ---', errorStderr] : [])
      ];
      
      const errorMessage = error.message || 'Error desconocido';
      
      // Mostrar error con opción de ver logs si están disponibles
      const buttons = allErrorLogs.length > 0 ? ['OK', 'Ver Logs'] : ['OK'];
      
      htmlDialog.showErrorDialog(
        webContents,
        'Error al Generar Proyecto',
        'Ocurrió un error al generar el proyecto NestJS',
        errorMessage,
        buttons
      ).then(function(buttonIndex) {
        // Si el usuario presionó "Ver Logs" (índice 1)
        if (buttonIndex === 1 && allErrorLogs.length > 0) {
          // Mostrar logs en un nuevo diálogo
          htmlDialog.showInfoDialog(
            webContents,
            'Logs del Error',
            'Registro completo del error:',
            allErrorLogs.join('\n'),
            ['OK']
          ).catch(function(err) {
            logger.log(`Error mostrando diálogo de logs: ${err.message}`, 'ERROR');
          });
        }
      }).catch(function(err) {
        logger.log(`Error mostrando diálogo de error: ${err.message}`, 'ERROR');
      });
    });
}
  