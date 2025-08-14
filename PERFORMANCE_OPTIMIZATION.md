# Optimizaciones de Rendimiento - Plugin BPMN

## Problema Identificado

Después de implementar la persistencia de datos, Camunda Modeler se volvió muy lento debido a la frecuencia excesiva de auto-guardado y eventos.

## Optimizaciones Implementadas

### 1. Debounce en Auto-Guardado

Se implementó un sistema de debounce para evitar múltiples guardados simultáneos:

```javascript
// Función de debounce para optimizar el auto-guardado
var autoSaveTimeout;
function debouncedAutoSave() {
  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(function() {
    var json = serializeFieldsToJSON();
    saveFieldsToBPMN(json);
  }, 500); // Aumentado a 500ms para reducir la frecuencia
}
```

### 2. Optimización de Listeners Globales

Todos los listeners globales ahora usan debounce y solo procesan elementos con datos reales:

- **file.saved**: 200ms debounce
- **model.changed**: 300ms debounce  
- **elements.changed**: 300ms debounce
- **selection.changed**: 500ms debounce
- **keyboard.keydown**: 100ms debounce

### 3. Filtrado Inteligente

Los listeners ahora solo procesan elementos que realmente tienen datos:

```javascript
// Solo procesar si hay campos con datos
if ($fields.length > 0 && $fields.find('[data-row]').length > 0) {
  var json = globalSerializeFieldsToJSON(element, $fields);
  if (json && json.messageStructure && json.messageStructure.children.length > 0) {
    globalSaveFieldsToBPMN(element, json);
  }
}
```

### 4. Reducción de Verificaciones

La verificación de datos guardados ahora solo se ejecuta en modo debug y con delays más largos.

### 5. Optimización de Eventos Locales

Los eventos locales también usan debounce:

- **bpmn.element.changed**: 300ms debounce
- **Auto-guardado de campos**: 500ms debounce

## Beneficios de las Optimizaciones

### ✅ **Rendimiento Mejorado**
- Reducción significativa en la frecuencia de guardado
- Menos procesamiento de elementos sin datos
- Debounce evita múltiples ejecuciones simultáneas

### ✅ **Persistencia Mantenida**
- Los datos siguen guardándose correctamente
- La funcionalidad principal no se ve afectada
- Solo se optimizó la frecuencia, no la lógica

### ✅ **Experiencia de Usuario**
- Camunda Modeler responde más rápido
- Menos lag al escribir en los campos
- Interfaz más fluida

## Configuración de Tiempos

| Evento | Tiempo Anterior | Tiempo Actual | Razón |
|--------|----------------|---------------|-------|
| Auto-guardado campos | 100ms | 500ms | Reducir frecuencia |
| file.saved | Inmediato | 200ms | Evitar múltiples ejecuciones |
| model.changed | 100ms | 300ms | Reducir procesamiento |
| elements.changed | 100ms | 300ms | Optimizar cambios |
| selection.changed | 100ms | 500ms | Menos crítico |
| keyboard.keydown | 50ms | 100ms | Balance velocidad/confiabilidad |

## Monitoreo de Rendimiento

Para monitorear el rendimiento, puedes habilitar logs de debug:

```javascript
// En la consola del navegador
localStorage.setItem('debug', 'true');
```

## Recomendaciones Adicionales

1. **Si aún hay lentitud**: Aumentar los tiempos de debounce
2. **Si hay problemas de persistencia**: Reducir los tiempos de debounce
3. **Para desarrollo**: Usar tiempos más cortos para debugging
4. **Para producción**: Usar tiempos más largos para mejor rendimiento

## Archivos Modificados

- `client/client-bundle.js`: Todas las optimizaciones de rendimiento
- `PERFORMANCE_OPTIMIZATION.md`: Esta documentación 