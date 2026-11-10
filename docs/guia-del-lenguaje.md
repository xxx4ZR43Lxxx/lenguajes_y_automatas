# Referencia completa de noEsPython:(

**noEsPython:(** es un lenguaje educativo en español que se analiza y ejecuta en la aplicación del proyecto. La referencia describe construcciones conectadas entre lexer, parser, analizador semántico e intérprete; las capacidades aún pendientes se indican al final.

> Las palabras y ejemplos de esta referencia corresponden al código actual. Una construcción que el lexer reconoce no necesariamente tiene ejecución completa; esas diferencias se señalan en las limitaciones.

## 1. Probar un programa en la aplicación

1. Abre el editor y pega un programa.
2. Deja el modo semántico en **Flexible** para ver warnings sin impedir la ejecución.
3. Pulsa **Analizar y ejecutar**.
4. Revisa tokens, AST, tablas, errores y warnings. Si el análisis léxico, sintáctico o semántico tiene errores, la aplicación no ejecuta el intérprete.
5. Si el programa es ejecutable, revisa la salida, los errores de ejecución y las variables globales finales en el panel **Intérprete**.

El modo **Estricto** también impide la ejecución cuando hay warnings. En **Flexible**, los errores sí impiden ejecutar, pero los warnings no.

## 2. Programa completo de ejemplo

~~~text
:) Una condición, una tarea, un bucle, una lectura y un rango. :(
fijo LIMITE: entero = 18;
guarda edad: entero = 20;

tarea es_mayor(valor: entero, limite: entero): booleano {
  resultado valor >= limite;
}

guarda mayor = es_mayor(edad, LIMITE);
si (mayor) {
  impresora(...Es mayor de edad..., edad);
} sino {
  impresora(...Es menor de edad...);
}

bucle_por (guarda i: entero = 0; i (-) 3; i++) {
  impresora(...Iteración..., i);
}

guarda nombre = pregunta(...¿Cómo te llamas?...);
impresora(...Hola..., nombre);

guarda incertidumbre: rango = [1,...,5];
incertidumbre = incertidumbre * 3 + 1;
impresora(incertidumbre);
~~~

Este ejemplo muestra una constante, una variable tipada, una tarea con parámetros y retorno, una llamada, una condición, un bucle, entrada, salida y aritmética de rangos. La lectura solicita texto en el navegador. La salida del rango es [4,...,16].

## 3. Convenciones y gramática

- Los bloques usan llaves { y }.
- Las declaraciones, asignaciones, llamadas independientes, entrada/salida y resultado terminan en punto y coma.
- Las declaraciones de tarea y las instrucciones de control no llevan punto y coma después de la llave final.
- Los argumentos y parámetros se separan con comas.
- Los espacios y saltos de línea solo separan tokens; no se exige sangría.
- Se pueden agrupar expresiones con paréntesis.
- El signo igual asigna. Para comparar igualdad usa ==, ==>, o igual_a.

Resumen de las formas principales:

~~~text
declaracion := guarda nombre [: tipo] [= expresion] ;
             | fijo nombre [: tipo] = expresion ;
asignacion  := nombre = expresion ;
si          := si ( expresion ) bloque [sino bloque]
mientras    := bucle_mientras ( expresion ) bloque
por         := bucle_por ( inicializacion ; expresion ; actualizacion ) bloque
tarea       := tarea nombre ( parametros ) [: tipo] bloque
retorno     := resultado expresion ;
clase       := clase nombre [hereda ClaseBase] { campos tareas }
lambda      := lambda ( parametros ) => expresion
instancia   := nuevo NombreClase ( argumentos )
miembro     := expresion . identificador
paralelo    := par { nombre = expresion { , nombre = expresion } ; }
salida      := impresora ( argumentos ) ;
entrada     := (chismea | atrapa | pregunta | dameDatos) ( argumentos ) ;
rango       := [ expresion , ... , expresion ]
~~~

## 4. Palabras reservadas

Las palabras clave se reconocen sin distinguir mayúsculas y minúsculas. Los identificadores de usuario conservan el uso de mayúsculas: dato y Dato son nombres distintos.

| Palabra(s) | Uso |
| --- | --- |
| guarda, fijo | Declarar variable modificable o constante. |
| si, sino | Condición y alternativa. |
| bucle_por, bucle_mientras | Bucles. |
| para_cada, en | Iteración sobre colecciones o rangos. |
| salir, continuar, sin_operacion, afirmar | Control de bucles y aserciones. |
| tarea, resultado | Declarar tarea y devolver valor. |
| par | Asignaciones simultáneas. |
| clase, nuevo, este | Declarar clases, crear instancias y referirse al objeto actual. |
| hereda, extiende | Declarar una clase base para heredar campos y métodos. |
| lambda | Crear funciones anónimas con cuerpo de expresión. |
| impresora | Publicar valores. |
| chismea, atrapa, pregunta, dameDatos | Leer texto. |
| entero, real, texto, booleano, rango | Tipos de anotación. |
| mas, menos, por, entre | Operaciones aritméticas; también se admiten como llamadas. |
| menor_igual, mayor_igual, igual_a, distinto_de | Comparadores escritos con palabras. |
| y, o, no | Operadores lógicos. |
| verdadero, falso, nulo | Literales booleanos y valor nulo. |
| intentar, capturar, finalmente, lanzar | Manejar y generar errores. |
| seleccionar, caso | Elegir una rama según coincidencia con un valor. |
| con, como | Ejecutar un bloque con un archivo y cerrarlo al salir. |
| importar | Cargar un módulo integrado con alias opcional. |
| desde, ceder, asincrono, esperar | Palabras reservadas léxicas con ejecución pendiente. |

Inf, Infinity y NaN se reconocen como tokens especiales. `verdadero`, `falso` y `nulo` son literales. Los nombres `print`, `input`, `true`, `false`, `for`, `while` y `function` no son palabras reservadas.

## 5. Valores, tipos e identificadores

### 5.1 Tipos

Las anotaciones son opcionales. Sin anotación, el analizador infiere el tipo inicial de una expresión.

| Tipo en el lenguaje | Valor representado | Ejemplo |
| --- | --- | --- |
| entero | Número entero dentro de int32. | guarda cantidad: entero = 4; |
| real | Número decimal; también acepta un entero. | guarda precio: real = 3.5; |
| texto | Cadena entre tres puntos. | guarda nombre: texto = ...Ana...; |
| booleano | Literal `verdadero`/`falso` o resultado de comparación/lógica. | guarda activo: booleano = verdadero; |
| rango | Intervalo numérico con extremos inferior y superior. | guarda x: rango = [1,...,5]; |
| lista, tupla, conjunto, diccionario | Colecciones heterogéneas y dinámicas. | guarda datos: lista = [1, ...dos..., verdadero]; |

Las conversiones explícitas se realizan con `a_entero`, `a_real`, `a_texto` y `a_booleano`.

Los tipos se comprueban estáticamente cuando se conocen. Si una entrada o expresión tiene tipo unknown, el intérprete también comprueba los tipos de valores reales durante la ejecución. Las anotaciones no activan un modo independiente: son contratos de tipo para variables, parámetros y retornos.

~~~text
guarda cuenta = 3;                // tipo inferido: entero
guarda tasa: real = 3.5;          // anotación explícita
guarda mensaje: texto = ...hola...;
guarda listo = cuenta >= 1;       // tipo inferido: booleano
~~~

### 5.2 Números y valores especiales

Se admiten enteros y decimales con un solo punto. Se puede omitir un lado del punto si el otro tiene dígitos.

~~~text
guarda a = 42;
guarda b = 3.14;
guarda c = .75;
guarda d = 10.;
~~~

La notación exponencial como 1e5 no es un literal numérico único. Un número con dos puntos decimales, como 2.3.4, causa un error léxico.

El lexer reconoce Inf, Infinity y NaN, pero el runtime actual no los trata de forma consistente como valores numéricos en operaciones. Evita usarlos en cálculos hasta que esa limitación se corrija.

### 5.3 Textos

Los textos se delimitan con tres puntos, no con comillas. El contenido puede incluir espacios y saltos de línea. El siguiente delimitador de tres puntos cierra el texto; no hay escapes para incluir ese delimitador dentro de una cadena.

~~~text
guarda saludo = ...Hola, mundo...;
guarda vacio = ......;
impresora(...Mensaje:..., saludo);
~~~

### 5.4 Identificadores

Un nombre normal comienza con una letra ASCII, ñ, Ñ o _. Puede seguir con letras de ese conjunto, _ y dígitos. Las vocales acentuadas no se aceptan como letras de identificador.

~~~text
guarda total_2 = 9;
guarda año = 2026;
guarda _temporal = 1;
~~~

También se admiten formas especiales $dato y [dato] como identificadores. Se recomienda usar nombres normales para evitar confundir [dato] con la sintaxis de rangos.

## 6. Variables, constantes y alcance

### 6.1 Declarar, inicializar y asignar

guarda declara una variable que puede reasignarse. Su valor inicial es opcional. Una variable que se lee antes de recibir un valor genera warning y, durante la ejecución, un error de runtime.

~~~text
guarda contador = 0;
contador = contador + 1;

guarda pendiente;
pendiente = 10;
impresora(pendiente);
~~~

Se puede anotar el tipo. El valor asignado debe ser compatible:

~~~text
guarda edad: entero = 20;
edad = 21;
~~~

fijo declara una constante y requiere inicializador. No se puede reasignar ni incrementar.

~~~text
fijo PI_APROX = 3.1416;
fijo saludo: texto = ...Hola...;
~~~

### 6.2 Ámbitos

Cada bloque delimita sus variables locales. Un bloque interno puede acceder a variables de un bloque que lo contiene, pero las declaraciones internas no están disponibles después del bloque. Los parámetros y las variables locales de una tarea se limitan a esa tarea.

~~~text
si (5 > 2) {
  guarda mensaje = ...dentro del bloque...;
  impresora(mensaje);
}
// mensaje no está declarado en este punto.
~~~

Intentar usar una variable local de una tarea en otra genera UNDECLARED_IDENTIFIER. Las tareas deben declararse al nivel principal. La implementación actual tampoco permite confiar en la resolución semántica de variables globales desde el cuerpo de una tarea; para evitar falsos errores, pasa los datos como parámetros.

### 6.3 Variables no usadas

Si se declara una variable y nunca se lee, el analizador emite el warning UNUSED_VARIABLE. El warning aplica a variables guarda, no a constantes fijo ni parámetros.

~~~text
guarda resultado_temporal = 5; // warning: nunca se leyó
~~~

Los warnings están visibles por defecto. El checkbox Mostrar warnings permite ocultarlos; al desactivarlo no aparecen en el panel ni bloquean el modo Estricto. En modo Flexible los warnings visibles no bloquean la ejecución.

## 7. Operadores y expresiones

### 7.1 Aritmética

| Operación | Operadores | Llamada equivalente |
| --- | --- | --- |
| Suma | +, mas | mas(a, b) |
| Resta | -, menos | menos(a, b) |
| Multiplicación | *, por | por(a, b) |
| División | /, entre | entre(a, b) |
| Potencia | ** | potencia(base, exponente) |
| División entera con piso | entre_entero | entre_entero(a, b) |
| Residuo | modulo, % | modulo(a, b) |
| División alternativa | ./ | Sin llamada equivalente. |
| Signo | +x, -x | — |

./ ejecuta división escalar o de rangos igual que /. No es división vectorial. La división por cero es un error de ejecución. + también concatena dos textos; no se puede sumar un texto con un número.

~~~text
guarda suma = 2 + 3;
guarda producto = por(4, 5);
guarda frase = ...Hola ... + ...mundo...;
guarda potencia = 2 ** 8;
~~~

### 7.2 Comparación

Todas las comparaciones producen un booleano.

| Comparación | Formas aceptadas |
| --- | --- |
| Menor que | (-), < |
| Mayor que | (+), > |
| Menor o igual | =(-), <=, menor_igual |
| Mayor o igual | =(+), >=, mayor_igual |
| Igual | ==>, ==, igual_a |
| Diferente | !=, <>, distinto_de |

Los símbolos (-), (+), =(-) y =(+) son operadores completos. - y + sin esos paréntesis siguen siendo aritméticos. = siempre significa asignación.

~~~text
guarda menor = edad (-) 18;
guarda cumple = edad =(+) 18;
guarda mismo = edad == limite;
~~~

### 7.3 Lógica

| Operación | Formas aceptadas |
| --- | --- |
| Y | y, && |
| O | o, \|\| |
| Negación | no, !, ¬ |

Los operandos deben ser booleanos. La implementación del parser/runtime contiene algunos tokens lógicos adicionales, pero no hay una escritura fuente disponible para ellos en el lexer actual.

~~~text
guarda mayor = edad >= 18;
guarda con_permiso = mayor y tiene_permiso;
guarda puede_entrar = mayor o con_permiso;
guarda menor = no (edad >= 18);
~~~

### 7.4 Incremento y precedencia

++ y -- se aceptan como actualización en el campo final de bucle_por, además de como expresión. Fuera de esa cabecera, actualiza una variable con una asignación ordinaria:

~~~text
contador = contador + 1;
~~~

Precedencia binaria de menor a mayor:

1. o, ||
2. y, &&
3. Comparaciones
4. +, -
5. *, /, ./
6. **

Los operadores binarios del mismo nivel se agrupan de izquierda a derecha. Usa paréntesis para hacer explícita la intención:

~~~text
guarda total = (a + b) * c;
guarda autorizado = (edad >= 18) y (saldo > 0);
~~~

## 8. Rangos numéricos

Un rango se escribe [inferior,...,superior]. Sus extremos deben ser numéricos. Si se dan al revés, el intérprete normaliza el intervalo para mantener el extremo menor primero.

Las operaciones aritméticas con rangos producen otro rango. El intérprete transforma los extremos y, para multiplicación/división, considera sus combinaciones. La división falla si el rango divisor contiene cero.

~~~text
guarda x: rango = [1,...,5];
x = x * 3 + 1;
impresora(x);
~~~

Salida:

~~~text
[4,...,16]
~~~

Se admiten rangos con operaciones como x + 2, x - 2, x * 3 y x / 2. El lenguaje no implementa arreglos ni colecciones generales; el rango representa únicamente un intervalo numérico.

## 9. Asignación paralela con par

Dentro de par se escribe una lista de asignaciones separadas por coma o punto y coma. El intérprete calcula todas las expresiones de la derecha usando los valores anteriores y después escribe todos los destinos. Así se intercambian variables sin variable temporal.

~~~text
guarda x = 2;
guarda z = 100;
par {
  x = z, z = x;
}
impresora(x, z);
~~~

Salida:

~~~text
100 2
~~~

Esta construcción ofrece semántica de asignación simultánea; no crea hilos ni ejecución concurrente. Cada destino debe estar declarado, ser modificable y aparecer una sola vez. Se comprueba también la compatibilidad de tipos.

## 10. Condiciones y bucles

### 10.1 si y sino

La condición debe estar entre paréntesis. Puede ser booleana o cualquier valor con verdad/falsedad: `nulo`, `falso`, cero, texto vacío y colecciones vacías cuentan como falso. sino es opcional.

~~~text
si (temperatura > 30) {
  impresora(...Hace calor...);
} sino {
  impresora(...No hace calor...);
}
~~~

### 10.2 bucle_mientras

Repite el bloque mientras la condición sea verdadera. El intérprete limita el programa a 20,000 pasos por defecto para detener ciclos que no terminan.

~~~text
guarda contador = 0;
bucle_mientras (contador (-) 3) {
  impresora(contador);
  contador = contador + 1;
}
~~~

### 10.3 bucle_por

La cabecera tiene inicialización, condición y actualización separadas por dos punto y coma. La inicialización es una declaración o una asignación. La actualización es asignación o ++/--.

~~~text
bucle_por (guarda i = 0; i (-) 3; i++) {
  impresora(i);
}
~~~

El alcance de i termina con el bucle. Una sentencia normal como i++; no está soportada; escribe i = i + 1;.

## 11. Tareas, funciones y sobrecarga

### 11.1 Declarar y llamar una tarea

~~~text
tarea sumar(a: entero, b: entero): entero {
  resultado a + b;
}

guarda total = sumar(4, 6);
impresora(total);
~~~

- tarea inicia la declaración.
- Los parámetros se separan con comas y pueden llevar anotación de tipo.
- La anotación de retorno también es opcional.
- resultado evalúa su expresión y devuelve ese valor al llamador.
- Las tareas se declaran al nivel principal.
- Sin anotación de retorno, el analizador infiere el tipo de los resultado que encuentra.
- Los parámetros anotados se validan tanto semánticamente como durante la ejecución.

Si todas las rutas de la tarea terminan sin resultado, el intérprete devuelve 0. No hay void explícito.

### 11.2 Sobrecarga por aridad

Se pueden declarar tareas con el mismo nombre si tienen diferente cantidad de parámetros. La selección se hace por cantidad, no por tipos.

~~~text
tarea suma(a: entero, b: entero): entero {
  resultado a + b;
}
tarea suma(a: entero, b: entero, c: entero): entero {
  resultado a + b + c;
}

impresora(suma(2, 3));       // firma de 2 parámetros
impresora(suma(2, 3, 4));    // firma de 3 parámetros
~~~

Repetir la misma cantidad de parámetros es DUPLICATE_DECLARATION. Pasar una cantidad que no coincide con ninguna firma produce ARGUMENT_COUNT_MISMATCH.

### 11.3 Aplicación encadenada

Se pueden encadenar grupos de argumentos. Las funciones declaradas pueden recibir argumentos en varias aplicaciones; una aplicación parcial produce una función que conserva los argumentos ya suministrados.

~~~text
tarea sumar_tres(a: entero, b: entero, c: entero): entero {
  resultado a + b + c;
}

guarda sumar_desde_uno = sumar_tres(1);
guarda sumar_desde_uno_y_dos = sumar_desde_uno(2);
guarda total = sumar_desde_uno_y_dos(3);
impresora(total);
~~~

La salida es 6. También se admite la forma abreviada sumar_tres(1)(2)(3), que el parser reúne como una llamada con tres argumentos. Una llamada parcial ambigua a una función sobrecargada se diagnostica como AMBIGUOUS_FUNCTION_OVERLOAD.

### 11.4 Lambdas y currificación

lambda crea una función anónima cuyo cuerpo es una expresión. Se puede guardar en una variable, pasar argumentos y aplicarlos de manera parcial. Los parámetros pueden anotar sus tipos; los no anotados se comprueban dinámicamente cuando se conocen los valores.

~~~text
guarda multiplicar = lambda(x: entero, y: entero) => x * y;
guarda por_tres = multiplicar(3);
guarda resultado = por_tres(4);
impresora(resultado);
~~~

La salida es 12. por_tres guarda el primer argumento y devuelve una función que espera el segundo. Las lambdas capturan el entorno en que fueron creadas. El cuerpo actual debe ser una expresión; no admite un bloque con varias instrucciones ni una sentencia resultado.

~~~text
guarda sumar = lambda(a: entero, b: entero) => a + b;
guarda sumar_diez = sumar(10);
impresora(sumar_diez(5));
~~~

### 11.5 Clases, atributos e instancias

Una clase agrupa atributos y tareas de instancia. Los campos se declaran con guarda o fijo; los métodos usan tarea. El método opcional inicia funciona como constructor. Dentro de un método, este referencia la instancia actual. Se crea una instancia con nuevo y se accede a sus miembros con punto.

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
~~~

La salida es Hola, Ana. Los campos pueden tener valor inicial y tipo opcional. Un campo fijo debe tener valor inicial y no se puede reasignar después. Los métodos pueden leer y modificar campos de la instancia, recibir parámetros y devolver valores con resultado.

~~~text
clase Contador {
  guarda valor: entero = 0;

  tarea incrementar() {
    este.valor = este.valor + 1;
  }

  tarea actual(): entero {
    resultado este.valor;
  }
}

guarda c = nuevo Contador();
c.incrementar();
impresora(c.actual());
~~~

Una clase puede heredar de una sola clase con hereda o extiende. Hereda sus campos y métodos, y puede sobrescribir un método conservando la cantidad y los tipos de parámetros y un retorno compatible. La búsqueda de métodos usa la clase real de la instancia, por lo que una llamada puede ejecutar la sobrescritura de la subclase. Si la subclase no declara inicia, se usa el inicializador heredado. Si declara uno propio, no hay llamada automática al inicializador base ni una expresión super en esta versión. No se permite redeclarar un atributo heredado. Aún no hay interfaces, control de acceso public/private/protected, clases abstractas ni miembros estáticos.

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

La salida es sonido genérico de Toby Nube guau. Perro hereda el atributo nombre y el inicializador de Animal, pero la llamada a sonido en mascota ejecuta el método sobrescrito de Perro. La palabra extiende es un sinónimo de hereda.

### 11.6 Funciones matemáticas integradas

Estas funciones están disponibles como llamadas:

| Función | Aridad | Operación |
| --- | ---: | --- |
| seno(x), coseno(x), tangente(x) | 1 | Funciones trigonométricas. |
| logaritmo(x) | 1 | Logaritmo natural. |
| raiz_cuadrada(x) | 1 | Raíz cuadrada. |
| valor_absoluto(x) | 1 | Valor absoluto. |
| potencia(a, b) | 2 | Potencia. |

~~~text
guarda hipotenusa = raiz_cuadrada(potencia(3, 2) + potencia(4, 2));
guarda diferencia = valor_absoluto(10 - 17);
~~~

Los nombres ingleses `sin`, `cos`, `tan`, `log`, `sqrt`, `abs` y `pow` siguen aceptándose como alias de compatibilidad. En programas nuevos usa los nombres españoles.

### 11.7 Colecciones y funciones integradas

Las listas y tuplas usan corchetes y paréntesis; los conjuntos y diccionarios usan llaves. El literal de rango conserva la forma `[inicio,...,fin]`.

~~~text
guarda valores: lista = [10, 20, 30];
guarda coordenada: tupla = (4, 8);
guarda etiquetas: conjunto = { ...rojo..., ...azul... };
guarda precios: diccionario = { ...pan...: 12, ...leche...: 25 };
valores[1] = 22;
precios[...pan...] = 14;
impresora(valores, coordenada, etiquetas, precios);
~~~

Las listas y tuplas aceptan índices enteros; los negativos cuentan desde el final. Las listas y diccionarios aceptan asignación por índice. Los conjuntos eliminan valores repetidos. `en` y `no_en` comprueban pertenencia. En condiciones se usa verdad/falsedad: `nulo`, `falso`, cero, texto vacío y colecciones vacías son falsos.

~~~text
guarda numeros = [1, 2, 3, 4];
guarda pares = filtrar(lambda(x: entero) => x modulo 2 == 0, numeros);
guarda dobles = transformar(lambda(x: entero) => x * 2, pares);
impresora(dobles, sumatoria(dobles), longitud(dobles));
~~~

Las comprensiones de lista permiten transformar elementos y añadir un filtro opcional:

~~~text
guarda cuadrados_pares = [numero * numero para_cada numero en numeros si numero modulo 2 == 0];
~~~

Funciones integradas: `a_entero`, `a_real`, `a_texto`, `a_booleano`, `lista`, `tupla`, `diccionario`, `conjunto`, `longitud`, `secuencia`, `sumatoria`, `maximo`, `minimo`, `ordenar`, `al_reves`, `redondear`, `todos`, `alguno`, `enumerar`, `emparejar`, `transformar`, `filtrar`, `tipo_de`, `es_instancia_de`, `es_subclase_de`, `iterador_de`, `siguiente`, `formatear`, `representar`, `cociente_y_resto` y `abrir`. `secuencia(fin)` empieza en cero y no incluye el límite; `secuencia(inicio, fin, paso)` permite paso negativo. `abrir` trabaja con un sistema de archivos en memoria durante la ejecución, no con archivos del equipo.

Los módulos integrados se pueden importar con alias: `matematicas`, `colecciones`, `iteracion` y `archivos`. Solo se admiten esos módulos; todavía no se cargan módulos del usuario ni paquetes externos.

~~~text
importar matematicas como mate;
guarda hipotenusa = mate.raiz_cuadrada(mate.potencia(3, 2) + mate.potencia(4, 2));
impresora(hipotenusa);
~~~

~~~text
guarda archivo = abrir(...nota.txt..., ...w...);
archivo.escribir(...texto guardado...);
archivo.cerrar();
guarda lectura = abrir(...nota.txt...);
impresora(lectura.leer());
lectura.cerrar();
~~~

Para cerrar el archivo automáticamente, usa `con`:

~~~text
con abrir(...nota.txt...) como archivo {
  impresora(archivo.leer());
}
~~~

### 11.8 Iteración y control de bucles

`para_cada` recorre listas, tuplas, conjuntos, diccionarios (por clave), textos y rangos. `salir` termina el bucle actual; `continuar` salta a la siguiente iteración; `sin_operacion` no hace nada. `afirmar` interrumpe la ejecución si su condición resulta falsa.

~~~text
guarda total = 0;
para_cada (numero en secuencia(1, 6)) {
  si (numero == 3) { continuar; }
  total += numero;
  si (total > 8) { salir; }
}
afirmar total > 0, ...el total debe ser positivo...;
~~~

Las asignaciones compuestas `+=`, `-=`, `*=` y `/=` actualizan variables. `+=` concatena textos o listas compatibles. `modulo` o `%` calcula el residuo; `entre_entero` realiza división con piso.

### 11.9 Selección por casos

`seleccionar` evalúa una expresión y ejecuta el primer `caso` que coincida. El identificador `_` es el patrón comodín para el caso predeterminado.

~~~text
seleccionar (codigo) {
  caso 200 { impresora(...correcto...); }
  caso 404 { impresora(...no encontrado...); }
  caso _ { impresora(...otro resultado...); }
}
~~~

### 11.10 Manejo de errores

`intentar` ejecuta un bloque, `capturar` recibe el mensaje del error en una variable opcional y `finalmente` se ejecuta al salir del intento. `lanzar` genera un error del lenguaje.

~~~text
intentar {
  lanzar ...no se pudo procesar...;
} capturar (error) {
  impresora(...Error:..., error);
} finalmente {
  impresora(...operación terminada...);
}
~~~

Las cuatro operaciones mas, menos, por, entre también pueden escribirse como llamadas con dos argumentos. El parser reconoce asimismo sus formas simbólicas como llamadas; se recomiendan los operadores infijos.

## 12. Entrada, salida y comentarios

### 12.1 Salida

impresora publica cero o más expresiones, separadas por coma. Cada invocación genera una línea y separa los argumentos con espacios.

~~~text
impresora(...Hola...);
impresora(...Total..., 10 + 5);
impresora(...Edad..., edad, ...años...);
~~~

### 12.2 Entrada

chismea, atrapa, pregunta y dameDatos son alias de lectura. En el editor abren el prompt del navegador. El valor leído es texto; no hay conversión automática a entero o real.

~~~text
guarda nombre = pregunta(...¿Cómo te llamas?...);
impresora(...Hola..., nombre);
~~~

Si se escribe la lectura como sentencia independiente, el valor se descarta:

~~~text
atrapa(...Este texto no se guarda...);
~~~

### 12.3 Comentarios

El comentario propio del lenguaje comienza con :) y termina con :(. Puede ocupar varias líneas.

~~~text
:) Comentario multilínea
que ignora el lexer. :(
~~~

También se admiten comentarios de una línea con //, \\, # o rem, y comentarios multilínea /* ... */. `%` es un operador aritmético y no inicia comentarios.

~~~text
// comentario de línea
\\ otro comentario de línea
# comentario
rem comentario

/* comentario
   multilínea */
~~~

## 13. Análisis léxico, sintáctico y semántico

### 13.1 Fases

1. **Léxico:** el autómata finito determinista recorre caracteres, forma tokens, registra comentarios y guarda línea/columna de cada token. El lexer se detiene ante el primer error léxico.
2. **Sintáctico:** el parser valida el orden de tokens y construye un AST (árbol sintáctico abstracto). Intenta sincronizarse para reportar más de un error sintáctico.
3. **Semántico:** crea ámbitos y símbolos; valida nombres, inicialización, tipos, tareas, lambdas, argumentos, retornos, clases, colecciones, overflow y asignaciones paralelas; emite warnings de uso y código inalcanzable.
4. **Ejecución:** el intérprete evalúa el AST, produce salida y registra valores globales o errores de ejecución.

Cada diagnóstico se presenta con línea y columna. Para errores de runtime, la ubicación corresponde a la expresión o sentencia que produjo el fallo.

### 13.2 Tabla de variables/símbolos

La vista de análisis incluye la tabla de símbolos semánticos. Guarda nombres globales de variables, constantes, tareas y clases, sus tipos inferidos/declarados y las aridades disponibles para las tareas. La tabla léxica, separada, contiene identificadores y todas sus posiciones.

Los parámetros y locales se registran en ámbitos internos del análisis, pero no se proyectan en la tabla principal de la interfaz. El panel del intérprete muestra los valores globales que sí llegaron a inicializarse.

### 13.3 Diagnósticos semánticos

| Código | Qué detecta | Ejemplo |
| --- | --- | --- |
| TYPE_MISMATCH | Operación o asignación entre tipos incompatibles. | 5 / ...hola... |
| UNDECLARED_IDENTIFIER | Uso o asignación de un nombre no declarado. | guarda x = fantasma + 1; |
| UNINITIALIZED_VARIABLE (warning) | Lectura de variable declarada pero todavía sin valor. | guarda x; impresora(x); |
| UNUSED_VARIABLE (warning) | Variable guarda declarada pero nunca leída. | guarda x = 5; |
| UNUSED_FUNCTION (warning) | Tarea o método declarado que nunca se llama. El inicializador inicia se excluye. | tarea auxiliar() { resultado 1; } |
| UNREACHABLE_CODE (warning) | Instrucción posterior a resultado incondicional en el mismo bloque. | resultado x; impresora(x); |
| DUPLICATE_DECLARATION | Repetición de nombre en el mismo ámbito o firma de tarea repetida. | guarda x = 1; guarda x = 2; |
| UNKNOWN_CLASS | Creación con nuevo de una clase no declarada. | nuevo Fantasma(); |
| INVALID_INHERITANCE | Ciclo de herencia o sobrescritura con firma incompatible. | clase A hereda B {} y clase B hereda A {} |
| IMMUTABLE_ASSIGNMENT | Reasignación o actualización de una constante fijo. | fijo x = 1; x = 2; |
| UNKNOWN_FUNCTION | Llamada a tarea o función no disponible. | noExiste(2); |
| ARGUMENT_COUNT_MISMATCH | Aridad de llamada distinta a la de las firmas declaradas. | suma(1, 2, 3) si solo hay firma de 2. |
| AMBIGUOUS_FUNCTION_OVERLOAD | Llamada parcial que puede pertenecer a varias sobrecargas. | Aplicación parcial de un nombre sobrecargado. |
| INVALID_LOGICAL_OPERAND | Operador lógico recibe valor no booleano conocido. | 5 y 2 |
| NON_BOOLEAN_CONDITION | Condición de si/bucle no es booleana. | si (5) { ... } |
| INTEGER_OVERFLOW | Entero literal o aritmética constante fuera de int32. | 2147483647 + 1 |
| PARALLEL_TARGET_DUPLICATE | Un destino aparece más de una vez en un par. | par { x = 1, x = 2; } |

Una variable usada pero no declarada es un error. Una variable declarada pero sin asignación es primero un warning semántico (UNINITIALIZED_VARIABLE); si la ejecución llega a leerla, es un error de runtime. Una variable asignada pero nunca leída es un warning (UNUSED_VARIABLE), a veces descrito en clase como identificador reservado/no usado.
Las tareas y métodos no utilizados producen UNUSED_FUNCTION; las declaraciones de inicia se consideran usadas al crear la instancia. UNREACHABLE_CODE se informa cuando un resultado incondicional o un si con ambas ramas terminando en resultado deja instrucciones siguientes en el mismo bloque. El análisis no intenta demostrar que un ciclo nunca termina ni que una condición siempre sea verdadera.
Los warnings están activados por defecto y se pueden mostrar u ocultar con el checkbox Mostrar warnings. Flexible muestra warnings y permite ejecutar si no hay errores; Estricto bloquea cuando encuentra errores o warnings visibles.

### 13.4 Modos Flexible y Estricto

- **Flexible (predeterminado):** los errores léxicos, sintácticos y semánticos impiden la ejecución; los warnings visibles se muestran y no bloquean.
- **Estricto:** cualquier error semántico o warning visible marca el análisis como bloqueado y detiene la ejecución. Si se ocultan los warnings, solo bloquean los errores.

El checkbox Mostrar warnings controla la visibilidad y activación de los warnings; viene marcado por defecto. Los cambios se aplican al volver a analizar.

### 13.5 Ejemplos de los errores solicitados

Ejecuta cada fragmento por separado. En todos los casos el panel muestra el código de diagnóstico, mensaje, línea y columna. Las líneas indicadas en la explicación cuentan desde el inicio de cada fragmento.

**1. Type mismatch**

~~~text
guarda cociente = 5 / ...hola...;
~~~

Se espera TYPE_MISMATCH en la línea 1: la división requiere operandos numéricos. Mensaje: Type mismatch: no se puede operar un tipo 'integer' con un tipo 'string' usando '/'.

**2. Identificador no declarado y variable sin inicializar**

~~~text
guarda total = y + 1;
~~~

Se espera UNDECLARED_IDENTIFIER en la línea 1. El nombre y no tiene declaración. Mensaje: El identificador 'y' se usa antes de declararse.

~~~text
guarda pendiente;
impresora(pendiente);
~~~

Se espera warning UNINITIALIZED_VARIABLE en la línea 2. Mensaje: La variable 'pendiente' se usa antes de recibir un valor. En modo Flexible, el intérprete intenta correr y reporta el error de runtime UNINITIALIZED_VARIABLE con la misma explicación si llega a esa lectura.

**3. Variable declarada pero no usada**

~~~text
guarda sin_usar = 5;
~~~

Se espera warning UNUSED_VARIABLE en la línea 1. Mensaje: La variable 'sin_usar' fue declarada, pero nunca se utiliza. No impide ejecutar en modo Flexible.

**4. Declaración múltiple**

~~~text
guarda dato = 1;
guarda dato = 2;
~~~

Se espera DUPLICATE_DECLARATION en la línea 2 porque el nombre ya existe en el ámbito actual. Mensaje: El identificador 'dato' ya fue declarado en este ámbito.

**5. Intento de usar un local de otra tarea**

~~~text
tarea primera() {
  guarda secreto = 5;
  resultado secreto;
}
tarea segunda() {
  impresora(secreto);
  resultado 0;
}
~~~

Se espera UNDECLARED_IDENTIFIER en la línea 6. secreto solo existe en el ámbito de primera. Mensaje: El identificador 'secreto' se usa antes de declararse.

**6. Tipo de retorno incompatible**

~~~text
tarea codigo(): entero {
  resultado 7;
}
guarda mensaje: texto = codigo();
~~~

Se espera TYPE_MISMATCH en la línea 4: la tarea devuelve un entero, pero mensaje requiere texto. Mensaje: La variable 'mensaje' es string, pero recibe integer.

**7. Tipo de argumento incompatible**

~~~text
tarea duplicar(x: entero): entero {
  resultado x * 2;
}
guarda valor = duplicar(5.8);
~~~

Se espera TYPE_MISMATCH en la línea 4: el argumento real es decimal y el parámetro exige entero. Mensaje: El argumento 1 de 'duplicar' debe ser integer, no decimal.

**8. Cantidad incorrecta de argumentos**

~~~text
tarea sumar(a: entero, b: entero): entero {
  resultado a + b;
}
guarda valor = sumar(1, 2, 3);
~~~

Se espera ARGUMENT_COUNT_MISMATCH en la línea 4 porque la firma declarada tiene dos parámetros. Mensaje: La tarea 'sumar' no tiene una sobrecarga con 3 argumento(s). Firmas disponibles: 2.

**9. Overflow**

Overflow detectable durante el análisis:

~~~text
guarda maximo = 2147483647;
maximo = maximo + 1;
~~~

Se espera INTEGER_OVERFLOW en la línea 2. El analizador puede resolver la expresión porque el valor inicial de maximo es conocido. Mensaje: Overflow: el entero '2147483648' está fuera del rango int32 (-2147483648 a 2147483647).

Overflow dependiente de un valor de ejecución:

~~~text
tarea eleva(base: entero): real {
  resultado base ** 10;
}
guarda salida = eleva(100000);
impresora(salida);
~~~

El análisis semántico acepta el cálculo según sus tipos. Al ejecutar, el valor excede int32 y el intérprete muestra INTEGER_OVERFLOW con la línea y la columna de la operación. Mensaje: Overflow: el resultado '1e+50' excede el rango numérico int32.

### 13.6 Ejemplo de análisis semántico línea por línea

Este programa no produce errores semánticos y puede ejecutarse en modo Flexible o Estricto:

~~~text
guarda limite: entero = 10;
guarda base: entero = 3;
tarea multiplicar(a: entero, b: entero): entero {
  resultado a * b;
}
guarda valor = multiplicar(base, 2);
si (valor <= limite) {
  impresora(...Resultado dentro del límite..., valor);
}
~~~

La salida es Resultado dentro del límite 6. La tabla semántica muestra limite, base, multiplicar y valor.

| Línea | Análisis que realiza el analizador semántico |
| ---: | --- |
| 1 | visitDeclaration evalúa el literal 10, compara su tipo con la anotación entero y declara limite como inicializada en el ámbito global. |
| 2 | visitDeclaration hace lo mismo con base y registra el valor inicial conocido 3 para análisis de constantes. |
| 3 | La firma multiplicar(a: entero, b: entero): entero queda registrada con aridad 2 y tipos de parámetros. visitFunction crea un ámbito local para a y b. |
| 4 | checkIdentifier resuelve los dos parámetros locales y registra sus lecturas. checkArithmeticTypes comprueba que la multiplicación acepte los tipos enteros. resultado añade el tipo de retorno inferido, entero. |
| 5 | Al cerrar la tarea, el analizador verifica que el retorno inferido sea compatible con la anotación entero y elimina el ámbito local de parámetros. |
| 6 | visitExpression resuelve multiplicar, valida los dos argumentos contra la firma y obtiene entero como tipo de retorno. visitDeclaration crea valor con ese tipo y marca que ya tiene valor. |
| 7 | visitIf revisa la comparación valor <= limite; ambos nombres están declarados y son enteros, por lo que la expresión produce booleano. |
| 8 | visitOutput analiza cada expresión. La lectura de valor confirma que está declarado e inicializado e incrementa su contador de uso. |
| 9 | La llave cierra el bloque de si. El ámbito del bloque se descarta. Al final, ninguna variable queda sin inicializar ni sin usar. |

### 13.7 Dónde está cada comprobación en el código

El código principal del análisis semántico está en src/core/semantic/SemanticAnalyzer.ts.

| Construcción fuente | Función del analizador | Trabajo que realiza |
| --- | --- | --- |
| Declaración guarda/fijo | visitDeclaration y declare | Calcula tipo inicial, verifica anotación, inserta el símbolo y detecta duplicados. |
| Lectura de un nombre | checkIdentifier | Busca en los ámbitos de adentro hacia afuera, aumenta uso y detecta no declarado/sin inicializar. |
| Operación binaria | visitBinary y checkArithmeticTypes | Comprueba tipos de operandos y tipo resultante; para expresiones constantes detecta overflow. |
| Asignación | visitAssignment | Busca destino, rechaza constantes, compara tipos y actualiza estado de inicialización. |
| Bloque par | visitParallel | Analiza primero valores de la derecha, valida destinos y después actualiza tipos/estado. |
| Condiciones y bucles | visitIf, visitFor, visitWhile, visitForEach | Administra el ámbito del bloque/bucle y valida el tipo iterable de para_cada. |
| Firma y cuerpo de tarea | registerFunction, visitFunction | Registra aridad/tipos, crea ámbito de parámetros e infiere o verifica retorno. |
| Fin del análisis | recorrido de declaraciones | Emite warnings de variables/tareas no usadas, variables no inicializadas y código inalcanzable. |

El analizador usa una pila de ámbitos implementada con mapas. resolve recorre desde el ámbito más interno hacia el global; esa tabla de búsqueda es la LUT semántica. Se guardan tipo, mutabilidad, estado de inicialización, número de lecturas y firmas para no tener que recalcular toda esa información cada vez.

## 14. Correcciones sugeridas y actividad extra de IA

La aplicación muestra sugerencias para errores léxicos, sintácticos y semánticos. Las propuestas actuales son heurísticas deterministas, no respuestas de un modelo generativo:

- Para un decimal mal formado, propone conservar un solo punto.
- Para texto o comentario sin cerrar, propone insertar un delimitador.
- Para algunos errores sintácticos, propone insertar ;, ) o }.
- Para errores semánticos, muestra el mensaje y una sugerencia de código; normalmente no modifica la fuente automáticamente.

Las sugerencias insertables se pueden aplicar desde la interfaz y se debe volver a analizar el programa. La integración de un modelo generativo tipo BERT/RoBERTa y los dos casos de autocorrección pedidos como actividad extra no están implementados en esta versión. No presentes las heurísticas como IA generativa.

## 15. Errores léxicos y sintácticos

### Errores léxicos comunes

- Carácter no reconocido.
- Decimal con varios puntos o formato inválido.
- Texto sin delimitador de tres puntos de cierre.
- Comentario :) ... :( o /* ... */ sin cierre.
- Entrada mayor a 100,000 caracteres.

El lexer muestra línea y columna y detiene el análisis léxico al primer error.

### Errores sintácticos comunes

- Falta ;, ), }, o un identificador.
- Falta una expresión después de =.
- Falta una de las partes de la cabecera de bucle_por.
- resultado aparece fuera de una tarea.
- Una instrucción empieza con un token que no puede iniciar sentencia.

El parser informa línea y columna, token recibido y token esperado. Después de algunos errores intenta sincronizarse en el final de sentencia o en otra instrucción para localizar errores adicionales.

## 16. Arquitectura y API del núcleo

El núcleo TypeScript está separado de la interfaz Vue:

| Archivo | Responsabilidad |
| --- | --- |
| src/core/automaton/FiniteAutomaton.ts | Autómata finito determinista y análisis léxico. |
| src/core/language/Language.ts | Mapa de palabras reservadas y delimitadores. |
| src/core/tokens/TokenType.ts | Tipos de token reconocidos. |
| src/core/parser/Parser.ts | Parser de descenso recursivo y creación del AST. |
| src/core/parser/Ast.ts | Nodos del programa, sentencias y expresiones. |
| src/core/semantic/SemanticAnalyzer.ts | Tabla de símbolos, ámbitos, tipos, errores y warnings. |
| src/core/runtime/Interpreter.ts | Evaluador del AST, salida, rangos y diagnósticos runtime. |
| src/core/suggestions/CorrectionSuggestion.ts | Sugerencias deterministas para diagnósticos. |

Funciones disponibles para otros módulos TypeScript:

### analyzeSource(source)

Analiza el código con el autómata y devuelve tokens, tabla léxica, errores y comentarios. El límite actual de fuente es 100,000 caracteres.

~~~ts
const lexical = analyzeSource('guarda x = 2;')
~~~

### createFiniteAutomaton(source)

Crea una instancia incremental del AFD. Expone el estado/posición actual, step(), tokenize(), result() y subscribe(listener). La interfaz usa los eventos para mostrar el recorrido paso a paso.

### parseTokens(tokens, symbolTable)

Consume los tokens y la tabla léxica; devuelve { ast, errors }.

~~~ts
const parsed = parseTokens(lexical.tokens, lexical.symbolTable)
~~~

### analyzeSemantics(program, options)

Devuelve { mode, errors, warnings, diagnostics, symbols, blocked }. options.mode puede ser permissive o strict; si se omite, usa permissive. options.warningsEnabled controla si se generan y muestran warnings; por defecto es true.

~~~ts
const semantic = analyzeSemantics(parsed.ast, { mode: 'permissive', warningsEnabled: true })
~~~

### interpret(program, options)

Ejecuta un AST y devuelve { outputs, diagnostics, globals, steps }. Se puede proveer texto de entrada mediante inputProvider, precargar valores con inputValues y cambiar el límite de pasos con maxSteps.

~~~ts
const result = interpret(parsed.ast, {
  inputValues: ['Ana'],
  maxSteps: 20_000,
})
~~~

### Sugerencias

buildCorrectionSuggestions(source, lexicalErrors, syntaxErrors, semanticDiagnostics) reúne propuestas. canApplySuggestion(suggestion) comprueba si una propuesta tiene reemplazo aplicable; applyCorrectionSuggestion(source, suggestion) devuelve el texto modificado.

## 17. Alcance y extensiones pendientes

No existe una lista universal de características que todo lenguaje deba implementar: el conjunto depende del uso. La versión actual combina tipos dinámicos con anotaciones opcionales, funciones, lambdas con cierres y currificación, clases con herencia simple, colecciones, control de flujo, errores, entrada/salida, rangos y asignación paralela. La biblioteca estándar de Python y su ecosistema de paquetes no forman parte del lenguaje.

## 18. Limitaciones actuales

- Las clases admiten herencia simple, instancias, campos, métodos, inicializadores y sobrescritura. Aún no hay herencia múltiple/MRO, interfaces, control de acceso, miembros estáticos, propiedades ni decoradores.
- Las colecciones admiten literales básicos, indexación, asignación por índice y comprensiones de lista. Aún no hay slicing, imports de archivos del usuario, generadores ni ejecución asíncrona real. Solo se pueden importar los cuatro módulos integrados documentados. `con` se limita a archivos abiertos con `abrir`; `abrir` usa archivos temporales en memoria y no accede al sistema de archivos local.
- Las funciones aún no admiten parámetros predeterminados, argumentos por nombre, `*args`/`**kwargs` ni anotaciones decoradoras. La currificación de tareas declaradas sí está disponible.
- `intentar`/`capturar`/`finalmente` y `lanzar` manejan errores generales como texto; no hay jerarquía de tipos de excepción.
- La sobrecarga de tareas se resuelve por número de argumentos, no por tipos.
- La currificación parcial crea cierres ejecutables, pero la sobrecarga ambigua se rechaza. Una lambda solo admite una expresión como cuerpo.
- Una tarea que no llega a resultado devuelve 0 en el intérprete.
- Las variables globales referidas desde funciones pueden aparecer como no declaradas en la pasada semántica; pasa valores con parámetros.
- Inf, Infinity y NaN se reconocen léxicamente pero no son valores numéricos fiables en el runtime.
- No hay conversión explícita de texto leído a número.
- ++/-- no son sentencias independientes fuera de la cabecera de bucle_por.
- El intérprete limita la ejecución a 20,000 pasos por defecto.
- La corrección generativa con IA es extra y no está implementada; las sugerencias visibles son deterministas.

## 19. Ejemplos correctos e incorrectos

Programa correcto:

~~~text
fijo minimo: entero = 0;
guarda edad: entero = 20;
tarea es_adulto(valor: entero): booleano {
  resultado valor >= 18;
}
si (es_adulto(edad)) {
  impresora(...Mayor de edad...);
}
~~~

Ejemplos de error o sintaxis no soportada:

~~~text
entero edad = 20;               // no es una declaración válida
print(...Hola...);              // no es la salida reservada
si edad > 18 { }                // falta el paréntesis de la condición
resultado 3;                    // resultado debe estar dentro de tarea
guarda activo = true;           // true no es literal; se interpreta como nombre
switch (opcion) { }             // switch/case no está implementado
~~~

Para ver los fragmentos de demostración por diagnóstico en un formato breve para exposición, consulta docs/actividad-1.md.

