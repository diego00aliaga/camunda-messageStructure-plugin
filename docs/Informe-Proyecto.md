## Informe del Proyecto: BPMN Message Structure Plugin y Generación de Backend NestJS

### Propósito y visión

Este proyecto extiende Camunda Modeler con un plugin que permite:

- Extraer estructuras de mensaje definidas en elementos BPMN y persistidas en el XML.
- Derivar un diagrama de clases UML (PlantUML) aplicando reglas sistemáticas desde BPMN.
- Generar automáticamente un esqueleto backend NestJS por capas, listo para evolucionar.

Resultado: acelerar el paso del modelado de procesos al backend ejecutable, preservando el lenguaje de dominio y reduciendo pérdidas de información.


## Alcance y entregables

- Integración con Camunda Modeler vía menú “Generar Código”.
- Pipeline end‑to‑end: BPMN XML → PlantUML → proyecto NestJS.
- Esqueleto NestJS modular con controladores, servicios y DTOs por entidad.
- Diálogos HTML integrados para feedback (progreso, éxito y errores).
- Registro de logs del proceso completo.


## Flujo funcional end‑to‑end

1. El usuario presiona “Generar Código” en el Modeler.
2. El plugin obtiene el XML del diagrama activo y extrae estructuras de datos desde `<bpmn:documentation>`.
3. Se manda el contenido a la API (Gemini) con un prompt especializado que aplica reglas R1–R26 para derivar un diagrama de clases en PlantUML.
4. Se muestra el PlantUML generado; el usuario confirma la generación de código.
5. Se solicita un directorio de salida y se genera un script (bash o batch) que:
   - Verifica/instala Nest CLI.
   - Crea un proyecto Nest (`nest new`).
   - Genera módulos, controladores y servicios por entidad.
   - Crea DTOs de creación/actualización.
   - Sobrescribe archivos con contenido completo (CRUD base y wiring).
6. El script se guarda, se marca como ejecutable (Unix), se ejecuta y se muestran logs/resultados.


## Derivación del modelo: de BPMN a PlantUML

El servicio de derivación construye un prompt que:

- Indica cómo extraer estructuras de mensaje desde el XML de BPMN.
- Establece el orden de procesamiento según el flujo de secuencia (R3).
- Aplica reglas de derivación R1–R26 para:
  - Crear/Extender clases (R4, R5, R23–R25).
  - Derivar atributos, identificadores y tipos (R6–R12).
  - Generar relaciones por anidación y referencias, con cardinalidades (R13–R17).
  - Definir servicios de creación/actualización (R18–R21, R25).
  - Validar conectividad del grafo de clases.

Salida: un único diagrama consolidado en sintaxis PlantUML (`@startuml` … `@enduml`) que representa el modelo de dominio derivado.


## Generación del esqueleto backend NestJS

El generador construye un script auto‑contenible (bash para macOS/Linux o batch para Windows) que:

- Configura PATH y verifica `npm`/`nest` (instala Nest CLI si falta).
- Crea el proyecto Nest base (`nest new ...`).
- Por cada entidad del PlantUML:
  - `nest g module`, `nest g controller --no-spec`, `nest g service --no-spec`.
  - Crea carpeta `dto/` con `create-*.dto.ts` y `update-*.dto.ts` (propiedades derivadas).
  - Sobrescribe `*.service.ts` con CRUD (create, findAll, findOne, update, remove).
  - Sobrescribe `*.controller.ts` con endpoints REST completos (POST/GET/PATCH/DELETE).
  - Ajusta `*.module.ts` para asegurar la importación correcta de controlador y servicio.

El plugin guarda este script en el directorio seleccionado, le otorga permisos (Unix) y lo ejecuta con un PATH mejorado para robustez, capturando `stdout`/`stderr` y registrando todo el proceso.


## Diseño por capas del backend generado (arquitectura)

El esqueleto sigue una arquitectura modular por capas, alineada con buenas prácticas de NestJS:

- Capa de presentación (Interfaces/Controllers)
  - Controladores REST por entidad.
  - Endpoints CRUD: POST, GET (lista y por id), PATCH, DELETE.
  - DTOs para validar/estructurar payloads de entrada.

- Capa de aplicación (Services/Use‑cases)
  - Servicios con operaciones de negocio inmediatas (create, findAll, findOne, update, remove).
  - Orquestación entre controladores y persistencia (cuando se integre).

- Capa de dominio (Modelo de negocio)
  - Las clases del PlantUML definen el lenguaje ubicuo: nombres, atributos y relaciones.
  - Los DTOs reflejan creación/actualización; pueden evolucionar con validadores/mappers.

- Capa de infraestructura (Módulos y extensiones)
  - Módulos Nest por entidad encapsulan wiring de controladores y servicios.
  - Punto natural para integrar ORM (TypeORM/Prisma), repositorios y mapeos.

- Cross‑cutting
  - DTOs por entidad y validaciones.
  - Logging del proceso de generación y utilidades.


## Interfaz de usuario (plugin)

- Diálogos HTML in‑app para progreso, éxito y errores, inyectados en `webContents`.
- Diseño con overlay, cierre por ESC/click y botones de acción (“Generar Código”, “Ver Logs”).
- Experiencia no bloqueante y con feedback continuo.


## Consideraciones de seguridad

- Externalizar y rotar las API keys (mover a variables de entorno/config segura; no versionar).
- Validar y sanear entradas si se agregan futuras interacciones con el usuario.
- Aislamiento de ejecución del script y revisión de permisos en sistemas Unix/Windows.


## Limitaciones actuales

- Dependencia de LLM para la derivación y la generación del script (determinismo limitado; mitigado con `temperature` baja).
- No incluye repositorios ni configuración de ORM por defecto (paso siguiente natural).
- Calidad dependiente de la completitud y consistencia de las estructuras de mensaje en BPMN.


## Próximos pasos recomendados

- Externalizar secretos y manejo de configuración con variables de entorno.
- Añadir capa de persistencia (TypeORM/Prisma), entidades reales y repositorios.
- Incorporar `class-validator`/`class-transformer` en DTOs.
- Generar pruebas unitarias y e2e por módulo.
- Plantillas parametrizadas (nomenclatura, rutas, pluralización, convenciones).
- Mapeo automático de relaciones PlantUML → ORM (1:N, N:M, cascadas/constraints).


## Uso operativo (resumen)

1. Abrir un diagrama BPMN en Camunda Modeler y definir/editar estructuras de mensaje.
2. Guardar el diagrama.
3. Menú “Generar Código”:
   - Revisar el PlantUML derivado.
   - Confirmar “Generar Código” y seleccionar carpeta de salida.
   - Esperar finalización; revisar resumen y, si se desea, los logs detallados.


## Impacto

- Reduce el tiempo de arranque del backend y los errores de traspaso desde BPMN.
- Estandariza un esqueleto NestJS modular, con DTOs y CRUD inicial por entidad.
- Mantiene el alineamiento entre procesos de negocio (BPMN) y modelo de dominio (UML/código).


## Créditos y licencia

- Autor: Diego Aliaga
- Licencia: MIT


