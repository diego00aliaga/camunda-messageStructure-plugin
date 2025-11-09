
const { dialog } = require('electron');
const { shell } = require('electron');
const geminiService = require('./service/gemini-service');

module.exports = function (electronApp, menuState) {
    return [{
      label: 'Send a message to the console',
      accelerator: 'CommandOrControl+-',
      enabled: () => menuState.bpmn, 
      action: function() {
        // OPCIÓN 1: Mostrar un diálogo de mensaje (más visible)
        console.log("######")
        console.log("###### FIN DE LA FUNCION ######");
        const BrowserWindow = require('electron').BrowserWindow;
        const focusedWindow = BrowserWindow.getFocusedWindow();
        
        if (focusedWindow) {
          dialog.showMessageBox(focusedWindow, {
            type: 'info',
            title: 'Plugin Action',
            message: '¡Funciona!',
            detail: 'El botón del menú está funcionando correctamente.',
            buttons: ['OK']
          });
        }
        // Ejecutar Gemini Service de forma asíncrona
        geminiService.run()
          .then(result => {
 
            // Opcional: mostrar el resultado en un diálogo
            if (focusedWindow) {
              dialog.showMessageBox(focusedWindow, {
                type: 'info',
                title: 'Respuesta de Gemini',
                message: 'Respuesta recibida',
                detail: result.substring(0, 500) + (result.length > 500 ? '...' : ''),
                buttons: ['OK']
              });
            }
          })
          .catch(error => {
            console.error("Error al ejecutar Gemini:", error);
            if (electronApp.mainWindow && electronApp.mainWindow.webContents) {
                electronApp.mainWindow.webContents.executeJavaScript(`
                console.log("Respuesta de Gemini:", error);
                `).catch(err => console.error('Error executing script:', err));
              }
            if (focusedWindow) {
              dialog.showMessageBox(focusedWindow, {
                type: 'error',
                title: 'Error',
                message: 'Error al ejecutar Gemini',
                detail: error.message || 'Error desconocido',
                buttons: ['OK']
              });
            }
          });

        // OPCIÓN 2: Enviar mensaje al proceso de renderizado (para acciones en el cliente)
        // Esto permite ejecutar código en el proceso de renderizado donde está bpmn-js
        if (electronApp.mainWindow && electronApp.mainWindow.webContents) {
          electronApp.mainWindow.webContents.send('plugin-menu-action', {
            message: 'Action triggered from menu',
            timestamp: new Date().toISOString()
          });
        }
        
        // OPCIÓN 3: Abrir una URL externa (ejemplo)
        // shell.openExternal('https://camunda.org');
        
        // OPCIÓN 4: Ejecutar JavaScript en el proceso de renderizado
        if (electronApp.mainWindow && electronApp.mainWindow.webContents) {
          electronApp.mainWindow.webContents.executeJavaScript(`
            console.log('Action executed from menu!');
            alert('Menú ejecutado correctamente');
          `).catch(err => console.error('Error executing script:', err));
        }
      }
    }, 
]}
  