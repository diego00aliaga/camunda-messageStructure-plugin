/**
 * Servicio para generar un proyecto NestJS completo a partir de un diagrama PlantUML
 */

const fs = require('fs').promises;
const os = require('os');
const { spawn, execSync } = require('child_process');
const logger = require('../log/logger');
const path = require('path'); // Añadir import de path

// Configuración de Gemini API
const URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Función para obtener la API Key de config.json
function getApiKey() {
  const configPath = path.resolve(__dirname, '../../config.json');
  let config;

  try {
    config = require(configPath);
  } catch (error) {
    const errorMsg = `Error al cargar config.json en nestjs-generator. Asegúrate de que el archivo existe en la raíz del plugin y tiene el formato correcto.\n\nRuta esperada: ${configPath}\n\nError: ${error.message}`;
    logger.log(errorMsg, 'ERROR');
    throw new Error(errorMsg);
  }

  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey) {
    const errorMsg = 'GEMINI_API_KEY no está configurada en config.json para nestjs-generator. Por favor, asegúrate de que el archivo config.json contiene la clave GEMINI_API_KEY con tu API key de Google AI Studio.\n\nRuta del archivo: ' + configPath;
    logger.log(errorMsg, 'ERROR');
    throw new Error(errorMsg);
  }
  return apiKey;
}

/**
 * Genera el prompt para crear un script bash (macOS/Linux)
 */
function generateBashPrompt(plantUMLCode) {
  return `
**Rol:** Eres un desarrollador backend senior experto en NestJS, Prisma ORM, arquitectura de software y un maestro en shell scripting (bash).
**Tarea:** A partir del siguiente diagrama de clases de PlantUML, genera un **único script de bash (.sh)** que cree un proyecto NestJS completo con Prisma ORM configurado, incluyendo toda la estructura de carpetas y archivos con su contenido, permitiendo persistencia inmediata en cada clase.
**Requisitos del Script Bash:**
0.  **Configurar PATH y verificar npm/nest (CRÍTICO):** El script DEBE empezar configurando el PATH para incluir las rutas comunes de Node.js y npm. Luego verificar e instalar NestJS CLI si es necesario. Usa algo como:
    \`\`\`bash
    # Configurar PATH para incluir Node.js y npm
    export PATH="$HOME/.nvm/versions/node/\$(nvm version 2>/dev/null || echo 'lts/*')/bin:$PATH"
    export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
    
    # Buscar npm en ubicaciones comunes
    if ! command -v npm &> /dev/null; then
      # Intentar encontrar npm en ubicaciones comunes
      if [ -f "$HOME/.nvm/nvm.sh" ]; then
        source "$HOME/.nvm/nvm.sh"
      fi
      if [ -d "/usr/local/bin" ] && [ -f "/usr/local/bin/npm" ]; then
        export PATH="/usr/local/bin:$PATH"
      fi
      if [ -d "/opt/homebrew/bin" ] && [ -f "/opt/homebrew/bin/npm" ]; then
        export PATH="/opt/homebrew/bin:$PATH"
      fi
    fi
    
    # Verificar que npm esté disponible
    if ! command -v npm &> /dev/null; then
      echo "Error: npm no está disponible. Por favor instala Node.js y npm primero."
      exit 1
    fi
    
    # Verificar e instalar NestJS CLI si es necesario
    if ! command -v nest &> /dev/null; then
      echo "Instalando NestJS CLI..."
      npm install -g @nestjs/cli
    fi
    \`\`\`
1.  **Crear Proyecto:** Después de asegurar que NestJS CLI está instalado, el script debe crear un nuevo proyecto NestJS (ej: \`nest new mi-proyecto-backend --skip-git --package-manager npm\`).
2.  **Navegar al Proyecto:** Debe incluir el comando \`cd mi-proyecto-backend\`.
3.  **Instalar Prisma CLI y dependencias:** El script DEBE instalar Prisma CLI y las dependencias necesarias:
    \`\`\`bash
    npm install prisma @prisma/client
    npm install -D @types/node
    \`\`\`
4.  **Inicializar Prisma y configurar .env (CRÍTICO - ORDEN IMPORTANTE):** El script debe:
    a) Inicializar Prisma con SQLite:
    \`\`\`bash
    npx prisma init --datasource-provider sqlite
    \`\`\`
    b) **INMEDIATAMENTE DESPUÉS** (sin ejecutar ningún otro comando), configurar el archivo \`.env\` con \`DATABASE_URL\` para SQLite:
    \`\`\`bash
    # Asegurar que .env existe y tiene DATABASE_URL para SQLite
    # Esto DEBE hacerse inmediatamente después de prisma init y ANTES de cualquier otro comando de Prisma
    if [ ! -f .env ]; then
      echo 'DATABASE_URL="file:./dev.db"' > .env
    else
      # Si .env existe pero no tiene DATABASE_URL, agregarla
      if ! grep -q "DATABASE_URL" .env; then
        echo 'DATABASE_URL="file:./dev.db"' >> .env
      else
        # Si existe pero está configurada para otra BD, reemplazarla
        sed -i.bak 's|^DATABASE_URL=.*|DATABASE_URL="file:./dev.db"|' .env
      fi
    fi
    \`\`\`
    c) **CRÍTICO - Configurar prisma.config.ts:** Si Prisma genera un archivo \`prisma.config.ts\`, el script DEBE asegurarse de que importe \`dotenv/config\` para cargar las variables de entorno del archivo \`.env\`. El script debe verificar si existe \`prisma.config.ts\` y, si existe, asegurarse de que tenga esta línea al inicio. **IMPORTANTE:** NO usar \`sed\` con comando \`i\` ya que falla en macOS. En su lugar, usar un método más robusto:
    \`\`\`bash
    # Verificar y configurar prisma.config.ts para cargar variables de entorno
    if [ -f prisma.config.ts ]; then
      # Verificar si ya tiene la importación de dotenv
      if ! grep -q 'import "dotenv/config"' prisma.config.ts; then
        # Agregar la importación al inicio del archivo usando un método compatible con macOS y Linux
        # Crear un archivo temporal con la importación y luego el contenido original
        echo 'import "dotenv/config";' > prisma.config.ts.tmp
        cat prisma.config.ts >> prisma.config.ts.tmp
        mv prisma.config.ts.tmp prisma.config.ts
      fi
    fi
    \`\`\`
    **CRÍTICO:** El orden debe ser: 1) \`prisma init\`, 2) configurar \`.env\`, 3) configurar \`prisma.config.ts\` (si existe), 4) configurar \`schema.prisma\`, 5) ejecutar comandos de Prisma (\`prisma migrate\`, \`prisma generate\`). NO ejecutar ningún comando de Prisma antes de tener el \`.env\` configurado y \`prisma.config.ts\` (si existe) configurado para cargar dotenv.
6.  **Configurar Prisma Schema:** El script debe crear/sobrescribir el archivo \`prisma/schema.prisma\` con:
    - Configuración del generador de cliente Prisma
    - Configuración del datasource (SQLite por defecto, pero preparado para PostgreSQL/MySQL)
    - Modelos Prisma basados en TODAS las entidades del diagrama PlantUML, incluyendo:
      * Campos correspondientes a las propiedades de cada clase
      * Relaciones entre entidades (si existen en el diagrama)
      * Tipos de datos apropiados (String, Int, DateTime, Boolean, etc.)
      * Campos @id y @default para IDs auto-generados
      * Campos @createdAt y @updatedAt cuando sea apropiado
    Ejemplo de modelo:
    \`\`\`prisma
    model Usuario {
      id        Int      @id @default(autoincrement())
      nombre    String
      email     String   @unique
      createdAt DateTime @default(now())
      updatedAt DateTime @updatedAt
    }
    \`\`\`
7.  **Generar Prisma Client y Migraciones:** Después de configurar el schema, el script debe VERIFICAR que el archivo \`.env\` existe y tiene \`DATABASE_URL\`, y que \`prisma.config.ts\` (si existe) está configurado correctamente antes de ejecutar comandos de Prisma:
    \`\`\`bash
    # Verificar que .env existe y tiene DATABASE_URL
    if [ ! -f .env ] || ! grep -q "DATABASE_URL" .env; then
      echo "ERROR: .env no está configurado correctamente. Configurando..."
      echo 'DATABASE_URL="file:./dev.db"' > .env
    fi
    
    # Verificar que prisma.config.ts (si existe) tiene la importación de dotenv
    if [ -f prisma.config.ts ] && ! grep -q 'import "dotenv/config"' prisma.config.ts; then
      echo "Configurando prisma.config.ts para cargar variables de entorno..."
      # Usar método compatible con macOS y Linux (no usar sed con comando i)
      echo 'import "dotenv/config";' > prisma.config.ts.tmp
      cat prisma.config.ts >> prisma.config.ts.tmp
      mv prisma.config.ts.tmp prisma.config.ts
    fi
    
    # Instalar dotenv si no está instalado (necesario para prisma.config.ts)
    if ! grep -q '"dotenv"' package.json; then
      npm install dotenv
    fi
    
    # Ahora ejecutar comandos de Prisma
    npx prisma migrate dev --name init
    npx prisma generate
    \`\`\`
8.  **Crear PrismaService:** El script debe crear un servicio Prisma reutilizable en \`src/prisma/prisma.service.ts\`:
    \`\`\`typescript
    import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
    import { PrismaClient } from '@prisma/client';

    @Injectable()
    export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
      async onModuleInit() {
        await this.$connect();
      }

      async onModuleDestroy() {
        await this.$disconnect();
      }
    }
    \`\`\`
9.  **Crear PrismaModule:** El script debe crear un módulo Prisma en \`src/prisma/prisma.module.ts\` que exporte PrismaService como provider global:
    \`\`\`typescript
    import { Module, Global } from '@nestjs/common';
    import { PrismaService } from './prisma.service';

    @Global()
    @Module({
      providers: [PrismaService],
      exports: [PrismaService],
    })
    export class PrismaModule {}
    \`\`\`
10. **Importar PrismaModule en AppModule:** El script debe actualizar \`src/app.module.ts\` para importar PrismaModule. **IMPORTANTE:** NO usar \`sed\` para modificar este archivo, ya que puede fallar con caracteres especiales. En su lugar, usar \`cat <<'EOF' > src/app.module.ts\` para reescribir el archivo completo con el contenido actualizado que incluya la importación de PrismaModule en el array de imports del decorador @Module.
11. **Generar Módulos (CLI):** Para cada entidad principal del diagrama, debe usar los comandos de NestJS CLI para generar el módulo, controlador y servicio (ej: \`nest g module modules/usuarios\`, \`nest g controller modules/usuarios --no-spec\`, \`nest g service modules/usuarios --no-spec\`).
12. **Escribir Archivos (DTOs y Lógica con Prisma):** El script debe usar comandos \`cat <<'EOF' > [RUTA_DEL_ARCHIVO]\` para crear o **sobrescribir** los archivos con el contenido completo.
    * **DTOs:** Debe crear las carpetas \`dto\` (ej: \`mkdir -p src/modules/usuarios/dto\`) y escribir los archivos \`create-usuario.dto.ts\` y \`update-usuario.dto.ts\` con las propiedades del diagrama usando class-validator decorators (@IsString, @IsEmail, @IsOptional, etc.).
    * **Servicios:** Debe **sobrescribir** el archivo \`*.service.ts\` generado por el CLI con la lógica CRUD completa usando PrismaService:
      - Inyectar PrismaService en el constructor
      - Implementar create() usando \`this.prisma.[modelo].create({ data: createDto })\`
      - Implementar findAll() usando \`this.prisma.[modelo].findMany()\`
      - Implementar findOne() usando \`this.prisma.[modelo].findUnique({ where: { id } })\` y lanzar NotFoundException si no existe: \`if (!item) throw new NotFoundException(\`[Modelo] with ID \${id} not found\`);\`
      - Implementar update() usando \`this.prisma.[modelo].update({ where: { id }, data: updateDto })\` con manejo de errores usando try-catch
      - Implementar remove() usando \`this.prisma.[modelo].delete({ where: { id } })\` con manejo de errores usando try-catch
      - **CRÍTICO - Template Literals:** Al escribir código TypeScript dentro de \`cat <<'EOF'\`, los template literals (backticks \`\`\` y \${expresion}) deben escribirse LITERALMENTE sin escapar. Ejemplo CORRECTO: \`throw new NotFoundException(\`Item with ID \${id} not found\`);\` - Ejemplo INCORRECTO: \`throw new NotFoundException(\\\`Item with ID \\\${id} not found\\\`);\` - Los backticks y \${} NO deben tener barras invertidas de escape.
      - Manejar errores apropiadamente: importar \`NotFoundException\` de \`@nestjs/common\` y usar try-catch para capturar \`PrismaClientKnownRequestError\` de \`@prisma/client/runtime/library\`
    * **Controladores:** Debe **sobrescribir** el archivo \`*.controller.ts\` con todos los endpoints RESTful (@Post, @Get, @Patch, @Delete) que se conecten al servicio, usando ValidationPipe para validar DTOs.
    * **Módulos:** Debe **sobrescribir** el archivo \`*.module.ts\` para asegurarse de que el controlador y el servicio estén correctamente importados. NO necesita importar PrismaModule porque es global.
13. **Configurar ValidationPipe global:** El script debe actualizar \`src/main.ts\` para incluir ValidationPipe globalmente:
    \`\`\`typescript
    import { ValidationPipe } from '@nestjs/common';
    app.useGlobalPipes(new ValidationPipe());
    \`\`\`
14. **Instalar class-validator y class-transformer:** El script debe instalar las dependencias necesarias para validación:
    \`\`\`bash
    npm install class-validator class-transformer
    \`\`\`
**IMPORTANTE:** 
- Cada servicio DEBE usar PrismaService para persistencia inmediata en la base de datos
- NO usar arrays en memoria ni datos mock
- Todos los modelos del diagrama PlantUML DEBEN estar en el schema.prisma
- Las relaciones entre entidades deben reflejarse en el schema.prisma
- El proyecto generado debe estar listo para usar inmediatamente con persistencia real
**Formato de Salida:**
Responde **únicamente** con el script de bash, comenzando con \`#!/bin/bash\` y nada más. No incluyas explicaciones, solo el código del script.
**Diagrama PlantUML de entrada:**
\`\`\`plantuml
${plantUMLCode}
\`\`\`
`;
}

/**
 * Genera el prompt para crear un script batch (Windows)
 */
function generateBatchPrompt(plantUMLCode) {
  return `
**Rol:** Eres un desarrollador backend senior experto en NestJS, Prisma ORM, arquitectura de software y un maestro en scripting de Windows (batch/cmd).
**Tarea:** A partir del siguiente diagrama de clases de PlantUML, genera un **único script de batch (.bat)** que cree un proyecto NestJS completo con Prisma ORM configurado, incluyendo toda la estructura de carpetas y archivos con su contenido, permitiendo persistencia inmediata en cada clase.
**Requisitos del Script Batch:**
0.  **Configurar PATH y verificar npm/nest (CRÍTICO):** El script DEBE empezar configurando el PATH para incluir las rutas comunes de Node.js y npm en Windows. Luego verificar e instalar NestJS CLI si es necesario. Usa algo como:
    \`\`\`batch
    @echo off
    setlocal enabledelayedexpansion
    
    REM Configurar PATH para incluir Node.js y npm
    set "NODE_PATH=C:\\Program Files\\nodejs"
    if exist "C:\\Program Files (x86)\\nodejs" set "NODE_PATH=C:\\Program Files (x86)\\nodejs"
    set "PATH=%NODE_PATH%;%APPDATA%\\npm;%PATH%"
    
    REM Verificar que npm esté disponible
    where npm >nul 2>&1
    if errorlevel 1 (
      echo Error: npm no está disponible. Por favor instala Node.js y npm primero.
      exit /b 1
    )
    
    REM Verificar e instalar NestJS CLI si es necesario
    where nest >nul 2>&1
    if errorlevel 1 (
      echo Instalando NestJS CLI...
      call npm install -g @nestjs/cli
    )
    \`\`\`
1.  **Crear Proyecto:** Después de asegurar que NestJS CLI está instalado, el script debe crear un nuevo proyecto NestJS (ej: \`nest new mi-proyecto-backend --skip-git --package-manager npm\`).
2.  **Navegar al Proyecto:** Debe incluir el comando \`cd mi-proyecto-backend\`.
3.  **Instalar Prisma CLI y dependencias:** El script DEBE instalar Prisma CLI y las dependencias necesarias:
    \`\`\`batch
    call npm install prisma @prisma/client
    call npm install -D @types/node
    \`\`\`
4.  **Inicializar Prisma y configurar .env (CRÍTICO - ORDEN IMPORTANTE):** El script debe:
    a) Inicializar Prisma con SQLite:
    \`\`\`batch
    call npx prisma init --datasource-provider sqlite
    \`\`\`
    b) **INMEDIATAMENTE DESPUÉS** (sin ejecutar ningún otro comando), configurar el archivo \`.env\` con \`DATABASE_URL\` para SQLite:
    \`\`\`batch
    REM Asegurar que .env existe y tiene DATABASE_URL para SQLite
    if not exist .env (
      echo DATABASE_URL="file:./dev.db" > .env
    ) else (
      REM Verificar si DATABASE_URL existe en .env
      findstr /C:"DATABASE_URL" .env >nul
      if errorlevel 1 (
        REM No existe, agregarla
        echo DATABASE_URL="file:./dev.db" >> .env
      ) else (
        REM Existe, reemplazarla
        powershell -Command "(Get-Content .env) -replace '^DATABASE_URL=.*', 'DATABASE_URL=\"file:./dev.db\"' | Set-Content .env"
      )
    )
    \`\`\`
    c) **CRÍTICO - Configurar prisma.config.ts:** Si Prisma genera un archivo \`prisma.config.ts\`, el script DEBE asegurarse de que importe \`dotenv/config\` para cargar las variables de entorno del archivo \`.env\`. El script debe verificar si existe \`prisma.config.ts\` y, si existe, asegurarse de que tenga esta línea al inicio:
    \`\`\`batch
    REM Verificar y configurar prisma.config.ts para cargar variables de entorno
    if exist prisma.config.ts (
      REM Verificar si ya tiene la importación de dotenv
      findstr /C:"import \"dotenv/config\"" prisma.config.ts >nul
      if errorlevel 1 (
        REM No tiene la importación, agregarla al inicio usando PowerShell
        powershell -Command "$content = Get-Content prisma.config.ts; 'import \"dotenv/config\";' + [Environment]::NewLine + ($content -join [Environment]::NewLine) | Set-Content prisma.config.ts"
      )
    )
    \`\`\`
    **CRÍTICO:** El orden debe ser: 1) \`prisma init\`, 2) configurar \`.env\`, 3) configurar \`prisma.config.ts\` (si existe), 4) configurar \`schema.prisma\`, 5) ejecutar comandos de Prisma (\`prisma migrate\`, \`prisma generate\`). NO ejecutar ningún comando de Prisma antes de tener el \`.env\` configurado y \`prisma.config.ts\` (si existe) configurado para cargar dotenv.
6.  **Configurar Prisma Schema:** El script debe crear/sobrescribir el archivo \`prisma\\schema.prisma\` con:
    - Configuración del generador de cliente Prisma
    - Configuración del datasource (SQLite por defecto, pero preparado para PostgreSQL/MySQL)
    - Modelos Prisma basados en TODAS las entidades del diagrama PlantUML, incluyendo:
      * Campos correspondientes a las propiedades de cada clase
      * Relaciones entre entidades (si existen en el diagrama)
      * Tipos de datos apropiados (String, Int, DateTime, Boolean, etc.)
      * Campos @id y @default para IDs auto-generados
      * Campos @createdAt y @updatedAt cuando sea apropiado
    Ejemplo de modelo:
    \`\`\`prisma
    model Usuario {
      id        Int      @id @default(autoincrement())
      nombre    String
      email     String   @unique
      createdAt DateTime @default(now())
      updatedAt DateTime @updatedAt
    }
    \`\`\`
7.  **Generar Prisma Client y Migraciones:** Después de configurar el schema, el script debe VERIFICAR que el archivo \`.env\` existe y tiene \`DATABASE_URL\`, y que \`prisma.config.ts\` (si existe) está configurado correctamente antes de ejecutar comandos de Prisma:
    \`\`\`batch
    REM Verificar que .env existe y tiene DATABASE_URL
    if not exist .env (
      echo ERROR: .env no está configurado correctamente. Configurando...
      echo DATABASE_URL="file:./dev.db" > .env
    ) else (
      findstr /C:"DATABASE_URL" .env >nul
      if errorlevel 1 (
        echo ERROR: .env no tiene DATABASE_URL. Configurando...
        echo DATABASE_URL="file:./dev.db" >> .env
      )
    )
    
    REM Verificar que prisma.config.ts (si existe) tiene la importación de dotenv
    if exist prisma.config.ts (
      findstr /C:"import \"dotenv/config\"" prisma.config.ts >nul
      if errorlevel 1 (
        echo Configurando prisma.config.ts para cargar variables de entorno...
        powershell -Command "$content = Get-Content prisma.config.ts; 'import \"dotenv/config\";' + [Environment]::NewLine + ($content -join [Environment]::NewLine) | Set-Content prisma.config.ts"
      )
    )
    
    REM Instalar dotenv si no está instalado (necesario para prisma.config.ts)
    findstr /C:"\"dotenv\"" package.json >nul
    if errorlevel 1 (
      call npm install dotenv
    )
    
    REM Ahora ejecutar comandos de Prisma
    call npx prisma migrate dev --name init
    call npx prisma generate
    \`\`\`
8.  **Crear PrismaService:** El script debe crear un servicio Prisma reutilizable en \`src\\prisma\\prisma.service.ts\`:
    \`\`\`typescript
    import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
    import { PrismaClient } from '@prisma/client';

    @Injectable()
    export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
      async onModuleInit() {
        await this.$connect();
      }

      async onModuleDestroy() {
        await this.$disconnect();
      }
    }
    \`\`\`
9.  **Crear PrismaModule:** El script debe crear un módulo Prisma en \`src\\prisma\\prisma.module.ts\` que exporte PrismaService como provider global:
    \`\`\`typescript
    import { Module, Global } from '@nestjs/common';
    import { PrismaService } from './prisma.service';

    @Global()
    @Module({
      providers: [PrismaService],
      exports: [PrismaService],
    })
    export class PrismaModule {}
    \`\`\`
10. **Importar PrismaModule en AppModule:** El script debe actualizar \`src\\app.module.ts\` para importar PrismaModule. **IMPORTANTE:** NO usar comandos de edición de texto como \`sed\` o \`findstr\` para modificar este archivo, ya que pueden fallar con caracteres especiales en TypeScript. En su lugar, usar bloques de texto con redirección para reescribir el archivo completo con el contenido actualizado que incluya la importación de PrismaModule en el array de imports del decorador @Module.
11. **Generar Módulos (CLI):** Para cada entidad principal del diagrama, debe usar los comandos de NestJS CLI para generar el módulo, controlador y servicio (ej: \`nest g module modules/usuarios\`, \`nest g controller modules/usuarios --no-spec\`, \`nest g service modules/usuarios --no-spec\`).
12. **Escribir Archivos (DTOs y Lógica con Prisma):** El script debe usar comandos de Windows para crear o **sobrescribir** los archivos con el contenido completo. Usa bloques de texto con redirección (ej: \`(echo contenido) > archivo.ts\` o bloques múltiples con \`>>\`).
    * **DTOs:** Debe crear las carpetas \`dto\` (ej: \`if not exist "src\\modules\\usuarios\\dto" mkdir "src\\modules\\usuarios\\dto"\`) y escribir los archivos \`create-usuario.dto.ts\` y \`update-usuario.dto.ts\` con las propiedades del diagrama usando class-validator decorators (@IsString, @IsEmail, @IsOptional, etc.).
    * **Servicios:** Debe **sobrescribir** el archivo \`*.service.ts\` generado por el CLI con la lógica CRUD completa usando PrismaService:
      - Inyectar PrismaService en el constructor
      - Implementar create() usando \`this.prisma.[modelo].create({ data: createDto })\`
      - Implementar findAll() usando \`this.prisma.[modelo].findMany()\`
      - Implementar findOne() usando \`this.prisma.[modelo].findUnique({ where: { id } })\` y lanzar NotFoundException si no existe: \`if (!item) throw new NotFoundException(\`[Modelo] with ID \${id} not found\`);\`
      - Implementar update() usando \`this.prisma.[modelo].update({ where: { id }, data: updateDto })\` con manejo de errores usando try-catch
      - Implementar remove() usando \`this.prisma.[modelo].delete({ where: { id } })\` con manejo de errores usando try-catch
      - **CRÍTICO - Template Literals:** Al escribir código TypeScript dentro de bloques de texto en batch, los template literals (backticks \`\`\` y \${expresion}) deben escribirse LITERALMENTE sin escapar. Ejemplo CORRECTO: \`throw new NotFoundException(\`Item with ID \${id} not found\`);\` - Ejemplo INCORRECTO: \`throw new NotFoundException(\\\`Item with ID \\\${id} not found\\\`);\` - Los backticks y \${} NO deben tener barras invertidas de escape.
      - Manejar errores apropiadamente: importar \`NotFoundException\` de \`@nestjs/common\` y usar try-catch para capturar \`PrismaClientKnownRequestError\` de \`@prisma/client/runtime/library\`
    * **Controladores:** Debe **sobrescribir** el archivo \`*.controller.ts\` con todos los endpoints RESTful (@Post, @Get, @Patch, @Delete) que se conecten al servicio, usando ValidationPipe para validar DTOs.
    * **Módulos:** Debe **sobrescribir** el archivo \`*.module.ts\` para asegurarse de que el controlador y el servicio estén correctamente importados. NO necesita importar PrismaModule porque es global.
13. **Configurar ValidationPipe global:** El script debe actualizar \`src\\main.ts\` para incluir ValidationPipe globalmente:
    \`\`\`typescript
    import { ValidationPipe } from '@nestjs/common';
    app.useGlobalPipes(new ValidationPipe());
    \`\`\`
14. **Instalar class-validator y class-transformer:** El script debe instalar las dependencias necesarias para validación:
    \`\`\`batch
    call npm install class-validator class-transformer
    \`\`\`
**IMPORTANTE:** 
- Cada servicio DEBE usar PrismaService para persistencia inmediata en la base de datos
- NO usar arrays en memoria ni datos mock
- Todos los modelos del diagrama PlantUML DEBEN estar en el schema.prisma
- Las relaciones entre entidades deben reflejarse en el schema.prisma
- El proyecto generado debe estar listo para usar inmediatamente con persistencia real
**Notas importantes para Windows:**
- Usa rutas con barras invertidas (\\) o barras normales (/) según sea necesario
- Usa \`call\` antes de comandos npm/nest para asegurar que el script continúe después de ejecutarlos
- Para escribir archivos multilínea, usa bloques con paréntesis y redirección, o crea archivos temporales
- Usa \`@echo off\` al inicio para evitar mostrar comandos
- Usa \`setlocal enabledelayedexpansion\` si necesitas variables en bucles
**Formato de Salida:**
Responde **únicamente** con el script de batch, comenzando con \`@echo off\` y nada más. No incluyas explicaciones, solo el código del script.
**Diagrama PlantUML de entrada:**
\`\`\`plantuml
${plantUMLCode}
\`\`\`
`;
}

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
    
    // Detectar la plataforma del sistema operativo
    const isWindows = process.platform === 'win32';
    const isMacOS = process.platform === 'darwin';
    const isLinux = process.platform === 'linux';
    
    logs.push(`PlantUML recibido: ${plantUMLCode.length} caracteres`);
    logger.log(`Plataforma detectada: ${isWindows ? 'Windows' : isMacOS ? 'macOS' : isLinux ? 'Linux' : 'Otro'}`);
    
    // 1. Crear el prompt para Gemini según la plataforma
    const prompt = isWindows ? generateBatchPrompt(plantUMLCode) : generateBashPrompt(plantUMLCode);
    const scriptType = isWindows ? 'batch (.bat)' : 'bash (.sh)';
    logger.log(`Generando script ${scriptType} para NestJS...`);
    logs.push(`Generando script ${scriptType} para ${isWindows ? 'Windows' : 'macOS/Linux'}...`);

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
    const response = await fetch(`${URL}?key=${getApiKey()}`, {
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
    if (isWindows) {
      // Para scripts batch de Windows
      generatedScript = generatedScript
        .replace(/^```batch\n?/i, '')
        .replace(/^```cmd\n?/i, '')
        .replace(/^```bat\n?/i, '')
        .replace(/^```\n?/, '')
        .replace(/\n```$/, '')
        .replace(/\n```batch$/i, '')
        .replace(/\n```cmd$/i, '')
        .replace(/\n```bat$/i, '')
        .trim();
      
      // Asegurar que empiece con @echo off
      if (!generatedScript.toLowerCase().includes('@echo off') && !generatedScript.toLowerCase().includes('@echo')) {
        generatedScript = '@echo off\nsetlocal enabledelayedexpansion\n\n' + generatedScript;
      }
    } else {
      // Para scripts bash de macOS/Linux
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
    }
    
    logger.log(`Script ${scriptType} generado: ${generatedScript.length} caracteres`);
    logs.push(`Script ${scriptType} generado exitosamente: ${generatedScript.length} caracteres`);
    
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
    
    // Determinar la extensión del archivo según la plataforma
    const scriptExtension = isWindows ? '.bat' : '.sh';
    const outputFilename = path.join(finalOutputDir, `generar-backend${scriptExtension}`);
    logger.log(`Directorio de salida: ${finalOutputDir}`);
    logger.log(`Archivo de salida: ${outputFilename}`);
    logger.log(`Tipo de script: ${scriptType}`);
    
    // 7. Guardar el script con la codificación correcta
    // Windows batch scripts deben guardarse con codificación adecuada (utf8 funciona en la mayoría de los casos)
    await fs.writeFile(outputFilename, generatedScript, 'utf8');
    logger.log(`Script guardado en: ${outputFilename}`);
    logs.push(`Script ${scriptType} guardado en: ${outputFilename}`);
    
    // 8. Dar permisos de ejecución (solo en macOS/Linux - Unix-like systems)
    // En Windows, los permisos funcionan diferente y no se necesita chmod
    if (!isWindows) {
      try {
        await fs.chmod(outputFilename, 0o755);
        logger.log('Permisos de ejecución otorgados (chmod +x)');
        logs.push('Permisos de ejecución otorgados (chmod +x) - macOS/Linux');
      } catch (err) {
        logger.log(`Advertencia: No se pudieron otorgar permisos de ejecución: ${err.message}`, 'WARN');
        logs.push(`Advertencia: Permisos de ejecución: ${err.message}`);
      }
    } else {
      logger.log('Windows detectado: No se requieren permisos chmod (Windows maneja permisos diferente)');
      logs.push('Windows detectado: Los permisos de archivos se manejan automáticamente');
    }
    
    // 9. Ejecutar el script automáticamente
    logger.log('Iniciando ejecución del script... (Esto puede tardar varios minutos)');
    logs.push('Iniciando ejecución del script...');
    
    // Asegurar que el path sea absoluto
    const scriptPath = path.isAbsolute(outputFilename) 
      ? outputFilename 
      : path.join(finalOutputDir, outputFilename);
    
    // Verificar que el archivo existe antes de ejecutarlo
    try {
      await fs.access(scriptPath, fs.constants.F_OK);
      logger.log(`Script encontrado: ${scriptPath}`);
    } catch (err) {
      throw new Error(`El script no existe en: ${scriptPath}`);
    }
    
    // Verificar permisos de ejecución (solo en sistemas Unix-like)
    if (!isWindows) {
      try {
        await fs.access(scriptPath, fs.constants.X_OK);
        logger.log(`Script tiene permisos de ejecución`);
      } catch (err) {
        logger.log(`Otorgando permisos de ejecución nuevamente...`, 'WARN');
        try {
          await fs.chmod(scriptPath, 0o755);
        } catch (chmodErr) {
          logger.log(`No se pudieron otorgar permisos: ${chmodErr.message}`, 'WARN');
        }
      }
    }
    
    logger.log(`Ejecutando script: ${scriptPath}`);
    logger.log(`Directorio de trabajo: ${finalOutputDir}`);
    logger.log(`Plataforma: ${process.platform} (${isWindows ? 'Windows' : isMacOS ? 'macOS' : isLinux ? 'Linux' : 'Otro'})`);
    
    // Verificar que npm esté disponible antes de ejecutar
    logger.log('Verificando que npm esté disponible...');
    try {
      const npmCheck = spawn('npm', ['--version'], { stdio: 'pipe' });
      await new Promise((resolve, reject) => {
        npmCheck.on('close', (code) => {
          if (code === 0) {
            logger.log('npm está disponible');
            resolve();
          } else {
            reject(new Error('npm no está disponible'));
          }
        });
        npmCheck.on('error', reject);
      });
    } catch (err) {
      logger.log('Advertencia: No se pudo verificar npm, continuando de todos modos...', 'WARN');
    }
    
    // Configurar el comando de ejecución según la plataforma
    let command;
    let args;
    
    if (isWindows) {
      // En Windows, ejecutar el script .bat directamente con cmd
      command = 'cmd';
      args = ['/c', scriptPath];
      logger.log('Ejecutando script batch de Windows con cmd');
    } else {
      // En macOS/Linux, usar bash explícitamente para ejecutar el script .sh
      command = '/bin/bash';
      args = [scriptPath];
      logger.log('Ejecutando script bash con /bin/bash');
    }
    
    logger.log(`Comando: ${command} ${args.join(' ')}`);
    
    // Construir un PATH mejorado que incluya rutas comunes de Node.js/npm
    const homeDir = os.homedir();
    let commonPaths = [];
    let npmPath = null;
    const pathSeparator = isWindows ? ';' : ':';
    
    if (isWindows) {
      // Rutas comunes en Windows para Node.js/npm
      commonPaths = [
        path.join(homeDir, 'AppData', 'Roaming', 'npm'),
        'C:\\Program Files\\nodejs',
        'C:\\Program Files (x86)\\nodejs',
        process.env.PATH || ''
      ].filter(Boolean);
      
      // Intentar encontrar npm en Windows
      try {
        const whereResult = execSync('where npm', { encoding: 'utf8', stdio: 'pipe' }).trim();
        if (whereResult && whereResult.length > 0) {
          npmPath = whereResult.split('\n')[0].trim();
          logger.log(`npm encontrado en: ${npmPath}`);
        }
      } catch (err) {
        // Intentar con rutas comunes de Windows
        const possiblePaths = [
          'C:\\Program Files\\nodejs\\npm.cmd',
          'C:\\Program Files (x86)\\nodejs\\npm.cmd',
          path.join(homeDir, 'AppData', 'Roaming', 'npm', 'npm.cmd')
        ];
        
        for (const possiblePath of possiblePaths) {
          try {
            await fs.access(possiblePath, fs.constants.F_OK);
            npmPath = possiblePath;
            logger.log(`npm encontrado en ubicación común: ${npmPath}`);
            break;
          } catch (e) {
            // Continuar buscando
          }
        }
      }
    } else {
      // Rutas comunes en macOS/Linux para Node.js/npm
      commonPaths = [
        `${homeDir}/.nvm/versions/node/*/bin`,
        '/usr/local/bin',
        '/opt/homebrew/bin',
        '/usr/bin',
        '/bin',
        process.env.PATH || ''
      ].filter(Boolean);
      
      // Intentar encontrar npm en macOS/Linux
      try {
        npmPath = execSync('which npm', { encoding: 'utf8' }).trim();
        logger.log(`npm encontrado en: ${npmPath}`);
      } catch (err) {
        // Intentar con rutas comunes
        const possiblePaths = [
          '/usr/local/bin/npm',
          '/opt/homebrew/bin/npm',
          '/usr/bin/npm'
        ];
        
        for (const possiblePath of possiblePaths) {
          try {
            await fs.access(possiblePath, fs.constants.F_OK);
            npmPath = possiblePath;
            logger.log(`npm encontrado en ubicación común: ${npmPath}`);
            break;
          } catch (e) {
            // Continuar buscando
          }
        }
      }
    }
    
    // Construir PATH mejorado
    const enhancedPath = [
      ...commonPaths,
      ...(npmPath ? [path.dirname(npmPath)] : []),
      process.env.PATH || ''
    ].join(pathSeparator);
    
    logger.log(`PATH mejorado: ${enhancedPath.substring(0, 200)}...`);
    
    // Ejecutar el script con PATH mejorado
    const child = spawn(command, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      cwd: finalOutputDir,
      env: { 
        ...process.env, 
        PATH: enhancedPath,
        HOME: homeDir
      }
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
      // Manejar errores de spawn (cuando no se puede iniciar el proceso)
      child.on('error', (err) => {
        logger.log(`Error al ejecutar el script: ${err.message}`, 'ERROR');
        logger.log(`Comando intentado: ${command} ${args.join(' ')}`, 'ERROR');
        stderr += `Error al ejecutar: ${err.message}\n`;
        reject(err);
      });
      
      // Manejar cuando el proceso termina
      child.on('close', (code) => {
        logger.log(`Script terminó con código: ${code}`);
        resolve(code);
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
      if (stdout) {
        logs.push(`\n--- Salida del Script ---\n${stdout}`);
      }
      if (stderr) {
        logs.push(`\n--- Errores del Script ---\n${stderr}`);
      }
      
      // Crear error con logs incluidos
      const errorWithLogs = new Error(errorMessage);
      errorWithLogs.logs = logs;
      errorWithLogs.stdout = stdout;
      errorWithLogs.stderr = stderr;
      errorWithLogs.exitCode = exitCode;
      
      throw errorWithLogs;
    }
    
  } catch (error) {
    const errorMessage = `Error al generar proyecto NestJS: ${error.message}`;
    logger.log(errorMessage, 'ERROR');
    logs.push(`ERROR: ${errorMessage}`);
    
    // Retornar información del error incluyendo logs si están disponibles
    // Si el error ya tiene logs (por ejemplo, de un error anterior), preservarlos
    const errorWithLogs = new Error(errorMessage);
    errorWithLogs.logs = error.logs || logs;
    errorWithLogs.stdout = error.stdout || '';
    errorWithLogs.stderr = error.stderr || error.message;
    errorWithLogs.exitCode = error.exitCode;
    
    throw errorWithLogs;
  }
}

module.exports = {
  run
};

