# Analizador Léxico y Sintáctico Interactivo

Aplicación Vue 3 + TypeScript que analiza localmente un lenguaje personalizado. El núcleo no depende de Vue: el AFD se usa con `analyzeSource(source)` o `createFiniteAutomaton(source)` y el parser con `parseTokens(tokens)`.

## Ejecutar

```bash
npm install
npm run dev
npm test
npm run test:coverage
```

Producción: `docker build -t lexer .` y `docker run -p 8080:80 lexer`. Desarrollo en Docker: `docker compose up` (puerto 5173).

## Arquitectura

`src/core` contiene el dominio: autómata, tokens, parser, AST, errores, comentarios y eventos. `src/components` representa resultados; Pinia solo mantiene estado de interfaz y debugger.

El autómata determinista está implementado explícitamente mediante estados y transiciones de un carácter en `src/core/automaton/FiniteAutomaton.ts`. No utiliza expresiones regulares, clases `Lexer`/`Scanner`, analizadores preconstruidos ni dependencias externas. La suscripción a eventos mantiene el depurador sincronizado.

El analizador sintáctico toma los tokens del AFD y valida su orden jerárquico conforme a la gramática. Mientras el léxico transforma una secuencia lineal de caracteres en tokens, el parser construye un Árbol Sintáctico Abstracto (AST) de sentencias, bloques y expresiones. Sus errores indican discrepancias —qué token se esperaba y cuál se encontró— o fin de entrada prematuro; el modo pánico se sincroniza en `;` o `¿` para informar más de un problema por análisis.

## Lenguaje

Soporta operadores matemáticos en español (`mas`, `menos`, `por`, `entre`), comparadores (`menor`, `mayor`, `igual`), enteros, flotantes con punto y dígitos completos, cadenas `¿... ?`, IP v4, y los tipos independientes `arreglo`, `vector`, `lista` y `matriz`. También reconoce notación funcional, aplica la ley de los signos y distingue pre/postdecremento con `menos menos`.

El parser descendente recursivo reconoce declaraciones (`¿ guarda` / `¿ fijo`), `simera` con rama `notons`, `recorre` y funciones `chamba` con parámetros y `regresa`. La interfaz ejecuta AFD y parser con un debounce de 280 ms, señala las líneas sintácticas erróneas, muestra sugerencias de corrección y permite desplegar el AST como JSON. La tabla muestra el estado final que aceptó cada token y los errores léxicos se presentan por separado. El tamaño máximo de entrada es 100,000 caracteres; no ejecuta nunca el código de entrada ni lo transmite fuera del navegador.
