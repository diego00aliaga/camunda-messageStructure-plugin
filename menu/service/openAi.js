/**
 * Servicio para interactuar con OpenAI API
 * Encargado de generar scripts de backend y corregirlos mediante LLM.
 */
const OpenAI = require('openai');
const path = require('path');
const logger = require('../log/logger');

// Función para obtener la API Key de config.json
function getApiKey() {
  const configPath = path.resolve(__dirname, '../../config.json');
  let config;

  try {
    config = require(configPath);
  } catch (error) {
    const errorMsg = `Error al cargar config.json en openAi. Asegúrate de que el archivo existe en la raíz del plugin y tiene el formato correcto.\n\nRuta esperada: ${configPath}\n\nError: ${error.message}`;
    logger.log(errorMsg, 'ERROR');
    throw new Error(errorMsg);
  }

  const apiKey = config.OPENAI_API_KEY;
  if (!apiKey) {
    const errorMsg = 'OPENAI_API_KEY no está configurada en config.json para openAi. Por favor, asegúrate de que el archivo config.json contiene la clave OPENAI_API_KEY con tu API key de OpenAI.\n\nRuta del archivo: ' + configPath;
    logger.log(errorMsg, 'ERROR');
    throw new Error(errorMsg);
  }
  return apiKey;
}

/**
 * Genera el prompt para crear un script bash (macOS/Linux)
 * Incluye lógica robusta para preservación de PATH y escritura de archivos.
 */
function generateBashPrompt(plantUMLCode) {
    return `
  **Rol:** Arquitecto de Software Senior y experto en NestJS/Prisma/Bash.
  **Objetivo:** Generar un script .sh que construya el backend completo, SIN errores de compilación TS ni errores de Prisma.
  
  **🚨 REGLA 1: CONFIGURACIÓN DEL PATH:**
  El script debe configurarse a sí mismo al inicio:
  \`\`\`bash
  #!/bin/bash
  set -e
  export NVM_DIR="\$HOME/.nvm"
  [ -s "\$NVM_DIR/nvm.sh" ] && \\. "\$NVM_DIR/nvm.sh"
  export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:\$PATH"
  if ! command -v npm &> /dev/null; then echo "ERROR: npm no encontrado"; exit 1; fi
  \`\`\`
  
  **🚨 REGLA 2: NAMING CONVENTION (PASCALCASE):**
  En \`schema.prisma\`, convierte los nombres de modelos a **PascalCase**.
  * Diagrama: \`periodo_academico\` -> Schema: \`model PeriodoAcademico\`.
  * Esto permite usar \`this.prisma.periodoAcademico\` (camelCase) en los servicios sin errores.
  
  **🚨 REGLA 3: CAMPOS AUTOMÁTICOS (FIX ERROR FECHAS):**
  El error "Property missing in type" ocurre porque Prisma espera que envíes manualmente fechas de auditoría.
  **SOLUCIÓN OBLIGATORIA EN SCHEMA.PRISMA:**
  Al generar el modelo, aplica estas reglas a los campos:
  1. **ID:** \`id Int @id @default(autoincrement())\`.
  2. **Creación:** Si el campo es \`createdAt\`, \`fechaCreacion\`, \`fecha_creacion\`, etc. -> \`DateTime @default(now())\`.
  3. **Modificación:** Si el campo es \`updatedAt\`, \`fechaModificacion\`, \`fechaDeModificacion\`, \`fecha_modificacion\`, etc. -> **\`DateTime @updatedAt\`**.
     *(Esto hace que Prisma lo gestione solo y no lo pida en el DTO)*.
  4. **Estado:** Si es \`estado\` o \`status\` -> \`String @default("ACTIVO")\`.
  
  **PASOS DEL SCRIPT:**
  
  1.  **Limpieza y Creación:**
      \`\`\`bash
      rm -rf backend
      nest new backend --skip-git --package-manager npm
      cd backend
      \`\`\`
  
  2.  **Dependencias (FIX ERROR PROCESS):**
      * Instala explícitamente los tipos de node.
      \`\`\`bash
      npm install prisma @prisma/client class-validator class-transformer
      npm install -D @types/node typescript ts-node
      \`\`\`
  
  3.  **Prisma Init:**
      \`\`\`bash
      npx prisma init --datasource-provider sqlite
      echo 'DATABASE_URL="file:./dev.db"' > .env
      export DATABASE_URL="file:./dev.db"
      \`\`\`
  
  4.  **Schema.prisma (APLICANDO REGLAS):**
      * Escribe \`prisma/schema.prisma\`.
      * **IMPORTANTE:** Aplica las reglas de \`@default(now())\` y \`@updatedAt\` a los campos de fecha para evitar errores en los DTOs.
      * Convierte nombres de modelos a PascalCase.
  
  5.  **Arquitectura Global:**
      * Crea \`src/prisma/prisma.service.ts\` y \`src/prisma/prisma.module.ts\`.
  
  6.  **GENERACIÓN DE RECURSOS (FUERZA BRUTA - UNO POR UNO):**
      * **Instrucción:** Genera el código para **CADA** clase del diagrama.
      
      *Estructura del bloque para CADA clase (Ej: "Programa"):*
      \`\`\`bash
      # --- Entidad: Programa ---
      echo "Generando Programa..."
      nest g resource modules/programa --no-spec
  
      # 1. DTOs (Solo campos editables por usuario)
      mkdir -p src/modules/programa/dto
      cat <<EOF > src/modules/programa/dto/create-programa.dto.ts
      import { IsString, IsInt, IsOptional, IsDateString } from 'class-validator';
      export class CreateProgramaDto {
          // NO incluyas id, fechaCreacion ni fechaDeModificacion aquí.
          // Solo campos de negocio (ej: nombre, codigo, descripcion).
          @IsString()
          nombre: string;
          
          // Agrega el resto de campos del diagrama...
      }
      EOF
  
      # 2. SERVICIO (Usando camelCase)
      cat <<EOF > src/modules/programa/programa.service.ts
      import { Injectable, NotFoundException } from '@nestjs/common';
      import { PrismaService } from '../../prisma/prisma.service';
      import { CreateProgramaDto } from './dto/create-programa.dto';
      
      @Injectable()
      export class ProgramaService {
        constructor(private readonly prisma: PrismaService) {}
  
        // Nota: this.prisma.programa (camelCase)
        create(data: CreateProgramaDto) { return this.prisma.programa.create({ data }); }
        
        findAll() { return this.prisma.programa.findMany(); }
        
        async findOne(id: number) {
          const item = await this.prisma.programa.findUnique({ where: { id } });
          if (!item) throw new NotFoundException(\\\`Programa with ID \\\${id} not found\\\`);
          return item;
        }
        
        update(id: number, data: any) { return this.prisma.programa.update({ where: { id }, data }); }
        
        remove(id: number) { return this.prisma.programa.delete({ where: { id } }); }
      }
      EOF
  
      # 3. CONTROLADOR
      cat <<EOF > src/modules/programa/programa.controller.ts
      import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
      import { ProgramaService } from './programa.service';
      import { CreateProgramaDto } from './dto/create-programa.dto';
  
      @Controller('programa')
      export class ProgramaController {
        constructor(private readonly service: ProgramaService) {}
        @Post() create(@Body() dto: CreateProgramaDto) { return this.service.create(dto); }
        @Get() findAll() { return this.service.findAll(); }
        @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }
        @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) { return this.service.update(id, dto); }
        @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
      }
      EOF
      \`\`\`
  
  7.  **Finalización:** \`npx prisma format && npx prisma generate\`.
  
  **Formato de Salida:**
  ÚNICAMENTE el código Bash. Escribe los nombres reales para cada clase.
  
  **Diagrama PlantUML:**
  \`\`\`plantuml
  ${plantUMLCode}
  \`\`\`
  `;
  }



/**
 * Genera el prompt para crear un script batch (Windows)
 * Incluye lógica robusta para preservación de PATH y detección de herramientas.
 */
function generateBatchPrompt(plantUMLCode) {
  return `
**Rol:** Eres un desarrollador backend senior experto en NestJS, Prisma ORM, arquitectura de software y un maestro en scripting de Windows (batch/cmd).
**Tarea:** A partir del siguiente diagrama de clases de PlantUML, genera un **único script de batch (.bat)** que cree un proyecto NestJS completo con Prisma ORM configurado, incluyendo toda la estructura de carpetas y archivos con su contenido, permitiendo persistencia inmediata en cada clase.
**⚠️ CRÍTICO - Nombres de Entidades:** El script generado DEBE usar los nombres REALES de las entidades del diagrama PlantUML en TODO el código TypeScript. NUNCA uses variables de plantilla como \`\${module}\`, \`\${module^}\`, \`\${entity}\`, \`\${Entity}\` o similares en el código TypeScript generado. Estas variables son INVALIDAS y causarán errores de compilación. Por ejemplo, si el diagrama tiene una clase "Temas", usa "Temas" directamente en las clases TypeScript, "temas" en los modelos Prisma, y "temas" en las rutas de archivos.
**Requisitos del Script Batch:**
0.  **Configurar PATH y verificar npm/nest (CRÍTICO):** El script DEBE empezar configurando el PATH para incluir las rutas comunes de Node.js y npm en Windows. **IMPORTANTE:** El script debe SIEMPRE preservar el PATH heredado del proceso padre (que puede contener rutas importantes de Node.js/npm configuradas por el proceso que ejecuta el script, especialmente cuando se ejecuta desde Electron/Camunda Modeler) y luego agregar rutas adicionales como respaldo. El PATH heredado tiene prioridad. Luego verificar e instalar NestJS CLI si es necesario. Usa algo como:
    \`\`\`batch
    @echo off
    setlocal enabledelayedexpansion
    
    REM Preservar PATH heredado del proceso padre (importante cuando se ejecuta desde Electron/Camunda)
    set "ORIGINAL_PATH=%PATH%"
    
    REM Configurar PATH para incluir Node.js y npm en múltiples ubicaciones
    set "NODE_PATH=C:\\Program Files\\nodejs"
    if exist "C:\\Program Files (x86)\\nodejs" set "NODE_PATH=C:\\Program Files (x86)\\nodejs"
    set "PATH=%NODE_PATH%;%APPDATA%\\npm;%ORIGINAL_PATH%"
    
    REM Buscar npm en ubicaciones comunes
    set "NPM_FOUND=0"
    where npm >nul 2>&1
    if not errorlevel 1 set "NPM_FOUND=1"
    
    REM Si no se encontró, intentar ubicaciones comunes
    if !NPM_FOUND!==0 (
      if exist "C:\\Program Files\\nodejs\\npm.cmd" (
        set "PATH=C:\\Program Files\\nodejs;%PATH%"
        set "NPM_FOUND=1"
      ) else if exist "C:\\Program Files (x86)\\nodejs\\npm.cmd" (
        set "PATH=C:\\Program Files (x86)\\nodejs;%PATH%"
        set "NPM_FOUND=1"
      ) else if exist "%APPDATA%\\npm\\npm.cmd" (
        set "PATH=%APPDATA%\\npm;%PATH%"
        set "NPM_FOUND=1"
      )
    )
    
    REM Verificar que npm esté disponible después de todas las configuraciones
    where npm >nul 2>&1
    if errorlevel 1 (
      echo Error: npm no está disponible. Por favor instala Node.js y npm primero.
      echo PATH actual: %PATH%
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
    **CRÍTICO:** El orden debe ser: 1) \`npx prisma init\`, 2) configurar \`.env\`, 3) configurar \`prisma.config.ts\` (si existe), 4) configurar \`schema.prisma\`, 5) ejecutar comandos de Prisma usando SIEMPRE \`npx\` (ej: \`npx prisma migrate dev --name init\`, \`npx prisma generate\`). **IMPORTANTE:** NUNCA ejecutar comandos de Prisma sin el prefijo \`npx\`. NO ejecutar ningún comando de Prisma antes de tener el \`.env\` configurado y \`prisma.config.ts\` (si existe) configurado para cargar dotenv.
6.  **Configurar Prisma Schema:** El script debe crear/sobrescribir el archivo \`prisma\\schema.prisma\` con:
    - Configuración del generador de cliente Prisma
    - Configuración del datasource (SQLite por defecto, pero preparado para PostgreSQL/MySQL)
    - Modelos Prisma basados en TODAS las entidades del diagrama PlantUML, incluyendo:
      * Campos correspondientes a las propiedades de cada clase
      * Relaciones entre entidades (si existen en el diagrama)
      * Tipos de datos apropiados (String, Int, DateTime, Boolean, etc.)
      * Campos @id y @default para IDs auto-generados
      * Campos @createdAt y @updatedAt cuando sea apropiado
    **REGLA INTELLIGENTE DE CAMPOS (CRÍTICO):**
    - Si un campo se llama \`estado\` o \`status\`, debe ser \`String @default("ACTIVO")\`.
    - Si un campo se llama \`fecha_creacion\`, \`createdAt\`, \`fechaCreacion\`, \`created_at\`, etc., debe tener \`@default(now())\`.
    - Si un campo se llama \`fecha_modificacion\`, \`updatedAt\`, \`fechaModificacion\`, \`updated_at\`, etc., debe tener el atributo \`@updatedAt\`.
    - **IMPORTANTE:** Cualquier campo que NO sea el ID y NO sea obligatorio por lógica de negocio, debería ser opcional (\`?\`) o tener un \`@default\`, para evitar errores de tipos en el create.
    Ejemplo de modelo:
    \`\`\`prisma
    model Usuario {
      id        Int      @id @default(autoincrement())
      nombre    String
      email     String   @unique
      estado    String   @default("ACTIVO")
      createdAt DateTime @default(now())
      updatedAt DateTime @updatedAt
      telefono  String?  // Campo opcional
    }
    \`\`\`
7.  **Generar Prisma Client y Migraciones:** Después de configurar el schema, el script debe VERIFICAR que el archivo \`.env\` existe y tiene \`DATABASE_URL\`, y que \`prisma.config.ts\` (si existe) está configurado correctamente antes de ejecutar comandos de Prisma. **CRÍTICO:** TODOS los comandos de Prisma DEBEN usar el prefijo \`npx\` (ej: \`npx prisma migrate\`, \`npx prisma generate\`). NUNCA ejecutar \`prisma\` directamente sin \`npx\`:
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
    * **CRÍTICO - Nombres de Entidades:** El script DEBE usar los nombres REALES de las entidades del diagrama PlantUML, NO variables de plantilla. Por ejemplo, si el diagrama tiene una clase "Temas", el script debe usar:
      - Nombre de clase TypeScript: \`Temas\` (PascalCase)
      - Nombre de modelo Prisma: \`temas\` (camelCase, minúscula inicial)
      - Nombre de archivo: \`temas\` (kebab-case, minúscula)
      - Ruta de módulo: \`modules/temas\` (kebab-case)
      - NUNCA usar variables como \`\${module}\`, \`\${module^}\`, \`\${entity}\` o similares en el código TypeScript generado. Estos son INVALIDOS y causarán errores de compilación.
    * **DTOs:** Debe crear las carpetas \`dto\` (ej: \`if not exist "src\\modules\\temas\\dto" mkdir "src\\modules\\temas\\dto"\`) y escribir los archivos \`create-temas.dto.ts\` y \`update-temas.dto.ts\` con las propiedades del diagrama usando class-validator decorators (@IsString, @IsEmail, @IsOptional, etc.). Los nombres de las clases DTO deben ser: \`CreateTemasDto\` y \`UpdateTemasDto\` (usando el nombre real de la entidad en PascalCase).
    * **Servicios:** Debe **sobrescribir** el archivo \`*.service.ts\` generado por el CLI con la lógica CRUD completa usando PrismaService:
      - Inyectar PrismaService en el constructor
      - **CRÍTICO - Métodos de Clase:** Por cada método definido en la clase del diagrama PlantUML, debe haber un método CRUD correspondiente en el servicio. Si la clase tiene métodos como \`buscarPorNombre()\`, \`filtrarPorEstado()\`, etc., el servicio DEBE implementar estos métodos usando Prisma. Ejemplo: si hay un método \`buscarPorEmail()\` en la clase, el servicio debe tener \`findByEmail(email: string)\` que use \`this.prisma.temas.findFirst({ where: { email } })\`.
      - Implementar create() usando \`this.prisma.temas.create({ data: createDto })\` (usando el nombre real del modelo en camelCase)
      - Implementar findAll() usando \`this.prisma.temas.findMany()\`
      - Implementar findOne() usando \`this.prisma.temas.findUnique({ where: { id } })\` y lanzar NotFoundException si no existe: \`if (!item) throw new NotFoundException(\`Temas with ID \${id} not found\`);\` (usando el nombre real de la entidad)
      - Implementar update() usando \`this.prisma.temas.update({ where: { id }, data: updateDto })\` con manejo de errores usando try-catch
      - Implementar remove() usando \`this.prisma.temas.delete({ where: { id } })\` con manejo de errores usando try-catch
      - **CRÍTICO - Template Literals:** Al escribir código TypeScript dentro de bloques de texto en batch, los template literals (backticks \`\`\` y \${expresion}) deben escribirse LITERALMENTE sin escapar. Ejemplo CORRECTO: \`throw new NotFoundException(\`Temas with ID \${id} not found\`);\` - Ejemplo INCORRECTO: \`throw new NotFoundException(\\\`Temas with ID \\\${id} not found\\\`);\` - Los backticks y \${} NO deben tener barras invertidas de escape.
      - **CRÍTICO - NO Variables de Plantilla:** NUNCA usar variables de plantilla como \`\${module}\`, \`\${module^}\`, \`\${entity}\`, \`\${Entity}\` en el código TypeScript. Siempre usar los nombres reales de las entidades del diagrama PlantUML.
      - Manejar errores apropiadamente: importar \`NotFoundException\` de \`@nestjs/common\` y usar try-catch para capturar \`PrismaClientKnownRequestError\` de \`@prisma/client/runtime/library\`
    * **Controladores:** Debe **sobrescribir** el archivo \`*.controller.ts\` con todos los endpoints RESTful (@Post, @Get, @Patch, @Delete) que se conecten al servicio, usando ValidationPipe para validar DTOs. Usar nombres reales de entidades, NO variables de plantilla.
    * **Módulos:** Debe **sobrescribir** el archivo \`*.module.ts\` para asegurarse de que el controlador y el servicio estén correctamente importados. NO necesita importar PrismaModule porque es global. Usar nombres reales de entidades, NO variables de plantilla.
13. **Configurar ValidationPipe global:** El script debe actualizar \`src\\main.ts\` para incluir ValidationPipe globalmente:
    \`\`\`typescript
    import { ValidationPipe } from '@nestjs/common';
    app.useGlobalPipes(new ValidationPipe());
    \`\`\`
14. **Instalar class-validator y class-transformer:** El script debe instalar las dependencias necesarias para validación:
    \`\`\`batch
    call npm install class-validator class-transformer
    \`\`\`
15. **Comandos Finales de Prisma (CRÍTICO):** Al final del script, DESPUÉS de crear todos los archivos y módulos, el script DEBE ejecutar los siguientes comandos de Prisma para formatear y regenerar el cliente:
    \`\`\`batch
    REM Formatear el schema de Prisma
    call npx prisma format
    
    REM Regenerar el cliente de Prisma con los cambios finales
    call npx prisma generate
    \`\`\`
    **IMPORTANTE:** Estos comandos deben ejecutarse al FINAL del script, después de haber creado todos los archivos TypeScript, DTOs, servicios, controladores y módulos.
**IMPORTANTE:** - **CRÍTICO - Comandos Prisma:** TODOS los comandos de Prisma (init, migrate, generate, etc.) DEBEN usar el prefijo \`npx\`. NUNCA ejecutar \`prisma\` directamente. Ejemplos correctos: \`npx prisma init\`, \`npx prisma migrate dev --name init\`, \`npx prisma generate\`. Ejemplos INCORRECTOS: \`prisma init\`, \`prisma migrate\`, \`prisma generate\`.
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
 * Obtiene una respuesta de chat de OpenAI y retorna los tokens utilizados
 * @param {string} systemMessage - Mensaje del sistema (opcional, por defecto 'You are a helpful assistant.')
 * @param {string} userMessage - Mensaje del usuario
 * @param {string} model - Modelo a usar (opcional, por defecto 'gpt-3.5-turbo')
 * @returns {Promise<Object>} Objeto con la respuesta y el uso de tokens
 */
async function getChatCompletionAndTokens(systemMessage = 'You are a helpful assistant.', userMessage, model = 'gpt-4o') {
  try {
    logger.log('OpenAI Service: Iniciando solicitud de chat completion');
    
    if (!userMessage || userMessage.trim().length === 0) {
      throw new Error('El mensaje del usuario está vacío');
    }

    const openai = new OpenAI({
      apiKey: getApiKey(), // Ensure your API key is set in config.json
    });

    const completion = await openai.chat.completions.create({
      model: model, // Or your desired model like 'gpt-4o'
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ],
    });

    const responseContent = completion.choices[0].message.content;
    const tokenUsage = completion.usage;

    logger.log('OpenAI Service: Completación recibida exitosamente');
    logger.log(`Completion: ${responseContent.substring(0, 200)}...`);
    logger.log(`Token Usage: ${JSON.stringify(tokenUsage)}`);

    return {
      success: true,
      content: responseContent,
      usage: tokenUsage,
      model: model,
      choices: completion.choices
    };

  } catch (error) {
    const errorMessage = `Error getting chat completion: ${error.message}`;
    logger.log(errorMessage, 'ERROR');
    console.error('Error getting chat completion:', error);
    throw error;
  }
}

/**
 * Función principal para ejecutar el servicio OpenAI
 * @param {string} userMessage - Mensaje del usuario
 * @param {Object} options - Opciones adicionales (systemMessage, model)
 * @returns {Promise<Object>} Objeto con la respuesta y metadata
 */
async function run(userMessage, options = {}) {
  const logs = [];
  
  try {
    logger.log('OpenAI Service iniciado');
    logs.push('OpenAI Service iniciado');
    
    if (!userMessage || userMessage.trim().length === 0) {
      throw new Error('El mensaje del usuario está vacío');
    }
    
    const systemMessage = options.systemMessage || 'You are a helpful assistant.';
    // Nota: 'gpt-5' se mantiene como predeterminado por solicitud, aunque gpt-4o es el estándar actual.
    const model = options.model || 'gpt-4o';    
    logs.push(`Mensaje del usuario recibido: ${userMessage.length} caracteres`);
    logs.push(`Modelo: ${model}`);
    logger.log(`Generando respuesta con modelo: ${model}`);
    
    const result = await getChatCompletionAndTokens(systemMessage, userMessage, model);
    
    logs.push('Respuesta generada exitosamente');
    logs.push(`Tokens utilizados: ${JSON.stringify(result.usage)}`);
    
    return {
      success: true,
      content: result.content,
      usage: result.usage,
      model: result.model,
      logs: logs,
      metadata: {
        promptLength: userMessage.length,
        responseLength: result.content.length,
        timestamp: new Date().toISOString()
      }
    };
    
  } catch (error) {
    const errorMessage = `Error al obtener respuesta de OpenAI: ${error.message}`;
    logger.log(errorMessage, 'ERROR');
    logs.push(`ERROR: ${errorMessage}`);
    
    const errorWithLogs = new Error(errorMessage);
    errorWithLogs.logs = error.logs || logs;
    
    throw errorWithLogs;
  }
}

/**
 * Genera una corrección para un script que falló
 * @param {string} originalScript - El script original que falló
 * @param {string} errorOutput - La salida de error del script
 * @param {string} stdout - La salida estándar del script (si existe)
 * @param {string} scriptType - Tipo de script ('bash' o 'batch')
 * @param {string} plantUMLCode - El código PlantUML original
 * @param {number} attemptNumber - Número de intento de corrección (1, 2, 3...)
 * @returns {Promise<Object>} Objeto con el script corregido
 */
async function generateScriptCorrection(originalScript, errorOutput, stdout, scriptType, plantUMLCode, attemptNumber = 1) {
  try {
    logger.log(`Generando corrección para script ${scriptType} (intento ${attemptNumber})...`);
    
    const isWindows = scriptType === 'batch';
    const scriptLanguage = isWindows ? 'batch (.bat)' : 'bash (.sh)';
    
    const correctionPrompt = `
**Rol:** Eres un experto en debugging de scripts ${scriptLanguage} y generación de proyectos NestJS con Prisma.

**Contexto:** Se generó un script ${scriptLanguage} para crear un proyecto NestJS completo a partir de un diagrama PlantUML, pero el script falló al ejecutarse.

**Script Original (que falló):**
\`\`\`${isWindows ? 'batch' : 'bash'}
${originalScript.substring(0, 5000)}${originalScript.length > 5000 ? '\n... (script truncado por longitud)' : ''}
\`\`\`

**Error Encontrado:**
\`\`\`
${errorOutput.substring(0, 2000)}${errorOutput.length > 2000 ? '\n... (error truncado por longitud)' : ''}
\`\`\`

${stdout ? `**Salida del Script (antes del error):**
\`\`\`
${stdout.substring(0, 1000)}${stdout.length > 1000 ? '\n... (salida truncada por longitud)' : ''}
\`\`\`
` : ''}

**Diagrama PlantUML Original:**
\`\`\`plantuml
${plantUMLCode.substring(0, 2000)}${plantUMLCode.length > 2000 ? '\n... (diagrama truncado por longitud)' : ''}
\`\`\`

**Tarea:** Analiza el error y genera un script ${scriptLanguage} CORREGIDO que:
1. Solucione el error específico encontrado
2. Mantenga toda la funcionalidad correcta del script original
3. Siga todas las reglas y mejores prácticas establecidas
4. Use nombres reales de entidades (NO variables de plantilla)
5. Incluya todos los comandos necesarios (npx prisma format y npx prisma generate al final)

**Errores Comunes a Verificar:**
- Variables de plantilla no reemplazadas (ej: \`\${module}\`, \`\${module^}\`) → Reemplazar con nombres reales
- Comandos de Prisma sin prefijo \`npx\` → Agregar \`npx\`
- Tipos incorrectos (Date en lugar de DateTime) → Corregir a DateTime
- Campos sin defaults apropiados (estado, createdAt, updatedAt) → Agregar defaults
- Rutas de archivos incorrectas → Corregir rutas
- Sintaxis de bash/batch incorrecta → Corregir sintaxis

**Formato de Salida:**
Responde **únicamente** con el script ${scriptLanguage} corregido, comenzando con ${isWindows ? '\`@echo off\`' : '\`#!/bin/bash\`'} y nada más. No incluyas explicaciones, solo el código del script corregido.
`;

    const systemMessage = `You are an expert ${scriptLanguage} script debugger and NestJS/Prisma project generator. Your task is to fix broken scripts by identifying and correcting errors while maintaining all correct functionality.`;

    const result = await getChatCompletionAndTokens(
      systemMessage,
      correctionPrompt,
      'gpt-4o' // Usar gpt-4o para correcciones por su alta precisión
    );

    // Limpiar el script corregido (similar a como se hace en nestjs-generator.js)
    let correctedScript = result.content;
    
    if (isWindows) {
      correctedScript = correctedScript
        .replace(/^```batch\n?/i, '')
        .replace(/^```cmd\n?/i, '')
        .replace(/^```bat\n?/i, '')
        .replace(/^```\n?/, '')
        .replace(/\n```$/, '')
        .replace(/\n```batch$/i, '')
        .replace(/\n```cmd$/i, '')
        .replace(/\n```bat$/i, '')
        .trim();
      
      if (!correctedScript.toLowerCase().includes('@echo off') && !correctedScript.toLowerCase().includes('@echo')) {
        correctedScript = '@echo off\nsetlocal enabledelayedexpansion\n\n' + correctedScript;
      }
    } else {
      correctedScript = correctedScript
        .replace(/^```bash\n?/i, '')
        .replace(/^```sh\n?/i, '')
        .replace(/^```\n?/, '')
        .replace(/\n```$/, '')
        .replace(/\n```bash$/, '')
        .replace(/\n```sh$/, '')
        .trim();
      
      if (!correctedScript.startsWith('#!/bin/bash') && !correctedScript.startsWith('#!/bin/sh')) {
        correctedScript = '#!/bin/bash\n\n' + correctedScript;
      }
    }

    logger.log(`Script corregido generado: ${correctedScript.length} caracteres`);
    
    return {
      success: true,
      correctedScript: correctedScript,
      usage: result.usage,
      attemptNumber: attemptNumber
    };

  } catch (error) {
    const errorMessage = `Error al generar corrección del script: ${error.message}`;
    logger.log(errorMessage, 'ERROR');
    throw error;
  }
}

module.exports = {
  run,
  getChatCompletionAndTokens,
  generateBashPrompt,
  generateBatchPrompt,
  generateScriptCorrection
};