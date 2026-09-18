# Liquidación de servicios de la vivienda

Este archivo es la **fuente de la verdad** del procedimiento de liquidación. Describe cómo se reparte el recibo de la casa entre los pisos. Lo que aquí esté escrito es la regla; el código deberá seguirlo, no al revés.

La casa tiene **3 pisos**. Si en el futuro hubiera otra cantidad, todas las divisiones “entre 3” usan el número de pisos `n`.

- Piso 1 y Piso 2 tienen contador de energía y de agua.
- Piso 3 no tiene contador: su consumo es el del recibo menos Piso 1 menos Piso 2.
- El alcantarillado no tiene contador. Cada piso usa los mismos m³ que en agua.

La empresa cobra **una sola cuenta de la vivienda**, no una cuenta por piso. Esa cuenta trae:

1. Un bloque de consumo **subsidiado** (más barato): los primeros 173 kWh de energía y los primeros 16 m³ de acueducto y alcantarillado de toda la casa.
2. El consumo **por encima de ese bloque** (tarifa plena).
3. Cargos que no son consumo: cargo básico, interés de mora, otros cobros, mínimo vital, ajuste al peso, y el subtotal de otros servicios + alumbrado público (AP).

La liquidación convierte esa cuenta única en un cobro por piso. La regla de justicia es esta:

- El bloque subsidiado de la casa se **reparte en partes iguales** entre los pisos. Cada piso tiene derecho a `173 / n` kWh y a `16 / n` m³ a tarifa baja.
- Lo que un piso consuma **por encima de su cupo** se cobra a tarifa plena. Así un piso de alto consumo no se queda con el subsidio de los demás.
- Los renglones que no son consumo se **parten por igual** entre los pisos: son de la cuenta de la casa, no de un contador. Eso incluye mora, cargos fijos, mínimo vital, ajuste al peso y el subtotal de otros servicios + alumbrado público.

---

## Paso 1 — Consumo del período

Se toman las lecturas **aprobadas** de cada contador y se calcula el consumo del período:

```text
consumo_piso = lectura_actual_aprobada − lectura_anterior_aprobada
```

- Energía y agua de Piso 1 y Piso 2: según su contador.
- Energía de Piso 3: `total_kWh_del_recibo − energía_piso_1 − energía_piso_2`.
- Agua de Piso 3: `total_m³_del_recibo − agua_piso_1 − agua_piso_2`.
- Alcantarillado de cada piso: **igual al agua** de ese mismo piso.

El total de energía en kWh y el total de agua en m³ del recibo son los mismos valores que más adelante se usan para obtener los precios unitarios.

Si el consumo del Piso 3 sale negativo, las lecturas o el total del recibo no cuadran y **no se liquida**.

Este paso ya lo cubre la aplicación.

---

## Paso 2 — Datos en dinero del recibo

Del PDF se copian renglones **en pesos**. No se inventan: se transcriben.

### Energía

| Renglón | Qué es | Dónde se usa |
| --- | --- | --- |
| Consumo básico hasta 173 kWh | Dinero de los 173 kWh subsidiados de la casa | Precio unitario subsidiado de energía |
| Consumo mayor al básico | Dinero de los kWh por encima de 173 | Precio unitario estándar de energía |
| Interés de mora | Mora de la cuenta | Otros de energía |
| Otros cobros | Cargos varios de energía | Otros de energía |
| Ajuste al peso | Redondeo; puede ser negativo | Otros de energía |

### Agua

| Renglón | Qué es | Dónde se usa |
| --- | --- | --- |
| Cargo básico | Cargo fijo de la cuenta de agua | Otros de acueducto y alcantarillado |
| Consumo básico hasta 16 | Dinero de los 16 m³ subsidiados de agua | Precio unitario subsidiado de acueducto y alcantarillado |
| Consumo mayor al básico | Dinero del agua por encima de 16 m³ | Precio unitario estándar de acueducto y alcantarillado |
| Mínimo vital | Crédito de la cuenta de agua; suele ser negativo | Otros de acueducto y alcantarillado |
| Interés de mora | Mora de agua | Otros de acueducto y alcantarillado |
| Ajuste al peso | Redondeo de agua; puede ser negativo | Otros de acueducto y alcantarillado |

### Alcantarillado

| Renglón | Qué es | Dónde se usa |
| --- | --- | --- |
| Cargo básico | Cargo fijo de alcantarillado | Otros de acueducto y alcantarillado |
| Consumo básico hasta 16 | Dinero de los 16 m³ subsidiados de alcantarillado | Precio unitario subsidiado de acueducto y alcantarillado |
| Consumo mayor al básico 16 | Dinero del alcantarillado por encima de 16 m³ | Precio unitario estándar de acueducto y alcantarillado |
| Interés de mora | Mora de alcantarillado | Otros de acueducto y alcantarillado |
| Ajuste al peso | Redondeo de alcantarillado; puede ser negativo | Otros de acueducto y alcantarillado |

El alcantarillado **no trae mínimo vital**. Ese renglón solo existe en agua.

Agua y alcantarillado se tratan juntos a partir del paso siguiente: cada m³ de agua implica un m³ de alcantarillado, así que un solo consumo en m³ debe llevar el costo de los dos servicios.

### Toda la vivienda

Además de los renglones por servicio, el recibo trae **un solo valor para toda la casa**:

| Renglón | Qué es | Dónde se usa |
| --- | --- | --- |
| Subtotal otros servicios + AP | Importe único de la vivienda. AP significa alumbrado público. | Se divide entre `n` y se suma al cobro de cada piso |

No se parte por servicio ni por contador. Se transcribe tal como aparece en el recibo.

Este paso ya lo cubre la aplicación.

---

## Paso 3 — Seis cifras resumen

Con los renglones del paso 2 y los totales de consumo del recibo se obtienen seis cifras. Las cuatro primeras son **precios**. Las dos de “Otros” ya quedan **por piso** (divididas entre `n`) y no se vuelven a dividir.

`n` es el número de pisos. Hoy `n = 3`.

### Energía

```text
Total energía
  = Consumo básico hasta 173 kWh
  + Consumo mayor al básico
  + Interés de mora
  + Otros cobros
  + Ajuste al peso

Precio unitario con subsidio ($/kWh)
  = (Consumo básico hasta 173 kWh) / 173

Precio unitario estándar ($/kWh)
  = (Consumo mayor al básico) / (Consumo_kWh_del_recibo − 173)

Otros energía (valor por piso)
  = (Interés de mora + Otros cobros + Ajuste al peso) / n
```

El precio subsidiado es lo que costó cada uno de los 173 kWh baratos de la casa. El precio estándar es lo que costó cada kWh por encima de 173. “Otros” reúne lo que no es consumo y lo parte en partes iguales.

### Acueducto y alcantarillado

```text
Total agua
  = suma de todos los renglones en pesos del agua

Total alcantarillado
  = suma de todos los renglones en pesos del alcantarillado

Precio unitario hasta 16 ($/m³)
  = (Consumo básico hasta 16 del agua
     + Consumo básico hasta 16 del alcantarillado) / 16

Precio unitario estándar ($/m³)
  = (Consumo mayor al básico del agua
     + Consumo mayor al básico del alcantarillado)
    / (Consumo_m³_del_recibo − 16)

Otros acueducto y alcantarillado (valor por piso)
  = (Cargo básico agua
     + Cargo básico alcantarillado
     + Interés de mora agua
     + Interés de mora alcantarillado
     + Ajuste al peso agua
     + Ajuste al peso alcantarillado
     + Mínimo vital agua) / n
```

Los dos renglones “consumo básico hasta 16” se suman porque esos 16 m³ de la casa pagaron agua **y** alcantarillado a tarifa baja. Los dos “consumo mayor al básico” se suman por la misma razón, a tarifa plena. Un solo precio por m³ cubre los dos servicios.

Los totales de energía, agua y alcantarillado no se aplican al piso. Son la suma de control de lo que salió del recibo.

El subtotal de otros servicios + AP no entra en estas seis cifras. Se aplica después, en el cobro de cada piso, partido entre `n`.

### Las seis cifras

| # | Cifra | Unidad | Cómo entra en el cobro de cada piso |
| --- | --- | --- | --- |
| 1 | Precio unitario de energía hasta 173 | $/kWh | Sobre los kWh del piso que no superan `173 / n` |
| 2 | Precio unitario de energía estándar | $/kWh | Sobre los kWh del piso que superan `173 / n` |
| 3 | Otros de energía | $ por piso | Se suma tal cual al costo de energía |
| 4 | Precio unitario de acueducto y alcantarillado hasta 16 | $/m³ | Sobre los m³ del piso que no superan `16 / n` |
| 5 | Precio unitario de acueducto y alcantarillado estándar | $/m³ | Sobre los m³ del piso que superan `16 / n` |
| 6 | Otros de acueducto y alcantarillado | $ por piso | Se suma tal cual al costo de agua y alcantarillado |

---

## Paso 4 — Precios por piso (cobro)

Con las seis cifras y el consumo particular de cada piso se calculan **tres costos**. Su suma es lo que ese piso debe pagar.

Topes por piso (con `n = 3`):

```text
tope_energía = 173 / n     →  173 / 3 kWh
tope_agua    = 16 / n      →  16 / 3 m³
```

En las fórmulas, “consumo igual o menor al tope” es la parte del consumo del piso que cabe en su cupo. “Consumo del piso menos el tope” es la parte que se pasó del cupo. Si el piso no llega al tope, esa segunda parte es cero: no se cobra tarifa estándar en negativo.

```text
consumo_energía_subsidiado = min(consumo_kWh_del_piso, 173 / n)
consumo_energía_estándar   = max(0, consumo_kWh_del_piso − 173 / n)

consumo_agua_subsidiado    = min(consumo_m³_del_piso, 16 / n)
consumo_agua_estándar      = max(0, consumo_m³_del_piso − 16 / n)
```

### Costo de energía

```text
Costo de energía
  = (consumo igual o menor a 173/n × precio unitario hasta 173)
  + ((consumo del piso en kWh − 173/n) × precio unitario estándar)
  + Otros de energía
```

Operativamente:

```text
Costo de energía
  = consumo_energía_subsidiado × precio unitario de energía hasta 173
  + consumo_energía_estándar   × precio unitario de energía estándar
  + Otros de energía
```

“Otros de energía” ya viene por piso del paso 3. No se vuelve a dividir.

### Costo de agua y alcantarillado

```text
Costo de agua y alcantarillado
  = (consumo igual o menor a 16/n × precio unitario hasta 16)
  + ((consumo del piso en m³ − 16/n) × precio unitario estándar)
  + Otros de acueducto y alcantarillado
```

Operativamente:

```text
Costo de agua y alcantarillado
  = consumo_agua_subsidiado × precio unitario hasta 16
  + consumo_agua_estándar   × precio unitario estándar
  + Otros de acueducto y alcantarillado
```

El consumo en m³ es el de agua del piso. El alcantarillado ya va metido en los dos precios unitarios. “Otros de acueducto y alcantarillado” ya viene por piso del paso 3.

### Costo de otros servicios + AP

```text
Costo de otros servicios + AP
  = (Subtotal otros servicios + AP) / n
```

Con 3 pisos: se divide entre 3. Es el mismo valor para cada piso. No depende del consumo.

### Total a pagar del piso

```text
Total a pagar del piso
  = Costo de energía
  + Costo de agua y alcantarillado
  + Costo de otros servicios + AP
```

El Piso 3 usa las mismas tres fórmulas, con su consumo por diferencia.

Quien consuma menos que el tope paga todo su consumo a tarifa subsidiada, cero a tarifa estándar, y sí paga su parte de “Otros” y de AP. Quien se pase del tope paga el cupo a tarifa subsidiada, el resto a tarifa plena, más “Otros” y AP. Nadie resta 173 kWh ni 16 m³ enteros a un piso: el cupo es `173 / n` y `16 / n`.

---

## Ejemplo

Cifras redondas para ver el mecanismo; no son un recibo real.

### Energía del recibo

- Consumo de la casa: 400 kWh
- Consumo básico hasta 173 kWh: $86.500 → precio subsidiado = `86.500 / 173 = $500 / kWh`
- Consumo mayor al básico: $181.600 → precio estándar = `181.600 / (400 − 173) = $800 / kWh`
- Interés de mora: $9.000
- Otros cobros: $3.000
- Ajuste al peso: −$300
- Otros por piso: `(9.000 + 3.000 − 300) / 3 = $3.900`
- Total energía: $279.800
- Tope por piso: `173 / 3` kWh

| Piso | Consumo | kWh a $500 | kWh a $800 | Cobro |
| --- | ---: | ---: | ---: | ---: |
| 1 | 80 | 173/3 | 80 − 173/3 | $50.600 |
| 2 | 150 | 173/3 | 150 − 173/3 | $106.600 |
| 3 | 170 | 173/3 | 170 − 173/3 | $122.600 |
| Suma | 400 | 173 | 227 | $279.800 |

Los tres pisos superan el tope, así que entre todos usan exactamente los 173 kWh baratos y los 227 kWh caros del recibo. La suma de costos de energía coincide con el total de energía.

### Acueducto y alcantarillado

Misma lógica, con tope `16 / 3` m³ por piso:

- los primeros `16 / 3` m³ de cada piso se cobran al precio unitario hasta 16 (agua y alcantarillado ya van juntos en ese precio);
- el resto de m³ de cada piso se cobra al precio unitario estándar;
- a cada piso se le suma “Otros de acueducto y alcantarillado”.

### Otros servicios + AP

Si el subtotal del recibo fuera $45.000:

```text
Costo de otros servicios + AP por piso = 45.000 / 3 = $15.000
```

Ese valor se suma igual a los tres pisos.

### Total a pagar

Para cada piso:

```text
Total a pagar = costo de energía + costo de agua y alcantarillado + $15.000
```

---

## Qué cubre hoy la aplicación

Ya está en la aplicación:

- lecturas, fotografías y aprobación;
- consumo por diferencia del Piso 3;
- alcantarillado igual al agua;
- totales de consumo del recibo (kWh y m³);
- renglones en pesos del paso 2.

Todavía no está en la aplicación:

- calcular las seis cifras del paso 3;
- aplicar el paso 4 (costo de energía, agua y alcantarillado, y otros servicios + AP);
- mostrar el total a pagar de cada piso.

---

## Inconsistencias y huecos

Esta sección no cambia la regla de los pasos anteriores. Lista lo que el procedimiento todavía no resuelve, o lo que la fórmula escrita al pie de la letra haría mal.

1. **`(consumo − 173/n)` y `(consumo − 16/n)` sin piso en cero.** La fórmula de Excel resta el tope al consumo del piso. Si un piso consume **menos** que `173/3` kWh o `16/3` m³, esa resta sale **negativa** y se multiplica por el precio estándar (el caro). El piso pagaría tarifa subsidiada por lo que consumió **y además recibiría un descuento** a tarifa cara por lo que no usó de su cupo. Eso no es justo y no cuadra con “quien no se pasa del cupo no paga excedente”. En el paso 4 la regla operativa es `max(0, consumo − tope)`: debajo del tope, el término estándar es cero. Hay que confirmar que Excel también pone esa resta en cero; si no, Excel está mal en el caso de bajo consumo.

2. **Cupo subsidiado que un piso no usa.** Aunque el término estándar se ponga en cero, el cupo que ese piso no usó **no se pasa** a los otros. La casa puede no agotar los 173 kWh ni los 16 m³ del recibo, y la suma de cobros puede no coincidir con el total. Hoy la regla es no reasignar. Falta decidir si más adelante se reasigna el cupo sobrante.

3. **Período sin excedente.** El precio estándar divide entre `(consumo_recibo − 173)` o `(consumo_recibo − 16)`. Si la casa no supera el bloque, el denominador es cero o negativo. El procedimiento no dice qué hacer. Lo coherente sería no usar precio estándar (tratarlo como 0) y dejar el segundo término de cada piso en cero.

4. **Tres “Otros” distintos.** “Otros de energía”, “Otros de acueducto y alcantarillado” y “Otros servicios + AP” son tres montos diferentes. Los dos primeros ya vienen divididos entre `n` en el paso 3. El de AP se divide entre `n` en el paso 4. Si alguno se divide dos veces, se cobra de menos. Los nombres en pantalla y en código deben distinguirlos.

5. **Mínimo vital.** Se parte entre todos los pisos, incluido el de más consumo. Es coherente con “es la cuenta de la casa”. No es coherente con “es un beneficio para quien consume poco”. El procedimiento actual lo reparte por igual.

6. **Interés de mora.** Se parte por igual. Es justo si la mora es de la cuenta familiar. El procedimiento no atribuye mora a un piso concreto.

7. **Alumbrado público y otros servicios.** Ya está definido: se parten por igual, sin mirar consumo. Es coherente con un cargo de la vivienda. No hay inconsistencia de regla; solo conviene no mezclarlo con “Otros de energía”.

8. **Bloques 173 y 16.** Están fijos porque así se llaman los renglones del recibo. Si la empresa cambia el tamaño del bloque, las fórmulas actuales dejan de aplicar.

9. **Redondeo.** Partir 173 o 16 entre `n` y multiplicar por precios produce centavos. El recibo trae ajuste al peso (dentro de “Otros” de energía o de agua). No hay una regla extra de cierre para que la suma de los tres totales a pagar dé el peso exacto del recibo.

10. **Cuadre.** Debería poder comprobarse:

```text
suma(costo de energía de los 3 pisos)                  ≟ Total energía
suma(costo de agua y alcantarillado de los 3 pisos)    ≟ Total agua + Total alcantarillado
suma(costo de otros servicios + AP de los 3 pisos)     ≟ Subtotal otros servicios + AP
suma(total a pagar de los 3 pisos)                     ≟ esos tres bloques juntos
```

El procedimiento no obliga todavía ese cuadre como paso formal. El cuadre de energía y agua solo da exacto si los tres pisos superan su tope (punto 2). El cuadre de AP sí da exacto siempre, porque es el mismo valor veces `n`.
