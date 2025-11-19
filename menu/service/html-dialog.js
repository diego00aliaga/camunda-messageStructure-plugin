/**
 * Módulo para crear diálogos HTML personalizados
 * Estos diálogos se inyectan en el proceso de renderizado (webContents)
 */

// CSS para los diálogos (se inyecta una sola vez)
const DIALOG_CSS = [
  '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }',
  '@keyframes slideIn { from { opacity: 0; transform: translateY(-20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }',
  '.html-dialog-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); z-index: 10000; display: flex; justify-content: center; align-items: center; animation: fadeIn 0.2s ease-in; }',
  '.html-dialog { background: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3); min-width: 400px; max-width: 600px; max-height: 80vh; display: flex; flex-direction: column; animation: slideIn 0.3s ease-out; }',
  '.html-dialog-header { padding: 16px 20px; display: flex; align-items: center; gap: 12px; border-radius: 6px 6px 0 0; }',
  '.html-dialog-icon { font-size: 24px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; color: white; border-radius: 50%; flex-shrink: 0; }',
  '.html-dialog-title { margin: 0; font-size: 18px; font-weight: 600; color: #333; flex: 1; }',
  '.html-dialog-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #666; padding: 0; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: background 0.2s; }',
  '.html-dialog-close:hover { background: rgba(0, 0, 0, 0.1); }',
  '.html-dialog-body { padding: 20px; overflow-y: auto; flex: 1; }',
  '.html-dialog-message { margin: 0 0 12px 0; font-size: 14px; color: #333; line-height: 1.5; }',
  '.html-dialog-detail-wrapper { margin-top: 12px; position: relative; }',
  '.html-dialog-detail { padding: 12px; background: #f5f5f5; border-radius: 4px; font-size: 13px; color: #666; line-height: 1.6; white-space: pre-wrap; font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace; max-height: 400px; overflow-y: auto; }',
  '.html-dialog-copy-btn { position: absolute; top: 6px; right: 6px; border: none; background: #e0e0e0; color: #333; font-size: 12px; padding: 4px 10px; border-radius: 4px; cursor: pointer; transition: all 0.2s; }',
  '.html-dialog-copy-btn:hover { background: #d5d5d5; }',
  '.html-dialog-body::-webkit-scrollbar, .html-dialog-detail::-webkit-scrollbar { width: 8px; }',
  '.html-dialog-body::-webkit-scrollbar-track, .html-dialog-detail::-webkit-scrollbar-track { background: #f1f1f1; }',
  '.html-dialog-body::-webkit-scrollbar-thumb, .html-dialog-detail::-webkit-scrollbar-thumb { background: #888; border-radius: 4px; }',
  '.html-dialog-body::-webkit-scrollbar-thumb:hover, .html-dialog-detail::-webkit-scrollbar-thumb:hover { background: #555; }',
  '.html-dialog-footer { padding: 16px 20px; border-top: 1px solid #e0e0e0; display: flex; justify-content: flex-end; gap: 10px; border-radius: 0 0 6px 6px; }',
  '.html-dialog-button { padding: 8px 20px; border: none; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; }',
  '.html-dialog-button:hover { opacity: 0.9; transform: translateY(-1px); }'
].join(' ');

/**
 * Cierra todos los diálogos HTML existentes
 * @param {Object} webContents - webContents de Electron
 * @returns {Promise<void>}
 */
function closeAllDialogs(webContents) {
  const script = `
    (function() {
      // Cerrar todos los overlays de diálogos
      const overlays = document.querySelectorAll('.html-dialog-overlay');
      overlays.forEach(function(overlay) {
        overlay.remove();
      });
    })()
  `;
  
  return webContents.executeJavaScript(script).catch(function(err) {
    // Ignorar errores al cerrar diálogos
    console.warn('Error cerrando diálogos:', err);
  });
}

/**
 * Muestra un diálogo HTML en el proceso de renderizado
 * @param {Object} webContents - webContents de Electron donde se mostrará el diálogo
 * @param {Object} options - Opciones del diálogo
 * @param {string} options.type - Tipo de diálogo: 'info', 'error', 'warning', 'success'
 * @param {string} options.title - Título del diálogo
 * @param {string} options.message - Mensaje principal
 * @param {string} options.detail - Detalle adicional (opcional)
 * @param {Array} options.buttons - Array de botones: ['OK', 'Cancel'] (opcional)
 * @param {boolean} options.closeExisting - Si es true, cierra diálogos existentes antes de mostrar este (default: false)
 * @returns {Promise<number>} Promise que se resuelve con el índice del botón presionado (-1 si se cerró)
 */
function showHTMLDialog(webContents, options = {}) {
  const {
    closeExisting = false
  } = options;
  
  // Si se solicita cerrar diálogos existentes, hacerlo primero
  if (closeExisting) {
    return closeAllDialogs(webContents).then(function() {
      // Continuar con la creación del nuevo diálogo
      return showHTMLDialogInternal(webContents, options);
    });
  } else {
    return showHTMLDialogInternal(webContents, options);
  }
}

/**
 * Función interna para mostrar un diálogo HTML
 */
function showHTMLDialogInternal(webContents, options = {}) {
  const {
    type = 'info',
    title = 'Diálogo',
    message = '',
    detail = '',
    buttons = ['OK']
  } = options;

  // Definir colores según el tipo
  const typeStyles = {
    info: {
      icon: 'ℹ',
      borderColor: '#FFFFFF',
      headerBg: '#FFFFFF',
      iconBg: '#FC5D0D'
    },
    error: {
      icon: 'X',
      borderColor: '#F44336',
      headerBg: '#FFEBEE',
      iconBg: '#F44336'
    },
    warning: {
      icon: '',
      borderColor: '#FF9800',
      headerBg: '#FFF3E0',
      iconBg: '#FF9800'
    },
    success: {
      icon: '✓',
      iconRegenerate: '↺',
      borderColor: '#FFFFFF',
      headerBg: '#FFFFFF',
      iconBg: '#FC5D0D'
    },

  };

  const style = typeStyles[type] || typeStyles.info;

  // Escapar los datos usando JSON.stringify para evitar problemas con caracteres especiales
  const scriptParts = [
    '(function() {',
    '  return new Promise(function(resolve) {',
    '    const style = ' + JSON.stringify(style) + ';',
    '    const title = ' + JSON.stringify(title) + ';',
    '    const message = ' + JSON.stringify(message) + ';',
    '    const detail = ' + JSON.stringify(detail) + ';',
    '    const buttons = ' + JSON.stringify(buttons) + ';',
    '    const css = ' + JSON.stringify(DIALOG_CSS) + ';',
    '',
    '    const dialogId = "html-dialog-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);',
    '    const overlayId = "html-dialog-overlay-" + dialogId;',
    '',
    '    // Agregar estilos si no existen',
    '    if (!document.getElementById("html-dialog-styles")) {',
    '      const styleSheet = document.createElement("style");',
    '      styleSheet.id = "html-dialog-styles";',
    '      styleSheet.textContent = css;',
    '      document.head.appendChild(styleSheet);',
    '    }',
    '',
    '    // Crear el HTML del diálogo',
    '    const overlay = document.createElement("div");',
    '    overlay.id = overlayId;',
    '    overlay.className = "html-dialog-overlay";',
    '',
    '    const dialog = document.createElement("div");',
    '    dialog.id = dialogId;',
    '    dialog.className = "html-dialog";',
    '    dialog.style.border = "2px solid " + style.borderColor;',
    '',
    '    // Header',
    '    const header = document.createElement("div");',
    '    header.className = "html-dialog-header";',
    '    header.style.background = style.headerBg;',
    '    header.style.borderBottom = "1px solid " + style.borderColor;',
    '',
    '    const icon = document.createElement("span");',
    '    icon.className = "html-dialog-icon";',
    '    icon.style.background = style.iconBg;',
    '    icon.textContent = style.icon;',
    '',
    '    const titleElem = document.createElement("h3");',
    '    titleElem.className = "html-dialog-title";',
    '    titleElem.textContent = title;',
    '',
    '    const closeBtn = document.createElement("button");',
    '    closeBtn.className = "html-dialog-close";',
    '    closeBtn.textContent = "×";',
    '    closeBtn.setAttribute("aria-label", "Cerrar");',
    '',
    '    header.appendChild(icon);',
    '    header.appendChild(titleElem);',
    '    header.appendChild(closeBtn);',
    '',
    '    // Body',
    '    const body = document.createElement("div");',
    '    body.className = "html-dialog-body";',
    '',
    '    if (message) {',
    '      const messageElem = document.createElement("p");',
    '      messageElem.className = "html-dialog-message";',
    '      messageElem.textContent = message;',
    '      body.appendChild(messageElem);',
    '    }',
    '',
    '    if (detail) {',
    '      const detailWrapper = document.createElement("div");',
    '      detailWrapper.className = "html-dialog-detail-wrapper";',
    '',
    '      const detailElem = document.createElement("div");',
    '      detailElem.className = "html-dialog-detail";',
    '      detailElem.textContent = detail;',

    '      detailWrapper.appendChild(detailElem);',
    '      body.appendChild(detailWrapper);',

    '',
    '    if (title === "Diagrama UML Generado") {',
    '      const copyBtn = document.createElement("button");',
    '      copyBtn.className = "html-dialog-copy-btn";',
    '      copyBtn.textContent = "Copiar";',
    '',
    '      detailWrapper.appendChild(copyBtn);',
    '',
    '      function setCopyButtonState(text) {',
    '        copyBtn.textContent = text;',
    '        copyBtn.disabled = true;',
    '        setTimeout(function() {',
    '          copyBtn.textContent = "Copiar";',
    '          copyBtn.disabled = false;',
    '        }, 1500);',
    '      }',
    '',
    '      function fallbackCopy(text) {',
    '        try {',
    '          const textarea = document.createElement("textarea");',
    '          textarea.value = text;',
    '          textarea.setAttribute("readonly", "");',
    '          textarea.style.position = "absolute";',
    '          textarea.style.left = "-9999px";',
    '          document.body.appendChild(textarea);',
    '          textarea.select();',
    '          document.execCommand("copy");',
    '          document.body.removeChild(textarea);',
    '          setCopyButtonState("Copiado!");',
    '        } catch (err) {',
    '          console.error("No se pudo copiar el detalle:", err);',
    '          setCopyButtonState("Error");',
    '        }',
    '      }',
    '',
    '      copyBtn.addEventListener("click", function() {',
    '        if (navigator.clipboard && navigator.clipboard.writeText) {',
    '          navigator.clipboard.writeText(detail).then(function() {',
    '            setCopyButtonState("Copiado!");',
    '          }).catch(function() {',
    '            fallbackCopy(detail);',
    '          });',
    '        } else {',
    '          fallbackCopy(detail);',
    '        }',
    '      });',
    '    }',
    '    }',
    '',
    '    // Footer',
    '    const footer = document.createElement("div");',
    '    footer.className = "html-dialog-footer";',
    '',
    '    buttons.forEach(function(buttonText, index) {',
    '      const button = document.createElement("button");',
    '      button.className = "html-dialog-button";',
    '      button.setAttribute("data-index", index.toString());',
    '      button.textContent = buttonText;',
    '      if (index === 0) {',
    '        button.style.background = style.iconBg;',
    '        button.style.color = "white";',
    '      } else {',
    '        button.style.background = "#f0f0f0";',
    '        button.style.color = "#333";',
    '      }',
    '      footer.appendChild(button);',
    '    });',
    '',
    '    // Ensamblar el diálogo',
    '    dialog.appendChild(header);',
    '    dialog.appendChild(body);',
    '    dialog.appendChild(footer);',
    '    overlay.appendChild(dialog);',
    '',
    '    // Agregar al DOM',
    '    document.body.appendChild(overlay);',
    '',
    '    // Función para cerrar el diálogo',
    '    function closeDialog(buttonIndex) {',
    '      overlay.remove();',
    '      resolve(buttonIndex);',
    '    }',
    '',
    '    // Manejar clic en el overlay (cerrar al hacer clic fuera)',
    '    overlay.addEventListener("click", function(e) {',
    '      if (e.target === overlay) {',
    '        closeDialog(-1);',
    '      }',
    '    });',
    '',
    '    // Manejar clic en botones',
    '    const dialogButtons = overlay.querySelectorAll(".html-dialog-button");',
    '    dialogButtons.forEach(function(button) {',
    '      button.addEventListener("click", function() {',
    '        const index = parseInt(button.getAttribute("data-index"), 10);',
    '        closeDialog(index);',
    '      });',
    '    });',
    '',
    '    // Manejar clic en el botón de cerrar',
    '    closeBtn.addEventListener("click", function() {',
    '      closeDialog(-1);',
    '    });',
    '',
    '    // Manejar tecla ESC',
    '    const handleEsc = function(e) {',
    '      if (e.key === "Escape") {',
    '        document.removeEventListener("keydown", handleEsc);',
    '        closeDialog(-1);',
    '      }',
    '    };',
    '    document.addEventListener("keydown", handleEsc);',
    '',
    '    // Focus en el primer botón',
    '    if (dialogButtons.length > 0) {',
    '      dialogButtons[0].focus();',
    '    }',
    '  });',
    '})()'
  ];

  const script = scriptParts.join('\n');

  // Ejecutar el script en el proceso de renderizado y retornar la Promise
  return webContents.executeJavaScript(script);
}

/**
 * Muestra un diálogo de información
 */
function showInfoDialog(webContents, title, message, detail, buttons = ['OK'], closeExisting = false) {
  return showHTMLDialog(webContents, {
    type: 'info',
    title,
    message,
    detail,
    buttons,
    closeExisting
  });
}

/**
 * Muestra un diálogo de error
 */
function showErrorDialog(webContents, title, message, detail, buttons = ['OK'], closeExisting = false) {
  return showHTMLDialog(webContents, {
    type: 'error',
    title,
    message,
    detail,
    buttons,
    closeExisting
  });
}

/**
 * Muestra un diálogo de advertencia
 */
function showWarningDialog(webContents, title, message, detail, buttons = ['OK'], closeExisting = false) {
  return showHTMLDialog(webContents, {
    type: 'warning',
    title,
    message,
    detail,
    buttons,
    closeExisting
  });
}

/**
 * Muestra un diálogo de éxito
 */
function showSuccessDialog(webContents, title, message, detail, buttons = ['OK'], closeExisting = false) {
  return showHTMLDialog(webContents, {
    type: 'success',
    title,
    message,
    detail,
    buttons,
    closeExisting
  });
}

module.exports = {
  showHTMLDialog,
  showInfoDialog,
  showErrorDialog,
  showWarningDialog,
  showSuccessDialog,
  closeAllDialogs
};
