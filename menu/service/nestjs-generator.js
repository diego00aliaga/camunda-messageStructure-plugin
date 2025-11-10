/**
 * Servicio para generar un proyecto NestJS completo a partir de un diagrama PlantUML
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const logger = require('../log/logger');

// Configuración de Gemini API
const URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const API_KEY = "AIzaSyD7pA4UTuDDN5Y67CvtRsx8ZHr545cA4Fg";

/**
 * Genera un proyecto NestJS completo a partir de un diagrama PlantUML
 * @param {string} plantUMLCode - Código del diagrama PlantUML
 * @param {string} outputDir - Directorio donde se generará el proyecto (opcional, por defecto directorio actual)
 * @returns {Promise<Object>} Objeto con información sobre el proceso
 */
async function run(plantUMLCode, outputDir = null) {
  const logs = [];
  
  try {
    logger.log('NestJS Generator Service iniciado');
    logs.push('NestJS Generator Service iniciado');
    
    if (!plantUMLCode || plantUMLCode.trim().length === 0) {
      throw new Error('El código PlantUML está vacío');
    }
    
    logs.push(`PlantUML recibido: ${plantUMLCode.length} caracteres`);
    logger.log(`Generando script bash para NestJS...`);
    
    // 1. Crear el prompt para Gemini
    const prompt = `
**Rol:** Eres un desarrollador backend senior experto en NestJS, arquitectura de software y un maestro en shell scripting (bash).
**Tarea:** A partir del siguiente diagrama de clases de PlantUML, genera un **único script de bash (.sh)** que cree un proyecto NestJS completo, incluyendo toda la estructura de carpetas y archivos con su contenido.
**Requisitos del Script Bash:**
1.  **Crear Proyecto:** El script debe empezar creando un nuevo proyecto NestJS (ej: \`nest new mi-proyecto-backend --skip-git --package-manager npm\`).
2.  **Navegar al Proyecto:** Debe incluir el comando \`cd mi-proyecto-backend\`.
3.  **Generar Módulos (CLI):** Para cada entidad principal del diagrama, debe usar los comandos de NestJS CLI para generar el módulo, controlador y servicio (ej: \`nest g module modules/usuarios\`, \`nest g controller modules/usuarios --no-spec\`, \`nest g service modules/usuarios --no-spec\`).
4.  **Escribir Archivos (DTOs y Lógica):** El script debe usar comandos \`cat <<'EOF' > [RUTA_DEL_ARCHIVO]\` para crear o **sobrescribir** los archivos con el contenido completo.
    * **DTOs:** Debe crear las carpetas \`dto\` (ej: \`mkdir -p src/modules/usuarios/dto\`) y escribir los archivos \`create-usuario.dto.ts\` y \`update-usuario.dto.ts\` con las propiedades del diagrama.
    * **Servicios:** Debe **sobrescribir** el archivo \`*.service.ts\` generado por el CLI con la lógica CRUD completa (create, findAll, findOne, update, remove) que use los DTOs.
    * **Controladores:** Debe **sobrescribir** el archivo \`*.controller.ts\` con todos los endpoints RESTful (@Post, @Get, @Patch, @Delete) que se conecten al servicio.
    * **Módulos:** Debe **sobrescribir** el archivo \`*.module.ts\` para asegurarse de que el controlador y el servicio estén correctamente importados.
**Formato de Salida:**
Responde **únicamente** con el script de bash, comenzando con \`#!/bin/bash\` y nada más. No incluyas explicaciones, solo el código del script.
**Diagrama PlantUML de entrada:**
\`\`\`plantuml
${plantUMLCode}
\`\`\`
`;

    // 2. Preparar el payload para Gemini
    const payload = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192
      }
    };

    logger.log('Llamando a la API de Gemini para generar el script...');
    logs.push('Llamando a la API de Gemini...');
    
    // 3. Llamar a Gemini API
    const response = await fetch(`${URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    // 4. Manejar errores de la API
    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = `Error ${response.status}: ${errorData.error?.message || 'Error desconocido'}`;
      logger.log(errorMessage, 'ERROR');
      logs.push(`ERROR: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    // 5. Obtener la respuesta
    const data = await response.json();
    let generatedScript = data.candidates[0].content.parts[0].text;
    
    // Limpiar el script (remover markdown code blocks si existen)
    generatedScript = generatedScript
      .replace(/^```bash\n?/i, '')
      .replace(/^```sh\n?/i, '')
      .replace(/^```\n?/, '')
      .replace(/\n```$/, '')
      .replace(/\n```bash$/, '')
      .replace(/\n```sh$/, '')
      .trim();
    
    // Asegurar que empiece con shebang
    if (!generatedScript.startsWith('#!/bin/bash') && !generatedScript.startsWith('#!/bin/sh')) {
      generatedScript = '#!/bin/bash\n\n' + generatedScript;
    }
    
    logger.log(`Script generado: ${generatedScript.length} caracteres`);
    logs.push(`Script generado exitosamente: ${generatedScript.length} caracteres`);
    
    // 6. Determinar el directorio de salida (usar directorio home si process.cwd() no es válido)
    let finalOutputDir = outputDir;
    
    if (!finalOutputDir) {
      // Intentar usar process.cwd() primero
      try {
        const cwd = process.cwd();
        // Verificar que no sea la raíz del sistema
        if (cwd && cwd !== '/' && cwd !== '\\') {
          // Verificar que el directorio sea escribible
          try {
            await fs.access(cwd, fs.constants.W_OK);
            finalOutputDir = cwd;
            logger.log(`Usando directorio actual: ${finalOutputDir}`);
          } catch (err) {
            logger.log(`El directorio actual no es escribible, usando directorio home`, 'WARN');
            finalOutputDir = os.homedir();
          }
        } else {
          logger.log(`process.cwd() devolvió raíz del sistema, usando directorio home`, 'WARN');
          finalOutputDir = os.homedir();
        }
      } catch (err) {
        logger.log(`Error accediendo a process.cwd(), usando directorio home: ${err.message}`, 'WARN');
        finalOutputDir = os.homedir();
      }
    }
    
    // Asegurar que el directorio existe y es escribible
    try {
      await fs.access(finalOutputDir, fs.constants.W_OK);
    } catch (err) {
      // Si no es escribible, usar directorio temporal
      logger.log(`El directorio no es escribible, usando directorio temporal`, 'WARN');
      finalOutputDir = os.tmpdir();
    }
    
    const outputFilename = path.join(finalOutputDir, 'generar-backend.sh');
    logger.log(`Directorio de salida: ${finalOutputDir}`);
    logger.log(`Archivo de salida: ${outputFilename}`);
    
    // 7. Guardar el script
    await fs.writeFile(outputFilename, generatedScript, 'utf8');
    logger.log(`Script guardado en: ${outputFilename}`);
    logs.push(`Script guardado en: ${outputFilename}`);
    
    // 8. Dar permisos de ejecución
    await fs.chmod(outputFilename, 0o755);
    logger.log('Permisos de ejecución otorgados');
    logs.push('Permisos de ejecución otorgados (chmod +x)');
    
    // 9. Ejecutar el script automáticamente
    logger.log('Iniciando ejecución del script... (Esto puede tardar varios minutos)');
    logs.push('Iniciando ejecución del script...');
    
    const scriptPath = path.isAbsolute(outputFilename) 
      ? outputFilename 
      : path.join(process.cwd(), outputFilename);
    
    // Ejecutar el script
    const child = spawn(scriptPath, [], {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true,
      cwd: finalOutputDir
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      logger.log(`[Script Output] ${output.trim()}`);
    });
    
    child.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      logger.log(`[Script Error] ${error.trim()}`, 'ERROR');
    });
    
    // 10. Esperar a que el script termine
    const exitCode = await new Promise((resolve, reject) => {
      child.on('close', (code) => {
        resolve(code);
      });
      
      child.on('error', (err) => {
        reject(err);
      });
    });
    
    if (exitCode === 0) {
      logger.log('¡Script ejecutado exitosamente!');
      logs.push('¡Script ejecutado exitosamente!');
      logs.push(`Código de salida: ${exitCode}`);
      
      return {
        success: true,
        scriptPath: outputFilename,
        outputDir: finalOutputDir,
        exitCode: exitCode,
        stdout: stdout,
        stderr: stderr,
        logs: logs,
        metadata: {
          scriptLength: generatedScript.length,
          plantUMLLength: plantUMLCode.length,
          timestamp: new Date().toISOString()
        }
      };
    } else {
      const errorMessage = `El script falló con código de salida ${exitCode}`;
      logger.log(errorMessage, 'ERROR');
      logs.push(`ERROR: ${errorMessage}`);
      logs.push(`Stderr: ${stderr}`);
      
      throw new Error(errorMessage);
    }
    
  } catch (error) {
    const errorMessage = `Error al generar proyecto NestJS: ${error.message}`;
    logger.log(errorMessage, 'ERROR');
    logs.push(`ERROR: ${errorMessage}`);
    
    throw error;
  }
}

module.exports = {
  run
};

