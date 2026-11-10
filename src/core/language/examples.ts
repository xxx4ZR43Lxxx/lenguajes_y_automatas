import { advancedExamples } from './advancedExamples.ts'

export interface LanguageExample {
  title: string
  level: 'Básico' | 'Intermedio' | 'Avanzado'
  topic: string
  description: string
  source: string
}

/** Programas de muestra escritos para la sintaxis y el intérprete actuales. */
const starterExamples: LanguageExample[] = [
  { title: '01 · Hola, mundo', level: 'Básico', topic: 'Salida', description: 'La instrucción más sencilla.', source: `impresora(...Hola, mundo...);` },
  { title: '02 · Variables y tipos', level: 'Básico', topic: 'Variables', description: 'Declaraciones, tipos y actualización de valores.', source: `fijo IVA: real = 0.16;
guarda precio: real = 250;
guarda total: real = precio + precio * IVA;
impresora(...Precio con impuesto:..., total);` },
  { title: '03 · Operaciones y precedencia', level: 'Básico', topic: 'Aritmética', description: 'Aritmética, paréntesis y potencia.', source: `guarda resultado = (2 + 3) * 4 ** 2;
impresora(...Resultado:..., resultado);` },
  { title: '04 · Decisiones con si y sino', level: 'Básico', topic: 'Condiciones', description: 'Elige una rama con una comparación.', source: `guarda edad = 20;
si (edad >= 18) {
  impresora(...Eres mayor de edad...);
} sino {
  impresora(...Eres menor de edad...);
}` },
  { title: '05 · Condiciones lógicas', level: 'Intermedio', topic: 'Condiciones', description: 'Combina comparaciones con y.', source: `guarda edad = 22;
guarda tiene_credencial = 1 == 1;
si ((edad >= 18) y tiene_credencial) {
  impresora(...Acceso permitido...);
} sino {
  impresora(...Acceso denegado...);
}` },
  { title: '06 · Bucle mientras: cuenta regresiva', level: 'Básico', topic: 'Bucles', description: 'Repite mientras la condición siga siendo verdadera.', source: `guarda cuenta = 5;
bucle_mientras (cuenta > 0) {
  impresora(cuenta);
  cuenta = cuenta - 1;
}
impresora(...¡Despegue!...);` },
  { title: '07 · Bucle por: números pares', level: 'Básico', topic: 'Bucles', description: 'Inicialización, condición y actualización en la cabecera.', source: `bucle_por (guarda i = 0; i < 11; i = i + 2) {
  impresora(i);
}` },
  { title: '08 · Suma acumulada', level: 'Intermedio', topic: 'Bucles', description: 'Acumula los números del 1 al 10.', source: `guarda suma = 0;
bucle_por (guarda numero = 1; numero <= 10; numero++) {
  suma = suma + numero;
}
impresora(...La suma del 1 al 10 es..., suma);` },
  { title: '09 · Tabla de multiplicar', level: 'Intermedio', topic: 'Bucles', description: 'Un bucle genera la tabla del 7.', source: `fijo BASE = 7;
bucle_por (guarda i = 1; i <= 10; i++) {
  impresora(BASE, ...x..., i, ...=..., BASE * i);
}` },
  { title: '10 · Bucles anidados: tablero', level: 'Intermedio', topic: 'Bucles', description: 'Dos bucles recorren filas y columnas.', source: `bucle_por (guarda fila = 1; fila <= 3; fila++) {
  bucle_por (guarda columna = 1; columna <= 4; columna++) {
    impresora(...Fila..., fila, ...Columna..., columna);
  }
}` },
  { title: '11 · Función para saludar', level: 'Básico', topic: 'Tareas', description: 'Define una tarea con parámetro y valor de retorno.', source: `tarea crear_saludo(nombre: texto): texto {
  resultado ...Hola ... + nombre;
}
guarda saludo = crear_saludo(...Ada...);
impresora(saludo);` },
  { title: '12 · Currificación: suma en tres pasos', level: 'Avanzado', topic: 'Currificación', description: 'Encadena grupos de argumentos; completa la aridad de la tarea.', source: `tarea sumar_tres(a: entero, b: entero, c: entero): entero {
  resultado a + b + c;
}
guarda total = sumar_tres(10)(20)(12);
impresora(...10 + 20 + 12 =..., total);` },
  { title: '13 · Factorial recursivo', level: 'Avanzado', topic: 'Recursión', description: 'Una tarea se llama a sí misma hasta llegar al caso base.', source: `tarea factorial(n: entero): entero {
  si (n <= 1) {
    resultado 1;
  } sino {
    resultado n * factorial(n - 1);
  }
}
impresora(...Factorial de 6:..., factorial(6));` },
  { title: '14 · Sobrecarga por cantidad de parámetros', level: 'Avanzado', topic: 'Tareas', description: 'Elige una tarea según el número de argumentos.', source: `tarea presentar(nombre: texto): texto {
  resultado ...Hola ... + nombre;
}
tarea presentar(nombre: texto, ciudad: texto): texto {
  resultado ...Hola ... + nombre + ... desde ... + ciudad;
}
impresora(presentar(...Luz...));
impresora(presentar(...Luz..., ...Mérida...));` },
  { title: '15 · Intercambio paralelo', level: 'Avanzado', topic: 'Asignación', description: 'Intercambia dos variables con asignación simultánea.', source: `guarda izquierda = 12;
guarda derecha = 34;
par {
  izquierda = derecha, derecha = izquierda;
}
impresora(...Izquierda:..., izquierda, ...Derecha:..., derecha);` },
  { title: '16 · Operaciones con rangos', level: 'Intermedio', topic: 'Rangos', description: 'Transforma un intervalo numérico completo.', source: `guarda temperaturas: rango = [18,...,24];
guarda fahrenheit: rango = temperaturas * 1.8 + 32;
impresora(...Rango Fahrenheit:..., fahrenheit);` },
  { title: '17 · Funciones matemáticas', level: 'Intermedio', topic: 'Matemáticas', description: 'Usa funciones integradas con sus nombres españoles.', source: `guarda cateto_a = 3;
guarda cateto_b = 4;
guarda hipotenusa = raiz_cuadrada(potencia(cateto_a, 2) + potencia(cateto_b, 2));
impresora(...Hipotenusa:..., hipotenusa);
impresora(...Valor absoluto:..., valor_absoluto(-15));` },
  { title: '18 · Números primos', level: 'Avanzado', topic: 'Bucles y condiciones', description: 'Busca divisores con un bucle y una condición.', source: `fijo NUMERO = 29;
guarda es_primo = 1 == 1;
bucle_por (guarda divisor = 2; divisor < NUMERO; divisor++) {
  si (NUMERO entre divisor == 0) {
    es_primo = 1 == 0;
  }
}
si (es_primo) {
  impresora(NUMERO, ...es primo...);
} sino {
  impresora(NUMERO, ...no es primo...);
}` },
  { title: '19 · Entrada por teclado', level: 'Básico', topic: 'Entrada y salida', description: 'Pide un nombre y construye un saludo.', source: `guarda nombre = pregunta(...¿Cómo te llamas?...);
impresora(...¡Hola, ... + nombre + ...!...);` },
  { title: '20 · Secuencia de Collatz', level: 'Avanzado', topic: 'Bucles y condiciones', description: 'Combina mientras, si/sino y operaciones aritméticas.', source: `guarda numero = 13;
bucle_mientras (numero > 1) {
  impresora(numero);
  si (numero entre 2 == 0) {
    numero = numero entre 2;
  } sino {
    numero = numero * 3 + 1;
  }
}
impresora(numero);` },
  { title: '21 · Colecciones e iteración', level: 'Intermedio', topic: 'Colecciones', description: 'Declara una lista, actualiza un índice y la recorre con para_cada.', source: `guarda valores: lista = [2, 4, 6];
valores[1] = 5;
guarda suma = 0;
para_cada (valor en valores) {
  suma += valor;
}
impresora(...Valores:..., valores, ...suma:..., suma, ...cantidad:..., longitud(valores));` },
  { title: '22 · Transformar una colección con lambda', level: 'Avanzado', topic: 'Lambdas y colecciones', description: 'Pasa una lambda a transformar y suma los resultados.', source: `guarda valores = [1, 2, 3, 4];
guarda duplicados = transformar(lambda(x: entero) => x * 2, valores);
impresora(duplicados);
impresora(...Suma:..., sumatoria(duplicados));` },
  { title: '23 · Manejo de errores', level: 'Intermedio', topic: 'Errores', description: 'Lanza un error del lenguaje, lo captura y ejecuta finalmente.', source: `intentar {
  lanzar ...dato inválido...;
} capturar (error) {
  impresora(...Error capturado:..., error);
} finalmente {
  impresora(...Fin del intento...);
}` },
  { title: '24 · Selección de casos', level: 'Intermedio', topic: 'Control de flujo', description: 'Elige el primer patrón coincidente; _ funciona como caso predeterminado.', source: `guarda estado = 2;
seleccionar (estado) {
  caso 1 { impresora(...Nuevo...); }
  caso 2 { impresora(...En proceso...); }
  caso _ { impresora(...Desconocido...); }
}` },
  { title: '25 · Comprensión de lista', level: 'Avanzado', topic: 'Colecciones', description: 'Construye una lista transformada y filtrada en una sola expresión.', source: `guarda numeros = secuencia(1, 11);
guarda cuadrados_pares = [numero * numero para_cada numero en numeros si numero modulo 2 == 0];
impresora(cuadrados_pares);` },
]

export const languageExamples: LanguageExample[] = [...starterExamples, ...advancedExamples]
