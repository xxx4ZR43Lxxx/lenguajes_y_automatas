# Analizador léxico y sintáctico de noEsPython:(

Aplicación Vue 3 + TypeScript que analiza el lenguaje de programación noEsPython:(. El núcleo no depende de Vue: el AFD se usa con `analyzeSource(source)` o `createFiniteAutomaton(source)`; el parser recibe los tokens y la tabla léxica con `parseTokens(tokens, symbolTable)`. Las cuentas, programas y bitácoras se guardan en SQLite en el servidor.

## Ejecutar con Docker

```bash
docker compose up --build
```

Abre [http://localhost:8080](http://localhost:8080). `docker compose down` detiene el servicio y conserva los datos. El volumen `sqlite_data` contiene la base `/data/analizador.sqlite`; al reconstruir la imagen se mantienen los usuarios, programas y logs.

Si usaste la versión anterior en `http://localhost:5173` o `http://localhost:8080`, abre esa misma dirección con la nueva versión e inicia sesión con el mismo usuario. La aplicación intentará migrar sus datos de IndexedDB y su borrador local a SQLite; también puedes pulsar **Migrar datos anteriores**. La migración conserva los datos originales del navegador y no duplica los registros ya importados. El puerto 5173 y el 8080 apuntan al mismo servidor y a la misma base; después puedes continuar en el 8080. Debes usar exactamente el mismo nombre de host que usabas antes (por ejemplo, `localhost` o `127.0.0.1`), ya que el almacenamiento del navegador se separa por origen.

Si Docker indica que el puerto 8080 o 5173 está ocupado, detén el servicio anterior que usa ese puerto o cambia el número a la izquierda de `:` en `docker-compose.yml`. Para importar IndexedDB desde la versión anterior hay que abrir la nueva versión en el mismo puerto y host que se usaban antes; cambiar ese puerto impedirá que el navegador vea los datos antiguos.

Si prefieres conservar los servicios que ya ocupan esos puertos, inicia el analizador en otros dos puertos sin editar archivos:

```bash
APP_PORT=18080 LEGACY_PORT=15173 docker compose up --build
```

En ese caso abre [http://localhost:18080](http://localhost:18080). La base SQLite se conserva en el mismo volumen; los datos antiguos de IndexedDB solo podrán migrarse cuando abras temporalmente la nueva versión en el origen anterior.

## Desarrollo local

Requiere Node.js 24. Tras `npm install`, abre dos terminales:

```bash
npm run server
```

```bash
npm run dev
```

Abre la dirección que indique Vite, normalmente [http://localhost:5173](http://localhost:5173). El servidor API escucha en el puerto 8080 y Vite le envía las solicitudes `/api`. En este modo la base local está en `data/analizador.sqlite`. Para ejecutar las pruebas del analizador: `npm test`; para las de API y SQLite: `npm run test:server`; para medir cobertura del analizador: `npm run test:coverage`.

## Arquitectura

`src/core` contiene el dominio: autómata, tokens, parser, AST, errores, comentarios y eventos. `src/components` representa resultados; Pinia solo mantiene estado de interfaz y debugger.

El autómata determinista está implementado explícitamente mediante estados y transiciones de un carácter en `src/core/automaton/FiniteAutomaton.ts`. No utiliza expresiones regulares, clases `Lexer`/`Scanner`, analizadores preconstruidos ni dependencias externas. La suscripción a eventos mantiene el depurador sincronizado.

El analizador sintáctico toma los tokens del AFD y valida su orden jerárquico conforme a la gramática. Mientras el léxico transforma una secuencia lineal de caracteres en tokens, el parser construye un Árbol Sintáctico Abstracto (AST) de sentencias, bloques y expresiones. Sus errores indican discrepancias —qué token se esperaba y cuál se encontró— o fin de entrada prematuro; el modo pánico se sincroniza en `;` o en el inicio de la siguiente sentencia para informar más de un problema por análisis.

## Lenguaje

La referencia detallada de palabras reservadas, sintaxis, operadores, comentarios, ejemplos y errores está en la [Guía completa del lenguaje](docs/guia-del-lenguaje.md).

El [guion de demostración de la Actividad 1](docs/actividad-1.md) reúne un programa sin errores, casos semánticos y los ejemplos de rangos y asignación paralela.

La publicación se escribe solo con `impresora`; las lecturas se escriben `chismea`, `atrapa`, `pregunta` o `dameDatos`. Los nombres anteriores `print`, `sout`, `get`, `input` y `scanf` ya no son instrucciones reservadas. Los nombres integrados principales están en español: `seno`, `coseno`, `tangente`, `logaritmo`, `raiz_cuadrada`, `valor_absoluto`, `potencia`, `longitud`, `secuencia`, `sumatoria`, `maximo`, `minimo`, `ordenar`, `redondear`, `transformar` y `filtrar`.

Los operadores aritméticos son `mas`, `menos`, `por`, `entre`, `entre_entero`, `modulo` y sus símbolos; los lógicos son `y`, `o`, `no`. Para comparar se usan `(-)` y `(+)`, mayor o igual `=(+)`, menor o igual `=(-)` e igualdad `==>`. La asignación sigue siendo `=`. Los comentarios de una línea pueden comenzar con `//`, `\\` o `#`; `%` es el operador módulo. También se mantienen los delimitadores históricos `:) ... :(`. Los textos **siempre** empiezan y terminan con tres puntos: `...Hola...`; pueden ocupar varias líneas y `......` es un texto vacío.

Ejemplo de la sintaxis actual:

```text
guarda edad = 20;
fijo limite = 18;
si (edad (+) limite) {
  guarda aviso = ...Es mayor...;
} sino {
  guarda aviso = ...Es menor...;
}

bucle_por (guarda i = 0; i (-) 3; i = i + 1) {
  guarda doble = i + i;
}

bucle_mientras (edad (-) 21) {
  edad = edad + 1;
}

tarea sumar(a: entero, b: entero): entero {
  resultado mas(a, b);
}
guarda total = sumar(4)(6);
impresora(...Resultado..., total);

guarda x: rango = [1,...,5];
x = x * 3 + 1;
par { edad = limite, limite = edad; }
```

El parser y el intérprete también incluyen valores `verdadero`, `falso` y `nulo`; listas, tuplas, conjuntos, diccionarios, indexación, pertenencia y comprensiones; `para_cada`, `salir`, `continuar`, `afirmar`, asignaciones compuestas, conversión y funciones integradas de colecciones; manejo de errores con `intentar`/`capturar`/`finalmente`/`lanzar`; selección `seleccionar/caso`; y módulos integrados `matematicas`, `colecciones`, `iteracion` y `archivos`. La entrada/salida de archivos opera en memoria. Consulta la guía para ejemplos y limitaciones concretas. El botón **Analizar y ejecutar** ejecuta el árbol después del análisis y muestra salida, valores finales y errores con línea/columna. El tamaño máximo de entrada es 100,000 caracteres; se envía al servidor para conservar versiones y registros de análisis.

Los programas creados antes del cambio de sintaxis siguen guardados en SQLite y en la galería. Al cargarlos pueden mostrar errores por `¿`, comillas o nombres anteriores como `simera`; hay que reescribirlos manualmente. La aplicación no los modifica ni elimina de forma automática.

## Tarea 2.4: cuentas, base de datos y logs

La aplicación exige una sesión antes de acceder al editor. Puedes crear más usuarios desde **Crear cuenta**. Para probarla de inmediato, incluye dos cuentas de demostración, cada una con una galería y bitácora aisladas:

| Usuario | Contraseña | Galería |
| --- | --- | --- |
| `ana` | `1234` | Ana Torres |
| `luis` | `1234` | Luis Pérez |

La persistencia se implementa con **SQLite** en el servidor. Cada usuario nuevo queda en la misma base y conserva su propia galería y bitácora. Las contraseñas se guardan como hash y la sesión se administra mediante una cookie. Los datos se comparten entre navegadores que utilicen esta instalación del servidor.

Cada análisis guarda una versión del código probado con tokens, AST, errores y sugerencias para el usuario activo. También se puede asignar un nombre y guardarlo manualmente, cargarlo desde *Mi galería de códigos* o importar un archivo `.txt` / `.json` (este último con un campo `source`).

El historial al estilo GitHub muestra cada evento en orden cronológico con actor, fecha, tipo y detalle. Cada edición del editor conserva el código anterior y nuevo, el fragmento añadido o retirado y su posición. También registra inicio/cierre de sesión, análisis léxico/sintáctico/semántico, sugerencias, aplicación de correcciones, pasos del depurador, guardado, carga, restauración, importación y exportación. Puede buscarse, filtrarse por tipo, recorrer sus páginas, restaurar cualquier versión con código y descargarse completo en JSON. Al reabrir la sesión se recupera el borrador más reciente de esa cuenta.

**Sobre el error anterior:** `Failed to execute 'put' on 'IDBObjectStore': #<Object> could not be cloned` ocurría al intentar guardar un objeto reactivo de Vue en IndexedDB, cuyo mecanismo de clonación no admite esos proxies. La aplicación ahora envía datos serializables a la API y los guarda en SQLite, por lo que esa operación `put` ya no forma parte del flujo.

El análisis semántico revisa alcance, variables y funciones no usadas, código inalcanzable, overflow int32, incompatibilidad de tipos, condiciones, aridad, tipos de argumentos y retornos, clases, rangos y bloques paralelos. Las anotaciones `entero`, `real`, `texto`, `booleano` y `rango` activan comprobaciones estáticas; sin anotación, el intérprete conserva comprobación dinámica. El checkbox Mostrar warnings viene activado y permite ocultar los warnings; Flexible muestra warnings sin bloquear y Estricto bloquea ante errores o warnings visibles. Las tareas se pueden sobrecargar por cantidad de parámetros. Las sugerencias son heurísticas, no generadas por IA.

La guía y los casos para exponer la actividad están en [docs/actividad-1.md](docs/actividad-1.md).

Para pronunciar el nombre extra: **“ele-equis-ese-ene-te-ese-eme-ene-te-pe-te-pe-erre-ele”**.
