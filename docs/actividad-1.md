# Actividad 1: demostración del analizador y el intérprete

La aplicación analiza y ejecuta programas de noEsPython:(. Entra con una cuenta, pega un ejemplo en el editor y pulsa **Analizar y ejecutar**. La interfaz presenta los tokens, AST, tablas de símbolos, errores y warnings; si no hay errores semánticos y el modo elegido lo permite, también muestra la salida y los valores finales del intérprete.

La referencia completa de la sintaxis, tipos, operadores, ámbitos, tareas, rangos, paralelismo, diagnósticos y limitaciones está en [Guía completa del lenguaje](guia-del-lenguaje.md). Esta página sirve como guion breve para mostrar la actividad.

## Programa válido

```text
guarda edad: entero = 20;
fijo limite: entero = 18;
si (edad (+) limite) {
  impresora(...Mayor de edad..., edad);
} sino {
  impresora(...Menor de edad...);
}

tarea sumar(a: entero, b: entero): entero {
  resultado a + b;
}
guarda total: entero = sumar(4, 6);
impresora(...Suma..., total);
```

La salida esperada es `Mayor de edad 20` y `Suma 10`. La tabla semántica contiene `edad`, `limite`, `sumar` y `total`. No deben aparecer errores semánticos.

## Casos semánticos para mostrar

Ejecuta cada fragmento por separado para que la ubicación del diagnóstico sea fácil de identificar.

| Caso | Código de demostración | Diagnóstico esperado |
|---|---|---|
| Type mismatch | `guarda cociente = 5 / ...hola...;` | `TYPE_MISMATCH`, con línea y columna. |
| Nombre no declarado | `guarda resultado = noExiste + 1;` | `UNDECLARED_IDENTIFIER`. |
| Declarada pero sin valor | `guarda pendiente; impresora(pendiente);` | Warning `UNINITIALIZED_VARIABLE`; si se ejecuta, el intérprete también detiene la lectura sin valor. |
| Declarada pero nunca usada | `guarda sinUsar = 5;` | Warning `UNUSED_VARIABLE`. |
| Declaración repetida | `guarda dato = 1;` seguido de `guarda dato = 2;` | `DUPLICATE_DECLARATION`. |
| Variable local desde otra tarea | `tarea primera() { guarda secreto = 5; resultado secreto; }` seguido de `tarea segunda() { impresora(secreto); }` | `UNDECLARED_IDENTIFIER` en la segunda tarea. |
| Retorno incompatible | `tarea codigo(): entero { resultado 7; }` seguido de `guarda texto: texto = codigo();` | `TYPE_MISMATCH` en la declaración de `texto`. |
| Argumento incompatible | `tarea duplicar(x: entero): entero { resultado x * 2; }` seguido de `guarda valor = duplicar(5.8);` | `TYPE_MISMATCH`: el argumento debe ser entero. |
| Número de argumentos | `tarea sumar(a: entero, b: entero): entero { resultado a + b; }` seguido de `guarda valor = sumar(1, 2, 3);` | `ARGUMENT_COUNT_MISMATCH`. |
| Overflow estático | `guarda maximo = 2147483647;` seguido de `maximo = maximo + 1;` | Error `INTEGER_OVERFLOW`. |
| Overflow al ejecutar | `tarea eleva(base: entero): real { resultado base ** 10; }` seguido de `guarda salida = eleva(100000);` | El intérprete muestra `INTEGER_OVERFLOW` con línea y columna. |

Los warnings aparecen activados por defecto. El checkbox **Mostrar warnings** permite ocultarlos; los warnings ocultos tampoco bloquean el modo **Estricto**. En modo **Flexible**, los warnings visibles permiten ejecutar; **Estricto** bloquea ante errores o warnings visibles.

## Clases, lambdas y currificación

Este ejemplo crea una instancia, llama un método y usa una lambda parcialmente aplicada:

~~~text
clase Persona {
  guarda nombre: texto;

  tarea inicia(nombre: texto) {
    este.nombre = nombre;
  }

  tarea saludar(): texto {
    resultado ...Hola, ... + este.nombre;
  }
}

guarda ana = nuevo Persona(...Ana...);
impresora(ana.saludar());

guarda multiplicar = lambda(x: entero, y: entero) => x * y;
guarda por_tres = multiplicar(3);
impresora(por_tres(4));
~~~

La salida es Hola, Ana y 12. inicia recibe los argumentos de nuevo Persona(...); este nombra la instancia en un método. La lambda devuelve otra función tras recibir solo el primer argumento.

## Herencia y sobrescritura

~~~text
clase Animal {
  guarda nombre: texto;

  tarea inicia(nombre: texto) {
    este.nombre = nombre;
  }

  tarea sonido(): texto {
    resultado ...sonido genérico de ... + este.nombre;
  }
}

clase Perro hereda Animal {
  tarea sonido(): texto {
    resultado ...guau...;
  }
}

guarda animal = nuevo Animal(...Toby...);
guarda mascota = nuevo Perro(...Nube...);
impresora(animal.sonido(), mascota.nombre, mascota.sonido());
~~~

La salida es sonido genérico de Toby Nube guau. Perro hereda el campo y el inicializador de Animal, y su método sonido sobrescribe al de la clase base. También se puede escribir extiende en lugar de hereda.

## Warnings nuevos

~~~text
tarea sinUsar() {
  resultado 1;
}

tarea conSalida(valor: entero): entero {
  resultado valor;
  impresora(valor);
}
impresora(conSalida(2));
~~~

El primer fragmento genera UNUSED_FUNCTION para sinUsar; el segundo genera UNREACHABLE_CODE para la publicación después de resultado. La llamada final evita que conSalida también se marque como no utilizada. Ambos warnings se muestran con línea y columna. Los warnings están activos por defecto; para ocultarlos o volver a mostrarlos, usa el checkbox **Mostrar warnings** y analiza de nuevo.

## Rangos y paralelismo

```text
guarda x: rango = [1,...,5];
x = x * 3 + 1;
impresora(x);

guarda izquierda = 2;
guarda derecha = 100;
par {
  izquierda = derecha, derecha = izquierda;
}
impresora(izquierda, derecha);
```

La salida muestra `[4,...,16]` y después `100 2`. Las expresiones de la derecha del bloque `par` se calculan antes de escribir cualquier destino, de modo que el intercambio no requiere una variable auxiliar.

## Funciones y estructuras nuevas

Los nombres integrados nuevos usan el estilo español del lenguaje. Por ejemplo, `raiz_cuadrada`, `potencia`, `valor_absoluto`, `longitud`, `secuencia`, `sumatoria`, `transformar` y `filtrar` reemplazan los nombres Python equivalentes en ejemplos nuevos.

~~~text
guarda datos: lista = [1, 2, 3, 4, 5];
guarda pares = [numero para_cada numero en datos si numero modulo 2 == 0];
guarda cuadrados = transformar(lambda(x: entero) => x * x, pares);
impresora(cuadrados, sumatoria(cuadrados));

intentar {
  lanzar ...muestra controlada...;
} capturar (error) {
  impresora(...Se capturó:..., error);
} finalmente {
  impresora(...fin...);
}
~~~

`lista` guarda elementos ordenados; `para_cada` crea el ámbito de `numero`; la comprensión filtra valores pares; `transformar` llama la lambda para cada elemento; `sumatoria` agrega el resultado. En el segundo bloque `lanzar` crea un error, `capturar` enlaza su mensaje a `error` y `finalmente` ejecuta su bloque al salir.

## Qué hace cada parte del análisis semántico

La implementación está en [`src/core/semantic/SemanticAnalyzer.ts`](../src/core/semantic/SemanticAnalyzer.ts).

1. **Inicialización y alcance (`analyzeSemantics`, `resolve`).** Crea el ámbito global, apila ámbitos para bloques y tareas, y busca nombres desde el bloque más interno hacia afuera. Por eso una variable local de una tarea no se filtra a otra.
2. **Declaraciones (`declare`, `visitDeclaration`).** Rechaza nombres repetidos en el mismo ámbito, guarda el tipo declarado o inferido y registra si la variable ya tiene valor.
3. **Lecturas (`checkIdentifier`).** Informa nombres no declarados, cuenta los usos y avisa cuando una variable todavía no tiene valor.
4. **Expresiones (`visitExpression`, `visitBinary`, `checkArithmeticTypes`).** Calcula el tipo de literales, rangos, llamadas y operadores. Detecta operandos incompatibles, condiciones que no son booleanas y operaciones aritméticas constantes fuera de int32.
5. **Asignaciones (`visitAssignment`).** Busca el destino, rechaza constantes, compara el tipo de destino con el valor y conserva el tipo inferido de la variable.
6. **Paralelismo (`visitParallel`).** Analiza todas las expresiones a la derecha primero; después valida los destinos, las constantes y los tipos.
7. **Tareas (`registerFunction`, `visitFunction`).** Registra firmas, comprueba cantidad y tipos de argumentos, infiere o valida el tipo de retorno y mantiene locales separados.
8. **Estado final.** Emite warnings por variables/tareas no usadas, valores no inicializados y código inalcanzable. Cada diagnóstico conserva línea, columna e índices de caracteres para que la interfaz pueda señalar el sitio.

Las anotaciones de tipo son opcionales: `entero`, `real`, `texto`, `booleano` y `rango`. Si no se escribe una anotación, el analizador infiere el tipo inicial y el intérprete comprueba tipos dinámicamente durante la ejecución.

La guía completa incluye un ejemplo adicional sin errores con una explicación semántica de cada línea: [análisis línea por línea](guia-del-lenguaje.md#136-ejemplo-de-análisis-semántico-línea-por-línea).

La aplicación incluye sobrecarga de tareas por número de parámetros. La corrección con IA generativa es un extra de la actividad y no está activada en esta versión; las sugerencias actuales son reglas deterministas, no un modelo generativo.
