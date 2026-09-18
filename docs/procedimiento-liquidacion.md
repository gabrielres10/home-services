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
- Los renglones que no son consumo se **parten por igual** entre los pisos: son de la cuenta de la casa, no de un contador.

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

| Renglón | Qué es |
| --- | --- |
| Subtotal otros servicios + AP | Importe único de la vivienda. AP significa alumbrado público. |

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

### Las seis cifras

| # | Cifra | Unidad | Cómo entra en el cobro de cada piso |
| --- | --- | --- | --- |
| 1 | Precio unitario de energía hasta 173 | $/kWh | Sobre los kWh del piso que no superan `173 / n` |
| 2 | Precio unitario de energía estándar | $/kWh | Sobre los kWh del piso que superan `173 / n` |
| 3 | Otros de energía | $ por piso | Se suma tal cual |
| 4 | Precio unitario de acueducto y alcantarillado hasta 16 | $/m³ | Sobre los m³ del piso que no superan `16 / n` |
| 5 | Precio unitario de acueducto y alcantarillado estándar | $/m³ | Sobre los m³ del piso que superan `16 / n` |
| 6 | Otros de acueducto y alcantarillado | $ por piso | Se suma tal cual |

---

## Paso 4 — Cobro de cada piso

A cada piso se le aplica su propio consumo contra su cupo, no contra el bloque completo de la casa.

```text
tope_energía = 173 / n
tope_agua    = 16 / n
```

Con `n = 3`:

- tope de energía por piso = `173 / 3` kWh
- tope de acueducto y alcantarillado por piso = `16 / 3` m³

```text
kWh_subsidiados = min(consumo_kWh_del_piso, tope_energía)
kWh_estándar    = max(0, consumo_kWh_del_piso − tope_energía)

m³_subsidiados  = min(consumo_m³_del_piso, tope_agua)
m³_estándar     = max(0, consumo_m³_del_piso − tope_agua)

cobro_energía =
    kWh_subsidiados × precio unitario de energía hasta 173
  + kWh_estándar    × precio unitario de energía estándar
  + Otros de energía

cobro_acueducto_alcantarillado =
    m³_subsidiados × precio unitario hasta 16
  + m³_estándar    × precio unitario estándar
  + Otros de acueducto y alcantarillado

total_del_piso = cobro_energía + cobro_acueducto_alcantarillado
```

El Piso 3 usa exactamente las mismas fórmulas, con el consumo obtenido por diferencia.

Quien consuma menos que el tope paga todo su consumo a tarifa subsidiada y **cero** a tarifa estándar. Quien se pase del tope paga el tope a tarifa subsidiada y el resto a tarifa plena. Nadie resta 173 kWh ni 16 m³ enteros a un piso: eso sería el bloque de la casa, no el cupo de ese piso.

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

Los tres pisos superan el tope, así que entre todos usan exactamente los 173 kWh baratos y los 227 kWh caros del recibo. La suma de cobros coincide con el total de energía.

### Acueducto y alcantarillado

Misma lógica, con tope `16 / 3` m³ por piso:

- los primeros `16 / 3` m³ de cada piso se cobran al precio unitario hasta 16 (agua y alcantarillado ya van juntos en ese precio);
- el resto de m³ de cada piso se cobra al precio unitario estándar;
- a cada piso se le suma “Otros de acueducto y alcantarillado”.

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
- aplicar el paso 4 a cada piso;
- mostrar lo que debe pagar cada piso.

---

## Inconsistencias y huecos

Esta sección no cambia la regla de los pasos anteriores. Lista lo que el procedimiento todavía no resuelve, para no perderlo cuando se complete el método.

1. **Cupo subsidiado que un piso no usa.** El procedimiento da a cada piso un cupo de `173 / n` kWh y `16 / n` m³. Si un piso consume menos que su cupo, ese resto no se pasa a los otros. Entonces la casa no agota los 173 kWh ni los 16 m³ del recibo, y la suma de cobros puede no coincidir con el total. Hoy la regla es no reasignar. Falta decidir si más adelante se reasigna el cupo sobrante.

2. **Período sin excedente.** El precio estándar divide entre `(consumo_recibo − 173)` o `(consumo_recibo − 16)`. Si la casa no supera el bloque, el denominador es cero o negativo. El procedimiento no dice qué hacer. Lo coherente sería no usar precio estándar (tratarlo como 0) y no cobrar excedente a nadie, pero eso aún no está escrito como regla.

3. **Nombre de “Otros”.** En el paso 3, “Otros” ya es el valor por piso. Si al aplicar el cobro se divide otra vez entre `n`, se cobra de menos. Hay que distinguir el total de la casa y el valor por piso.

4. **Mínimo vital.** Se parte entre todos los pisos, incluido el de más consumo. Es coherente con “es la cuenta de la casa”. No es coherente con “es un beneficio para quien consume poco”. El procedimiento actual lo reparte por igual.

5. **Interés de mora.** Se parte por igual. Es justo si la mora es de la cuenta familiar. El procedimiento no atribuye mora a un piso concreto.

6. **Bloques 173 y 16.** Están fijos porque así se llaman los renglones del recibo. Si la empresa cambia el tamaño del bloque, las fórmulas actuales dejan de aplicar. El procedimiento no contempla otro valor.

7. **Redondeo.** Partir 173 o 16 entre `n` y multiplicar por precios produce centavos. El recibo trae ajuste al peso, que ya se reparte en “Otros”. No hay una regla extra de cierre para que la suma de pisos dé el peso exacto del recibo en todos los casos.

8. **Cuadre.** Los totales del paso 3 deberían poder compararse con la suma de lo cobrado a los tres pisos. El procedimiento no obliga todavía ese cuadre como paso formal.

9. **Subtotal otros servicios + AP.** Ya se captura como un solo valor de la vivienda. El procedimiento todavía no dice cómo se reparte entre los pisos (por partes iguales, u otra regla).
