import type { LanguageExample } from './examples.ts'

export const advancedExamples: LanguageExample[] = [
  { title: '21 · Algoritmo de Euclides', level: 'Avanzado', topic: 'Algoritmos', description: 'Calcula el máximo común divisor con bucle mientras.', source: `guarda a = 252;
guarda b = 105;
bucle_mientras (a != b) {
  si (a > b) {
    a = a - b;
  } sino {
    b = b - a;
  }
}
impresora(...MCD:..., a);` },
  { title: '22 · Mínimo común múltiplo', level: 'Avanzado', topic: 'Tareas y algoritmos', description: 'Combina una tarea auxiliar con el algoritmo de Euclides.', source: `tarea mcd(x: entero, y: entero): entero {
  bucle_mientras (x != y) {
    si (x > y) {
      x = x - y;
    } sino {
      y = y - x;
    }
  }
  resultado x;
}
guarda primero = 84;
guarda segundo = 30;
guarda comun = (primero * segundo) entre mcd(primero, segundo);
impresora(...MCM:..., comun);` },
  { title: '23 · Fibonacci iterativo', level: 'Avanzado', topic: 'Bucles', description: 'Genera los primeros 15 valores actualizando dos variables.', source: `guarda anterior = 0;
guarda actual = 1;
bucle_por (guarda i = 0; i < 15; i++) {
  impresora(actual);
  par {
    anterior = actual, actual = anterior + actual;
  }
}` },
  { title: '24 · Factorial con acumulador', level: 'Avanzado', topic: 'Bucles', description: 'Calcula 12! sin recursión.', source: `guarda factorial = 1;
bucle_por (guarda i = 2; i <= 12; i++) {
  factorial = factorial * i;
}
impresora(...12! =..., factorial);` },
  { title: '25 · Fibonacci recursivo', level: 'Avanzado', topic: 'Recursión', description: 'Dos llamadas recursivas resuelven Fibonacci para un valor pequeño.', source: `tarea fibonacci(n: entero): entero {
  si (n <= 1) {
    resultado n;
  } sino {
    resultado fibonacci(n - 1) + fibonacci(n - 2);
  }
}
impresora(...Fibonacci(10):..., fibonacci(10));` },
  { title: '26 · Raíz cuadrada por Newton', level: 'Avanzado', topic: 'Métodos numéricos', description: 'Refina una aproximación mediante la fórmula de Newton.', source: `fijo NUMERO = 612;
guarda aproximacion: real = NUMERO / 2;
bucle_por (guarda paso = 0; paso < 12; paso++) {
  aproximacion = (aproximacion + NUMERO / aproximacion) / 2;
}
impresora(...Raíz aproximada:..., aproximacion);` },
  { title: '27 · Aproximación de pi', level: 'Avanzado', topic: 'Series', description: 'Suma 1,000 términos de la serie de Leibniz.', source: `guarda suma: real = 0;
guarda signo = 1;
guarda denominador = 1;
bucle_por (guarda i = 0; i < 1000; i++) {
  suma = suma + signo / denominador;
  signo = signo * -1;
  denominador = denominador + 2;
}
impresora(...Pi aproximado:..., suma * 4);` },
  { title: '28 · Integración numérica de x²', level: 'Avanzado', topic: 'Métodos numéricos', description: 'Aproxima el área bajo x² entre 0 y 3 con trapecios.', source: `fijo INTERVALOS = 1000;
fijo ANCHO = 3 / INTERVALOS;
guarda area: real = 0;
bucle_por (guarda i = 0; i < INTERVALOS; i++) {
  guarda izquierda = i * ANCHO;
  guarda derecha = izquierda + ANCHO;
  area = area + (izquierda ** 2 + derecha ** 2) * ANCHO / 2;
}
impresora(...Área aproximada:..., area);` },
  { title: '29 · Búsqueda binaria de raíz', level: 'Avanzado', topic: 'Métodos numéricos', description: 'Acota la raíz de 2 mediante 40 iteraciones de bisección.', source: `guarda bajo: real = 1;
guarda alto: real = 2;
bucle_por (guarda i = 0; i < 40; i++) {
  guarda medio = (bajo + alto) / 2;
  si (medio * medio > 2) {
    alto = medio;
  } sino {
    bajo = medio;
  }
}
impresora(...Raíz de 2:..., (bajo + alto) / 2);` },
  { title: '30 · Raíz cúbica por Newton', level: 'Avanzado', topic: 'Métodos numéricos', description: 'Calcula una raíz cúbica iterando sobre una función.', source: `fijo NUMERO = 125;
guarda x: real = 10;
bucle_por (guarda i = 0; i < 15; i++) {
  x = (2 * x + NUMERO / (x * x)) / 3;
}
impresora(...Raíz cúbica:..., x);` },
  { title: '31 · Distancia entre dos puntos', level: 'Intermedio', topic: 'Geometría', description: 'Aplica la fórmula euclidiana en el plano.', source: `guarda x1 = 2;
guarda y1 = 3;
guarda x2 = 8;
guarda y2 = 11;
guarda dx = x2 - x1;
guarda dy = y2 - y1;
guarda distancia = sqrt(dx ** 2 + dy ** 2);
impresora(...Distancia:..., distancia);` },
  { title: '32 · Área de triángulo con Herón', level: 'Avanzado', topic: 'Geometría', description: 'Valida los lados y calcula el área con la fórmula de Herón.', source: `guarda a = 13;
guarda b = 14;
guarda c = 15;
guarda semiperimetro = (a + b + c) / 2;
guarda area = sqrt(semiperimetro * (semiperimetro - a) * (semiperimetro - b) * (semiperimetro - c));
impresora(...Área:..., area);` },
  { title: '33 · Interés compuesto mensual', level: 'Avanzado', topic: 'Finanzas', description: 'Capitaliza el saldo cada mes durante tres años.', source: `guarda saldo = 10000;
fijo TASA_MENSUAL = 0.012;
bucle_por (guarda mes = 1; mes <= 36; mes++) {
  saldo = saldo + saldo * TASA_MENSUAL;
}
impresora(...Saldo final:..., saldo);` },
  { title: '34 · Pago mensual de un préstamo', level: 'Avanzado', topic: 'Finanzas', description: 'Usa la fórmula de anualidad para estimar un pago mensual.', source: `fijo CAPITAL = 250000;
fijo TASA = 0.015;
fijo MESES = 24;
guarda factor = pow(1 + TASA, MESES);
guarda pago = CAPITAL * TASA * factor / (factor - 1);
impresora(...Pago mensual:..., pago);` },
  { title: '35 · Suma de progresión aritmética', level: 'Avanzado', topic: 'Tareas', description: 'Calcula la suma de una progresión con una tarea reutilizable.', source: `tarea suma_progresion(inicio: entero, paso: entero, cantidad: entero): entero {
  guarda suma = 0;
  guarda termino = inicio;
  bucle_por (guarda i = 0; i < cantidad; i++) {
    suma = suma + termino;
    termino = termino + paso;
  }
  resultado suma;
}
impresora(...Suma:..., suma_progresion(3, 4, 20));` },
  { title: '36 · Serie geométrica', level: 'Avanzado', topic: 'Series', description: 'Suma potencias sucesivas de una razón geométrica.', source: `guarda suma: real = 0;
guarda termino: real = 1;
bucle_por (guarda i = 0; i < 20; i++) {
  suma = suma + termino;
  termino = termino * 0.5;
}
impresora(...Suma geométrica:..., suma);` },
  { title: '37 · Número armónico', level: 'Avanzado', topic: 'Series', description: 'Calcula H₁₀₀₀ mediante una suma acumulada.', source: `guarda armonico: real = 0;
bucle_por (guarda i = 1; i <= 1000; i++) {
  armonico = armonico + 1 / i;
}
impresora(...H(1000):..., armonico);` },
  { title: '38 · Aproximación de e', level: 'Avanzado', topic: 'Series y tareas', description: 'Suma la serie de Taylor de e usando factoriales.', source: `tarea factorial(n: entero): entero {
  si (n <= 1) {
    resultado 1;
  } sino {
    resultado n * factorial(n - 1);
  }
}
guarda e: real = 0;
bucle_por (guarda i = 0; i <= 10; i++) {
  e = e + 1 / factorial(i);
}
impresora(...e aproximado:..., e);` },
  { title: '39 · Aproximación de coseno', level: 'Avanzado', topic: 'Series y tareas', description: 'Aproxima cos(x) con términos alternados de Taylor.', source: `tarea factorial(n: entero): entero {
  si (n <= 1) {
    resultado 1;
  } sino {
    resultado n * factorial(n - 1);
  }
}
fijo X = 0.7;
guarda suma: real = 0;
guarda signo = 1;
bucle_por (guarda k = 0; k <= 6; k++) {
  guarda exponente = 2 * k;
  suma = suma + signo * pow(X, exponente) / factorial(exponente);
  signo = signo * -1;
}
impresora(...cos(x) aproximado:..., suma);` },
  { title: '40 · Clasificador de triángulos', level: 'Avanzado', topic: 'Condiciones', description: 'Clasifica un triángulo por sus lados después de validar la desigualdad triangular.', source: `guarda a = 8;
guarda b = 8;
guarda c = 5;
si ((a + b > c) y (a + c > b) y (b + c > a)) {
  si ((a == b) y (b == c)) {
    impresora(...Equilátero...);
  } sino {
    si ((a == b) o (a == c) o (b == c)) {
      impresora(...Isósceles...);
    } sino {
      impresora(...Escaleno...);
    }
  }
} sino {
  impresora(...No forma un triángulo...);
}` },
  { title: '41 · Índice de masa corporal', level: 'Intermedio', topic: 'Funciones y condiciones', description: 'Calcula el IMC y determina una categoría.', source: `tarea calcular_imc(peso: real, altura: real): real {
  resultado peso / (altura * altura);
}
guarda imc = calcular_imc(72, 1.75);
si (imc < 18.5) {
  impresora(...Bajo peso..., imc);
} sino {
  si (imc < 25) {
    impresora(...Rango saludable..., imc);
  } sino {
    impresora(...Sobrepeso..., imc);
  }
}` },
  { title: '42 · Precio con descuentos e impuesto', level: 'Avanzado', topic: 'Condiciones y aritmética', description: 'Aplica descuento por volumen y después calcula el impuesto.', source: `guarda unidades = 18;
guarda precio = 125;
guarda descuento: real = 0;
si (unidades >= 20) {
  descuento = 0.2;
} sino {
  si (unidades >= 10) {
    descuento = 0.1;
  }
}
guarda subtotal = unidades * precio * (1 - descuento);
guarda total = subtotal * 1.16;
impresora(...Total:..., total);` },
  { title: '43 · Nómina con horas extra', level: 'Intermedio', topic: 'Condiciones y bucles', description: 'Calcula el pago ordinario y duplica las horas extra.', source: `guarda horas = 47;
fijo PAGO_HORA = 85;
guarda pago = 0;
si (horas <= 40) {
  pago = horas * PAGO_HORA;
} sino {
  pago = 40 * PAGO_HORA + (horas - 40) * PAGO_HORA * 2;
}
impresora(...Pago semanal:..., pago);` },
  { title: '44 · Costo de envío por zonas', level: 'Intermedio', topic: 'Condiciones', description: 'Selecciona una tarifa según el peso del paquete.', source: `guarda peso = 8.5;
guarda costo: real = 0;
si (peso <= 1) {
  costo = 80;
} sino {
  si (peso <= 5) {
    costo = 130;
  } sino {
    costo = 130 + (peso - 5) * 18;
  }
}
impresora(...Envío:..., costo);` },
  { title: '45 · Transformación de rangos', level: 'Avanzado', topic: 'Rangos', description: 'Transforma el intervalo Celsius y calcula su producto con otro rango.', source: `guarda celsius: rango = [18,...,24];
guarda fahrenheit: rango = celsius * 1.8 + 32;
guarda objetivo: rango = [70,...,75];
impresora(...Fahrenheit:..., fahrenheit, ...Intervalo objetivo:..., objetivo);
impresora(...Producto de intervalos:..., fahrenheit * objetivo);` },
  { title: '46 · Rotación de tres valores', level: 'Avanzado', topic: 'Asignación paralela', description: 'Rota tres variables en una sola asignación simultánea.', source: `guarda primero = 10;
guarda segundo = 20;
guarda tercero = 30;
par {
  primero = segundo, segundo = tercero, tercero = primero;
}
impresora(primero, segundo, tercero);` },
  { title: '47 · Aplicación encadenada de cuatro argumentos', level: 'Avanzado', topic: 'Currificación', description: 'Combina cuatro grupos de argumentos en una llamada completa.', source: `tarea calcular_total(a: entero, b: entero, c: entero, d: entero): entero {
  resultado a + b + c + d;
}
guarda total = calcular_total(5)(10)(15)(20);
impresora(...Total:..., total);` },
  { title: '48 · Resumen con sobrecarga', level: 'Avanzado', topic: 'Sobrecarga', description: 'Usa dos firmas distintas para sumar dos o tres cantidades.', source: `tarea sumar(a: entero, b: entero): entero {
  resultado a + b;
}
tarea sumar(a: entero, b: entero, c: entero): entero {
  resultado a + b + c;
}
impresora(sumar(8, 13));
impresora(sumar(8, 13, 21));` },
  { title: '49 · Potencia mediante recursión', level: 'Avanzado', topic: 'Recursión', description: 'Eleva una base a un exponente entero no negativo.', source: `tarea potencia(base: entero, exponente: entero): entero {
  si (exponente == 0) {
    resultado 1;
  } sino {
    resultado base * potencia(base, exponente - 1);
  }
}
impresora(...3 elevado a 8:..., potencia(3, 8));` },
  { title: '50 · MCD recursivo', level: 'Avanzado', topic: 'Recursión', description: 'Implementa el algoritmo de Euclides con llamadas recursivas.', source: `tarea mcd(a: entero, b: entero): entero {
  si (a == b) {
    resultado a;
  } sino {
    si (a > b) {
      resultado mcd(a - b, b);
    } sino {
      resultado mcd(a, b - a);
    }
  }
}
impresora(mcd(1071, 462));` },
  { title: '51 · Suma recursiva hasta n', level: 'Avanzado', topic: 'Recursión', description: 'Suma los enteros positivos hasta n recursivamente.', source: `tarea suma_hasta(n: entero): entero {
  si (n <= 0) {
    resultado 0;
  } sino {
    resultado n + suma_hasta(n - 1);
  }
}
impresora(suma_hasta(100));` },
  { title: '52 · Triangular recursivo', level: 'Avanzado', topic: 'Recursión', description: 'Calcula el número triangular número 25.', source: `tarea triangular(n: entero): entero {
  si (n <= 1) {
    resultado n;
  } sino {
    resultado n + triangular(n - 1);
  }
}
impresora(triangular(25));` },
  { title: '53 · Reloj de arena con bucles anidados', level: 'Avanzado', topic: 'Bucles anidados', description: 'Imprime filas de distinta longitud usando dos bucles.', source: `bucle_por (guarda fila = 1; fila <= 5; fila++) {
  bucle_por (guarda columna = 1; columna <= fila; columna++) {
    impresora(...*...);
  }
}
bucle_por (guarda fila_inversa = 4; fila_inversa > 0; fila_inversa--) {
  bucle_por (guarda columna_inversa = 1; columna_inversa <= fila_inversa; columna_inversa++) {
    impresora(...*...);
  }
}` },
  { title: '54 · Conteo de números primos', level: 'Avanzado', topic: 'Tareas y bucles', description: 'Prueba la divisibilidad y cuenta los primos entre 2 y 50.', source: `tarea es_primo(n: entero): booleano {
  guarda primo = 1 == 1;
  bucle_por (guarda divisor = 2; divisor < n; divisor++) {
    si (n - (n entre divisor) * divisor == 0) {
      primo = 1 == 0;
    }
  }
  resultado primo;
}
guarda cantidad = 0;
bucle_por (guarda candidato = 2; candidato <= 50; candidato++) {
  si (es_primo(candidato)) {
    cantidad = cantidad + 1;
    impresora(candidato);
  }
}
impresora(...Cantidad:..., cantidad);` },
  { title: '55 · Error semántico: identificador inexistente', level: 'Avanzado', topic: 'Error intencional · UNDECLARED_IDENTIFIER', description: 'El análisis debe marcar que fantasma nunca fue declarado.', source: `guarda total = fantasma + 10;
impresora(total);` },
  { title: '56 · Error semántico: sumar texto y número', level: 'Avanzado', topic: 'Error intencional · TYPE_MISMATCH', description: 'Intenta sumar tipos incompatibles.', source: `guarda mensaje = ...saldo: ... + 250;
impresora(mensaje);` },
  { title: '57 · Error semántico: tarea desconocida', level: 'Avanzado', topic: 'Error intencional · UNKNOWN_FUNCTION', description: 'Llama a una función que no existe en el lenguaje.', source: `guarda valor = elevar_magicamente(2, 8);
impresora(valor);` },
  { title: '58 · Error semántico: cantidad de argumentos', level: 'Avanzado', topic: 'Error intencional · ARGUMENT_COUNT_MISMATCH', description: 'La tarea espera dos argumentos y recibe uno.', source: `tarea multiplicar(a: entero, b: entero): entero {
  resultado a * b;
}
impresora(multiplicar(7));` },
  { title: '59 · Error semántico: variable declarada dos veces', level: 'Avanzado', topic: 'Error intencional · DUPLICATE_DECLARATION', description: 'Declara el mismo nombre dos veces en el mismo ámbito.', source: `guarda dato = 1;
guarda dato = 2;
impresora(dato);` },
  { title: '60 · Error semántico: reasignar constante', level: 'Avanzado', topic: 'Error intencional · IMMUTABLE_ASSIGNMENT', description: 'fijo no permite cambiar el valor después de declararse.', source: `fijo LIMITE = 100;
LIMITE = 200;
impresora(LIMITE);` },
  { title: '61 · Error semántico: condición numérica', level: 'Intermedio', topic: 'Error intencional · NON_BOOLEAN_CONDITION', description: 'La condición de si debe ser booleana.', source: `si (42) {
  impresora(...Esto no debe ejecutarse...);
}` },
  { title: '62 · Error semántico: operandos lógicos numéricos', level: 'Avanzado', topic: 'Error intencional · INVALID_LOGICAL_OPERAND', description: 'El operador y requiere operandos booleanos.', source: `guarda resultado = 5 y 2;
impresora(resultado);` },
  { title: '63 · Warning semántico y error runtime: variable sin inicializar', level: 'Intermedio', topic: 'Error intencional · UNINITIALIZED_VARIABLE', description: 'El análisis advierte que se lee antes de asignar; al ejecutar, falla.', source: `guarda pendiente: entero;
impresora(pendiente);` },
  { title: '64 · Warning semántico: variable nunca utilizada', level: 'Intermedio', topic: 'Error intencional · UNUSED_VARIABLE', description: 'No es error fatal: muestra el warning de variable no utilizada.', source: `guarda calculo_sin_usar = 99;
impresora(...Revisa el panel semántico...);` },
  { title: '65 · Error semántico: overflow entero', level: 'Avanzado', topic: 'Error intencional · INTEGER_OVERFLOW', description: 'El literal rebasa el límite superior de int32.', source: `guarda demasiado_grande = 2147483648;
impresora(demasiado_grande);` },
  { title: '66 · Error sintáctico: falta punto y coma', level: 'Intermedio', topic: 'Error intencional · Sintaxis', description: 'La declaración no termina con punto y coma.', source: `guarda resultado = 10
impresora(resultado);` },
  { title: '67 · Error sintáctico: bloque sin cerrar', level: 'Intermedio', topic: 'Error intencional · Sintaxis', description: 'Falta cerrar el bloque de la condición.', source: `si (5 > 2) {
  impresora(...Entró al bloque...);` },
  { title: '68 · Error léxico: carácter no permitido', level: 'Avanzado', topic: 'Error intencional · Léxico', description: 'El símbolo @ no forma parte de los tokens admitidos.', source: `guarda correo = @usuario;
impresora(correo);` },
  { title: '69 · Error semántico: destino duplicado en par', level: 'Avanzado', topic: 'Error intencional · PARALLEL_TARGET_DUPLICATE', description: 'Una asignación paralela no puede escribir dos veces el mismo destino.', source: `guarda saldo = 100;
par {
  saldo = 80, saldo = 90;
}` },
  { title: '70 · Error de ejecución: división por cero', level: 'Avanzado', topic: 'Error intencional · RUNTIME_ERROR', description: 'Los tipos son válidos, pero el divisor vale cero al ejecutar.', source: `impresora(25 entre 0);` },
  { title: '71 · Herencia y sobrescritura', level: 'Avanzado', topic: 'Clases', description: 'Hereda campos e inicializador y sobrescribe un método con despacho dinámico.', source: [
    'clase Animal {',
    '  guarda nombre: texto;',
    '  tarea inicia(nombre: texto) {',
    '    este.nombre = nombre;',
    '  }',
    '  tarea sonido(): texto {',
    '    resultado ...sonido genérico de ... + este.nombre;',
    '  }',
    '}',
    'clase Perro hereda Animal {',
    '  tarea sonido(): texto {',
    '    resultado ...guau...;',
    '  }',
    '}',
    'guarda animal = nuevo Animal(...Toby...);',
    'guarda mascota = nuevo Perro(...Nube...);',
    'impresora(animal.sonido(), mascota.nombre, mascota.sonido());',
  ].join('\n') },
  { title: '72 · Lambda con aplicación parcial', level: 'Intermedio', topic: 'Lambdas y currificación', description: 'Guarda una lambda y fija el primer argumento para crear una función especializada.', source: [
    'guarda multiplicar = lambda(x: entero, y: entero) => x * y;',
    'guarda por_tres = multiplicar(3);',
    'impresora(por_tres(4));',
  ].join('\n') },
  { title: '73 · Warning: tarea no utilizada', level: 'Intermedio', topic: 'Warning · UNUSED_FUNCTION', description: 'El análisis avisa que la tarea auxiliar nunca se llama.', source: [
    'tarea auxiliar(): entero {',
    '  resultado 42;',
    '}',
    'impresora(...Revisa el warning de tarea no utilizada...);',
  ].join('\n') },
  { title: '74 · Warning: código inalcanzable', level: 'Intermedio', topic: 'Warning · UNREACHABLE_CODE', description: 'La publicación posterior a resultado no puede ejecutarse.', source: [
    'tarea duplicar(x: entero): entero {',
    '  resultado x * 2;',
    '  impresora(...Esta línea es inalcanzable...);',
    '}',
    'impresora(duplicar(4));',
  ].join('\n') },
]
