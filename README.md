# Servicios de la vivienda

Aplicación web para recopilar, validar y liquidar los recibos y las lecturas de servicios públicos de una vivienda de tres pisos. La liquidación sigue `docs/procedimiento-liquidacion.md` y corrige las fórmulas estáticas del Excel (cupo no usado, división entre cero, `n` fijo).

Prioridad: corrección, trazabilidad y simplicidad. Pensada para uso familiar. Solo necesita Node.js y una base de datos PostgreSQL común, conectada con una única variable: `DATABASE_URL`.

## Qué hace esta versión

Como administrador puedes:

1. Crear un período (no tiene que ser un mes calendario).
2. Cargar el PDF del recibo, los consumos totales (kWh / m³) y los importes en pesos de cada renglón de energía, agua y alcantarillado.
3. Ver qué lecturas faltan.
4. Revisar lecturas enviadas, ver la fotografía, corregir el valor, aprobar o rechazar.
5. Obtener automáticamente el consumo de cada piso con contador (`lectura actual − lectura anterior aprobada`).
6. Obtener el consumo del Piso 3 por diferencia.
7. Copiar el consumo de alcantarillado desde el de agua.
8. Consultar períodos anteriores.
9. Ver cuánto paga cada piso y cerrar el período.
10. Eliminar un período (hay que escribir su nombre y confirmar; no se puede deshacer).

Como usuario de un piso con contador (Piso 1 o Piso 2) puedes:

1. Iniciar sesión.
2. Ver los períodos abiertos.
3. Introducir solo la lectura actual (la anterior la resuelve el sistema).
4. Subir una fotografía del contador.
5. Ver si fue aprobada o si requiere corrección.

## Arquitectura

Una sola aplicación Next.js (App Router). No hay servidor propio ni backend separado.

```text
Autenticación (usuario y contraseña; sesiones en PostgreSQL)
    → Gestión de períodos
    → Gestión de recibos (PDF + totales; extractor intercambiable)
    → Gestión de lecturas + fotos
    → Validación (lib/domain)
    → Cálculo de consumos (lib/domain)
    → Liquidación (CalculationEngine en lib/domain/settlement.ts)
```

La UI no contiene las reglas de cálculo. Esas reglas viven en `lib/domain/` y se testean con Vitest.

El recibo entra por una abstracción:

```text
PDF → BillExtractor.extract() → datos del recibo → validación → período
```

Hoy, al elegir el PDF, `PdfBillExtractor` lee la página 1 (texto seleccionable) y un parser EMCALI rellena consumos e importes. El administrador revisa y guarda. `ManualBillExtractor` sigue disponible para tests y para cuando no hay archivo.

## Tecnologías

- Next.js (App Router) y TypeScript estricto
- Tailwind CSS
- PostgreSQL (cliente `pg`): datos, sesiones de inicio de sesión y archivos (PDF y fotos), todo detrás de `DATABASE_URL`
- Despliegue en cualquier servidor Node.js (Vercel, un VPS, Docker…)
- Vitest para tests de dominio

## Modelo de negocio (confirmado)

- Piso 1 y Piso 2 tienen contador de **energía** y **agua**.
- Piso 3 no tiene contador: su consumo es `total del recibo − Piso 1 − Piso 2`.
- **Alcantarillado** no tiene contador. El consumo de cada piso es el mismo que el de agua.
- Hay un PDF por período. Al elegirlo se rellenan los renglones de la página 1; hay que revisarlos y guardar.
- Una lectura pendiente o rechazada **nunca** se usa como lectura anterior. Solo la última lectura **aprobada** de un período que **empiece antes**. Si dos períodos comparten el día de lectura (por ejemplo 11 feb), el anterior es el que empieza antes.
- El período con la fecha inicial más antigua es el de **lectura inicial**: no calcula consumo ni exige recibo. El consumo empieza en el siguiente período.
- Si el consumo del Piso 3 sale negativo, el período no se puede marcar como listo.

## Estructura de la base de datos

Tablas principales (definidas en `db/migrations/001_schema.sql`):

| Tabla | Propósito |
| --- | --- |
| `users` | Cuentas: usuario de inicio de sesión, nombre, rol `admin` o `floor_user` y hash de la contraseña (scrypt). |
| `user_sessions` | Sesiones abiertas. La cookie lleva un token aleatorio; aquí solo se guarda su hash. |
| `floors` | Piso 1 (Nasly), Piso 2 (Lucy), Piso 3 (Juan). |
| `services` | Energía, agua, alcantarillado. Alcantarillado se marca como `copied` desde agua. |
| `floor_service_meters` | Qué combinaciones piso/servicio tienen contador. |
| `floor_memberships` | Usuario de piso → un piso. |
| `billing_periods` | Período con `label`, `starts_on`, `ends_on`, `status` (`open`, `ready`, `closed`). |
| `bills` | Recibo 1:1 con el período, ruta del PDF y subtotal de otros servicios + alumbrado público. |
| `bill_service_totals` | Consumo total por servicio en el recibo (kWh / m³). |
| `bill_service_charges` | Importes en pesos por renglón del recibo (energía, agua, alcantarillado). |
| `meter_readings` | Lectura vigente por período + piso + servicio. Guarda `submitted_value` (original) y `value` (vigente). Estados: `pending`, `approved`, `rejected`. |
| `reading_photos` | Fotografías (ruta del archivo); las anteriores no se borran. |
| `stored_files` | Contenido de los PDF y las fotos (`bytea`). Se sirven por `/api/files/…` con comprobación de sesión y permisos. |
| `audit_logs` | Quién cambió qué, con valor anterior y nuevo. Lo rellenan triggers. |

Consumos **no** se persisten: se calculan.

## Instalación

Requisitos: Node.js 20 o superior y una base de datos PostgreSQL 13 o superior (local, en Docker o de cualquier proveedor).

```bash
git clone <url-del-repositorio>
cd home-services
npm install
copy .env.example .env.local
```

En macOS/Linux usa `cp .env.example .env.local`.

Edita `.env.local`:

```
DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/vivienda
```

Es la única variable. Si tu proveedor exige SSL, añade `?sslmode=require` al final de la URL.

## Configuración de la base de datos

### 1. Base de datos vacía

Crea una base de datos vacía (por ejemplo `vivienda`) y apunta `DATABASE_URL` a ella. Para probar en local con Docker:

```bash
docker run --name vivienda-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=vivienda -p 5432:5432 -d postgres:16
```

con `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vivienda`.

### 2. Esquema

En la raíz del proyecto:

```bash
npm run db:schema
```

Aplica en orden los SQL de `db/migrations/` y anota cuáles ya corrieron en la tabla `schema_migrations`, así que se puede repetir sin riesgo. Crea las tablas, los triggers de auditoría y la semilla (3 pisos, 3 servicios, 4 contadores).

### 3. Crear usuarios (admin, Piso 1 y Piso 2)

Las contraseñas las gestiona la aplicación (hash scrypt en la tabla `users`). Estos comandos crean la cuenta, le asignan el rol y, si corresponde, el piso:

```bash
npm run user:admin -- admin "TuContraseña"
npm run user:piso-1 -- nasly "TuContraseña"
npm run user:piso-2 -- lucy "TuContraseña"
```

Nombre visible opcional al final:

```bash
npm run user:piso-1 -- nasly "TuContraseña" "Nasly"
```

Si esa cuenta (admin, piso 1 o piso 2) ya existe, el comando actualiza usuario, contraseña, rol y piso en lugar de crear otra, y cierra sus sesiones abiertas. En el login usa el usuario (`nasly`), no un correo.

El Piso 3 no envía lecturas en esta versión; no necesita cuenta.

### Reiniciar datos de prueba

Cuando un ensayo deje la base sucia:

```bash
npm run db:reset -- --yes
```

Eso borra períodos, recibos, lecturas, fotos, auditoría, sesiones y **usuarios**. Vuelve a dejar los 3 pisos, 3 servicios y 4 contadores. No toca tablas ni triggers.

Sin `--yes` no ejecuta nada; solo muestra la ayuda. Después recrea las cuentas con los comandos del paso 3.

### Recuperar los datos de Supabase

Si vienes de la versión con Supabase, `npm run db:import-supabase` copia a la base nueva los períodos, recibos, lecturas, auditoría, cuentas y los archivos (PDF y fotos). Solo **lee** de Supabase; no modifica nada allí.

1. Deja en `.env.local` estas variables. `DATABASE_URL` pasa a ser la base **nueva**, y la URI de Supabase que antes era `DATABASE_URL` se mueve a `SUPABASE_DATABASE_URL`:

   ```
   DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/vivienda
   SUPABASE_DATABASE_URL=postgresql://postgres.REF:CLAVE@aws-0-REGION.pooler.supabase.com:5432/postgres
   SUPABASE_URL=https://TU_PROYECTO.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=la_clave_secret_o_service_role
   ```

   `SUPABASE_DATABASE_URL` debe ser la del **Session pooler** (host `...pooler.supabase.com`, usuario `postgres.TU_REF`; en el dashboard, botón **Connect**). La conexión directa (`db.TU_REF.supabase.co`) solo responde por IPv6 y en la mayoría de redes da `ENOTFOUND`.

   `SUPABASE_URL` y la clave son las mismas que ya tenías (`NEXT_PUBLIC_SUPABASE_URL` también vale). Sirven para bajar los archivos por la API de Storage, porque no están dentro de la base.

2. Aplica el esquema en la base nueva, que debe estar vacía: `npm run db:schema`. Comprueba antes que `DATABASE_URL` no apunte a Supabase.
3. Simulacro, sin escribir nada: `npm run db:import-supabase`. Muestra cuántas filas y archivos hay y los comandos de cada cuenta.
4. Importa de verdad: `npm run db:import-supabase -- --yes`.
5. Pon la contraseña de cada cuenta con los comandos que imprimió el paso 3, por ejemplo `npm run user:admin -- admin "NuevaContraseña"`.

Qué conviene saber:

- Se conservan los UUID, así que todas las relaciones, el historial de auditoría y las lecturas siguen enlazados.
- **Las contraseñas no se copian**: Supabase las guarda con bcrypt y esta app usa scrypt. Las cuentas se importan bloqueadas hasta el paso 5, que reutiliza el mismo usuario y conserva su historial.
- Las sesiones abiertas no se migran; todos vuelven a iniciar sesión.
- Si falta algún archivo en Storage, la importación se cancela sin tocar la base nueva. Usa `--allow-missing-files` para continuar sin ellos, o `--skip-files` para importar solo los datos (en ese caso vuelve a subir los PDF de los recibos).
- La base nueva debe estar limpia. Si ya creaste cuentas con `npm run user:*` antes de importar, corre `npm run db:reset -- --yes` y repite desde el paso 3.
- Cuando todo esté revisado, puedes borrar las variables `SUPABASE_*` y este script.

## Desarrollo local

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

- Administración: `/admin`
- Usuarios de piso: `/mis-lecturas`

## Tests

```bash
npm test
```

Cubren diferencia de lecturas, Piso 3 por diferencia, consumo negativo, lectura menor que la anterior, estados, permisos de dominio y lógica de períodos.

La autorización ya no depende de políticas RLS: vive en la aplicación (`lib/auth/current-user.ts`, `lib/domain/permissions.ts`, las server actions y las rutas `/api/files`). Comprobación manual recomendada:

1. Entra como usuario del Piso 1 y abre una foto propia: debe verse. Pega la URL de una foto del Piso 2: debe dar 404.
2. Con ese mismo usuario, abre `/admin`: debe llevarte a `/mis-lecturas`.
3. Sin sesión, cualquier ruta (incluidas `/api/files/…`) lleva a `/login` o responde 401.

## Build

```bash
npm run build
npm start
```

`DATABASE_URL` se lee al ejecutar (no al compilar), pero tiene que estar definida en el entorno donde corre `npm start`.

## Despliegue

Cualquier servidor Node.js sirve: `npm run build` y `npm start`. En Vercel:

1. Sube el repositorio a GitHub/GitLab/Bitbucket.
2. En [Vercel](https://vercel.com) importa el proyecto (framework: Next.js).
3. Define `DATABASE_URL`.
4. Deploy.

Notas:

- En entornos serverless cada instancia abre sus propias conexiones. Usa la URL **con pool** de tu proveedor (PgBouncer, el pooler de Neon, etc.) para no agotar las conexiones de Postgres.
- La base de datos debe ser alcanzable desde el servidor. El esquema y los usuarios se crean desde tu equipo con `npm run db:schema` y `npm run user:*`, apuntando a esa misma base.
- La cookie de sesión lleva `Secure` solo cuando la petición llega por HTTPS (también detrás de un proxy que envíe `x-forwarded-proto`), de modo que un despliegue por HTTP en red local también inicia sesión.
- El PDF del recibo (hasta 10 MB) viaja dentro del formulario. Vercel limita el cuerpo de una petición a unos 4,5 MB; si necesitas PDF más grandes, despliega en un servidor propio.

## Primer uso (lectura inicial)

El consumo necesita una lectura **aprobada anterior**. La primera vez:

1. Crea el período más antiguo (el de la lectura de referencia).
2. Como administrador, registra y aprueba las 4 lecturas (Piso 1/2 × agua/energía) con foto del contador o de la planilla anterior.
3. Ese período inicial **no pide un período aún más antiguo**. Con las lecturas aprobadas ya puedes marcarlo como listo, sin recibo.
4. Crea el período de facturación siguiente (puede empezar el mismo día en que termina el anterior), carga el PDF y pide las lecturas nuevas. La lectura anterior se toma del período inicial.

No hace falta encadenar períodos hacia atrás de forma indefinida.

## Funcionamiento mensual

1. El administrador crea el período (`open`).
2. Sube el PDF, los consumos totales y los importes en pesos de energía, agua y alcantarillado.
3. Los usuarios de Piso 1 y 2 envían lectura + foto.
4. El administrador compara foto y valor. Puede corregir (queda `submitted_value` original, `value` vigente y una fila de auditoría), aprobar o rechazar con motivo.
5. Cuando las 4 lecturas están aprobadas, hay lectura anterior (salvo en el período inicial), los consumos del Piso 3 no son negativos y el recibo está completo, el administrador marca el período **listo**.
6. En un período de facturación se ve la liquidación por piso (energía, acueducto y alcantarillado, otros servicios + AP). El administrador puede **cerrar** el período. Cerrar bloquea cambios al recibo y a las lecturas; reabrir pasa de cerrado a listo y de listo a abierto.
7. El administrador puede **eliminar** un período si escribe su nombre y confirma. Se borra el recibo, las lecturas y las fotos.

Avisos visibles (no se ocultan):

- Lectura actual menor que la anterior (se puede aprobar solo confirmando el aviso).
- Falta de lectura anterior.
- Total de alcantarillado del recibo distinto al de agua (el consumo por piso sigue copiándose del agua).
- Consumo del Piso 3 negativo (bloquea el estado `ready`).

## Variables de entorno

| Variable | Dónde | Uso |
| --- | --- | --- |
| `DATABASE_URL` | `.env.local` y el entorno donde corre la app | URL de conexión a PostgreSQL: `postgresql://usuario:contraseña@host:5432/base`. Es la única variable. |

No subas `.env.local` al repositorio.

## Estructura del código

```text
app/                 páginas, server actions y rutas /api/files
components/          UI pequeña
lib/domain/          reglas de negocio (testeable, sin React)
lib/billing/         extractor de recibo
lib/data/            consultas de catálogo y períodos
lib/db/              conexión a PostgreSQL (pool, transacciones, tipos)
lib/auth/            contraseñas, sesiones y usuario actual
lib/storage/         archivos (PDF y fotos) guardados en la base
db/migrations        esquema SQL (npm run db:schema)
tests/               Vitest
```

## Lo que no está en esta versión (a propósito)

- OCR de fotografías de contadores
- Panel de alta de usuarios
- Gráficos

La liquidación vive en `lib/domain/settlement.ts` y sigue `docs/procedimiento-liquidacion.md`.
