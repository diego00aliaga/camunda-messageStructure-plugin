# Solución para Persistencia de Datos en Plugin BPMN

## Problema Identificado

Los datos de la estructura de mensajes no se estaban persistiendo correctamente en el XML del archivo BPMN, lo que causaba que los datos desaparecieran al reiniciar Camunda Modeler.

## Causa Raíz

El problema principal era que aunque los datos se guardaban correctamente en el modelo BPMN en memoria, no se disparaban los eventos correctos para que Camunda Modeler reconociera que el modelo había cambiado y necesitaba ser guardado en el archivo XML.

## Soluciones Implementadas

### 1. Eventos de Persistencia Mejorados

Se agregaron múltiples eventos para asegurar que los datos se persistan:

```javascript
// Eventos adicionales para asegurar la persistencia
eventBus.fire('element.changed', { element: element });
eventBus.fire('elements.changed', { elements: [element] });

// Forzar la actualización del modelo
if (element.businessObject && element.businessObject.$model) {
  element.businessObject.$model.emit('element.changed', { element: element });
}
```

### 2. Auto-Guardado en Tiempo Real

Se implementó auto-guardado automático cuando:
- Se agrega un nuevo campo
- Se elimina un campo
- Se modifican los valores de los campos
- Se cambia la selección de elementos

### 3. Listeners Globales para Eventos de Guardado

Se agregaron listeners para múltiples eventos:

- `file.saved`: Cuando se guarda el archivo
- `model.changed`: Cuando cambia el modelo
- `elements.changed`: Cuando cambian los elementos
- `selection.changed`: Cuando cambia la selección
- `keyboard.keydown`: Para detectar Ctrl+S

### 4. Funciones Globales de Persistencia

Se crearon funciones globales que pueden ser accedidas desde cualquier parte del plugin:

- `globalSerializeFieldsToJSON()`: Serializa los campos a JSON
- `globalSaveFieldsToBPMN()`: Guarda los datos en el modelo BPMN

### 5. Verificación de Datos

Se agregó verificación automática después del guardado para confirmar que los datos se persistieron correctamente.

## Archivos Modificados

- `client/client-bundle.js`: Agregadas funciones de persistencia y listeners de eventos

## Cómo Funciona Ahora

1. **Auto-Guardado**: Los datos se guardan automáticamente cada vez que se modifica un campo
2. **Persistencia en Guardado**: Cuando se guarda el archivo (Ctrl+S), se asegura que todos los datos estén persistidos
3. **Verificación**: Se verifica que los datos se hayan guardado correctamente
4. **Recuperación**: Los datos se cargan automáticamente al abrir el archivo

## Pruebas Recomendadas

1. Agregar campos de datos y verificar que se guarden automáticamente
2. Guardar el archivo (Ctrl+S) y verificar que los datos persistan
3. Cerrar y abrir Camunda Modeler
4. Abrir el archivo y verificar que los datos estén presentes
5. Verificar en el XML del archivo que los datos estén incluidos

## Notas Importantes

- Los datos se guardan en `bpmn:Documentation` dentro de `extensionElements`
- El formato de los datos es: `dataFields:{"unique":"10","identifier":"...",...}`
- Los eventos se disparan múltiples veces para asegurar la persistencia
- Se incluyen delays para evitar conflictos de timing 