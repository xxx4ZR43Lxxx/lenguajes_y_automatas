# Prompt para generar la presentación PPTX: LOLCODE

## Instrucción para el generador de presentaciones

Genera una presentación **PPTX en español**, de **13 diapositivas**, titulada **«LOLCODE: programar hablando como un lolcat»**. Debe estar lista para una exposición académica de 8 a 10 minutos en la materia de Lenguajes y Autómatas. El autor que debe aparecer en portada y pie de página es **Elias Ruiz Hernandez**. No inventes comandos, resultados de ejecución, fechas ni capacidades del intérprete.

La presentación explica un lenguaje de programación esotérico y debe cubrir explícitamente: qué es LOLCODE, sus funciones principales, ejemplos de código con su salida, que para comprender la exposición no se requiere instalar nada, y el diseño de un intérprete corto en Python que soporte solo unas pocas instrucciones. El PPTX es la evidencia principal; no afirmar que se implementó un compilador o un intérprete completo del estándar.

## Estilo visual obligatorio

- Formato panorámico 16:9. Fondo azul marino muy oscuro `#101827`; color de superficie `#18243A`; texto principal blanco cálido `#F8FAFC`; texto secundario `#CBD5E1`; acento cian `#22D3EE`; acento coral `#FB7185`; acento amarillo `#FACC15`.
- Tipografía: títulos **Montserrat ExtraBold** (o Aptos Display Bold si no está disponible); cuerpo **Aptos/Calibri**; código **Cascadia Mono** o **Consolas**. Nunca usar Comic Sans.
- Estética: retro-terminal + meme de gatos, sobria y legible. Usar esquinas redondeadas, sombras muy sutiles y líneas finas color cian. Máximo 35 palabras fuera de los bloques de código por diapositiva.
- Todo el código debe ir en tarjetas oscuras `#0B1220`, con fuente monoespaciada de mínimo 20 pt y resaltado: palabras clave en cian, cadenas en amarillo, comentarios en gris.
- Usar únicamente los iconos indicados como símbolos vectoriales simples/emoji: `😺`, `💬`, `▶`, `🧩`, `⇄`, `⚙`, `✓`, `⚠`, `📚`. No usar fotografías ni logotipos de terceros. El gato se representa como silueta vectorial o emoji, no con una imagen externa.
- En todas las diapositivas excepto portada, incluir un pie discreto: `Elias Ruiz Hernandez · Lenguajes y Autómatas` a la izquierda y el número de diapositiva a la derecha. No poner transiciones llamativas; solo aparición suave de bloques de contenido.

## Contenido exacto por diapositiva

### 1. Portada

**Texto exacto:**

```text
LOLCODE
Programar hablando como un lolcat

Lenguaje de programación esotérico
Elias Ruiz Hernandez
Lenguajes y Autómatas
```

**Composición:** título grande a la izquierda; a la derecha, una silueta vectorial de gato sentado con un cursor de terminal `>_` en cian. Colocar un pequeño `😺` junto a “lolcat”. Fondo con cuadrícula de terminal muy tenue. No añadir fecha ni logos.

### 2. ¿Qué es un lenguaje esotérico?

**Texto exacto:**

```text
Un lenguaje esotérico (esolang) se crea principalmente para explorar ideas,
hacer humor, arte o retos de programación; no para uso industrial.

LOLCODE conserva conceptos reales de programación, pero usa la forma de
escritura de los memes “lolcat”.
```

**Tres etiquetas, en este orden:** `Experimentación`, `Humor`, `Aprendizaje`.

**Composición:** tarjeta principal de texto a la izquierda y tres chips con los iconos `🧩`, `😺`, `💬` a la derecha. No afirmar que todos los esolangs son inútiles.

### 3. Origen y propósito de LOLCODE

**Texto exacto:**

```text
Creado por Adam Lindsay en 2007.
Se inspira en el “lolspeak”: la escritura intencionalmente incorrecta
asociada con los memes de gatos de Internet.

Su especificación más citada es LOLCODE 1.2.
Propósito: diversión y experimentación con la sintaxis, no desarrollo de producción.
```

**Composición:** línea de tiempo horizontal minimalista: `2007 → LOLCODE → LOLCODE 1.2`. Icono `😺` al inicio y `📚` al final. Añadir nota pequeña: `“especificación” describe la sintaxis; las implementaciones pueden variar`.

### 4. Estructura mínima de un programa

**Texto visible encima del código:** `Todo programa se abre con HAI y termina con KTHXBYE.`

**Código exacto:**

```lolcode
HAI 1.2
  VISIBLE "HAI WORLD!"
KTHXBYE
```

**Caja de explicación exacta:**

```text
HAI 1.2    inicia el programa e indica la versión
VISIBLE    escribe en la salida estándar
KTHXBYE    finaliza el programa
```

**Salida exacta:** `HAI WORLD!`

**Composición:** código a la izquierda y a la derecha un panel “Resultado” con icono `▶`. Resaltar HAI y KTHXBYE con una línea cian que los conecte como delimitadores del bloque.

### 5. Datos, variables y salida

**Texto exacto:**

```text
I HAS A declara una variable.
ITZ asigna su valor inicial.
R reasigna un valor.
VISIBLE muestra valores o texto.
```

**Código exacto:**

```lolcode
HAI 1.2
  I HAS A NAME ITZ "Elias"
  NAME R "Ruiz"
  VISIBLE NAME
KTHXBYE
```

**Salida exacta:** `Ruiz`

**Composición:** dos columnas; a la izquierda el código y a la derecha una flecha `⇄` que conecte una tarjeta “variable NAME” con las etiquetas `"Elias"` y luego `"Ruiz"`. Usar un solo icono `🧩` junto al título.

### 6. Operadores y expresiones

**Texto exacto:**

```text
SUM OF A AN B suma.
DIFF OF A AN B resta.
PRODUKT OF A AN B multiplica.
QUOSHUNT OF A AN B divide.
BOTH SAEM A AN B compara igualdad.
```

**Código exacto:**

```lolcode
HAI 1.2
  I HAS A TOTAL ITZ SUM OF 7 AN 5
  VISIBLE TOTAL
KTHXBYE
```

**Salida exacta:** `12`

**Composición:** arriba, cinco chips de operador en una tabla de una fila; abajo, código y salida. No presentar `AN` como operador: es el separador entre operandos en estas expresiones.

### 7. Decisiones: O RLY?

**Texto exacto:**

```text
Una expresión produce WIN o FAIL.
O RLY? abre una decisión; YA RLY es la rama verdadera,
NO WAI la rama falsa y OIC la cierra.
```

**Código exacto:**

```lolcode
HAI 1.2
  I HAS A AGE ITZ 20
  BOTH SAEM AGE AN 20, O RLY?
    YA RLY
      VISIBLE "TIENES 20"
    NO WAI
      VISIBLE "OTRA EDAD"
  OIC
KTHXBYE
```

**Salida exacta:** `TIENES 20`

**Composición:** código a la izquierda; diagrama de rombo a la derecha con `BOTH SAEM AGE AN 20` → `WIN` → `YA RLY` y `FAIL` → `NO WAI`. Icono `✓` en WIN y `⚠` en FAIL. Mantener las palabras LOLCODE sin traducir dentro del diagrama.

### 8. Repetición: un ciclo contado

**Texto exacto:**

```text
IM IN YR inicia un ciclo etiquetado.
UPPIN YR incrementa la variable.
TIL repite mientras la condición sea FAIL; termina al ser WIN.
IM OUTTA YR cierra el ciclo.
```

**Código exacto:**

```lolcode
HAI 1.2
  I HAS A COUNT ITZ 0
  IM IN YR LOOP UPPIN YR COUNT TIL BOTH SAEM COUNT AN 3
    VISIBLE COUNT
  IM OUTTA YR LOOP
KTHXBYE
```

**Salida exacta, en líneas separadas:**

```text
0
1
2
```

**Composición:** código a la izquierda; a la derecha, flecha circular `↻` formada por tres nodos `0`, `1`, `2`, seguido de un nodo gris `3 → termina`. No decir que imprime 3: el cuerpo se ejecuta antes de incrementar y de volver a comprobar la condición.

### 9. Comentarios y entrada

**Texto exacto:**

```text
BTW inicia un comentario de una línea.
OBTW y TLDR delimitan un comentario de varias líneas.
GIMMEH lee entrada y la guarda como texto (YARN).
```

**Código exacto:**

```lolcode
HAI 1.2
  BTW saludo para la persona usuaria
  I HAS A NAME
  GIMMEH NAME
  VISIBLE "HAI " NAME
KTHXBYE
```

**Interacción exacta:**

```text
Entrada: Ana
Salida:  HAI Ana
```

**Composición:** una tarjeta de código y debajo dos globos `💬`: uno de entrada y otro de salida. Marcar la línea BTW en gris como comentario.

### 10. Sin instalación para la demostración

**Texto exacto:**

```text
Para comprender los ejemplos de esta exposición no es necesario instalar LOLCODE.
El código, su análisis y sus salidas se muestran directamente en las diapositivas.

Para ejecutar programas completos fuera de la exposición sí se necesita una
implementación o intérprete compatible con LOLCODE.
```

**Composición:** dos tarjetas equilibradas. Izquierda: icono `✓` y título `Exposición`, texto `Sin instalación`. Derecha: icono `⚙` y título `Ejecución real`, texto `Requiere una implementación`. No nombrar una herramienta específica ni incluir enlaces de descarga.

### 11. Intérprete corto en Python: alcance

**Texto exacto:**

```text
Propuesta: un intérprete educativo, no una implementación completa de LOLCODE.

Soporta: HAI/KTHXBYE, I HAS A ... ITZ ..., variable R valor y VISIBLE.
No soporta: operaciones, condicionales, ciclos, funciones, tipos completos ni errores del estándar.
```

**Composición:** diagrama de cuatro etapas con iconos: `Código LOLCODE` `→` `tokenización simple` `→` `variables (diccionario)` `→` `salida`. Sobre las dos últimas usar `⚙` y `▶`. Debajo, una franja coral `Alcance deliberadamente limitado`.

### 12. Intérprete corto en Python: código y prueba

**Texto previo exacto:** `El intérprete reconoce instrucciones por patrones de texto y guarda las variables en un diccionario.`

**Código Python exacto (debe caber legible; no omitir líneas):**

```python
def run(source):
    variables = {}
    for line in source.splitlines():
        line = line.strip()
        if line.startswith("I HAS A "):
            name, value = line[8:].split(" ITZ ", 1)
            variables[name] = value.strip('"')
        elif " R " in line:
            name, value = line.split(" R ", 1)
            variables[name] = value.strip('"')
        elif line.startswith("VISIBLE "):
            value = line[8:].strip('"')
            print(variables.get(value, value))
```

**Prueba exacta:** usar el programa de la diapositiva 5. **Salida exacta:** `Ruiz`.

**Composición:** código Python a la izquierda; panel de prueba a la derecha con `LOLCODE de entrada → run(source) → Ruiz`. Aclaración pequeña obligatoria: `Es un intérprete parcial; no valida toda la sintaxis de LOLCODE 1.2.`

### 13. Conclusiones y fuentes

**Conclusiones, texto exacto:**

```text
LOLCODE demuestra que un lenguaje puede ser válido y ejecutable aunque su sintaxis sea humorística.
Permite practicar variables, expresiones, decisiones, ciclos y el diseño de intérpretes.
Su valor principal es educativo y experimental, no la productividad industrial.
```

**Fuentes, texto exacto (en tamaño menor pero legible):**

```text
LOLCODE Specification 1.2 — github.com/justinmeza/lolcode-spec
Adam Lindsay, LOLCODE (2007) — lolcode.com
Documentación de referencia: cmput415.github.io/415-docs/lolcode/
```

**Cierre visual:** icono `😺` seguido de `KTHXBYE`. Añadir debajo, pequeño: `Gracias`. No usar una diapositiva adicional de preguntas.

## Revisión final obligatoria

- Verificar que hay exactamente 13 diapositivas y que cada ejemplo contiene `HAI 1.2` y `KTHXBYE` cuando corresponde.
- Verificar visualmente las salidas: `HAI WORLD!`, `Ruiz`, `12`, `TIENES 20`, `0 / 1 / 2` y `HAI Ana`.
- Mantener los términos del lenguaje en mayúsculas y monoespaciados: `HAI`, `KTHXBYE`, `VISIBLE`, `I HAS A`, `ITZ`, `R`, `O RLY?`, `YA RLY`, `NO WAI`, `OIC`, `IM IN YR`, `IM OUTTA YR`, `UPPIN YR`, `TIL`, `BTW`, `OBTW`, `TLDR`, `GIMMEH`.
- No insertar imágenes generadas, fotografías, contenido de relleno, notas del presentador, ni diapositivas extras.
