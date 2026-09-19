# Servicios de la vivienda

Aplicación web para recopilar, validar y liquidar los recibos y las lecturas de servicios públicos de una vivienda de tres pisos. La liquidación sigue `docs/procedimiento-liquidacion.md` y corrige las fórmulas estáticas del Excel (cupo no usado, división entre cero, `n` fijo).

Prioridad: corrección, trazabilidad y simplicidad. Pensada para uso familiar, con despliegue en Vercel y backend en Supabase.

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
Autenticación (Supabase Auth)
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
- Supabase: PostgreSQL, Auth, Storage y Row Level Security
- Vercel para el despliegue
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

Tablas principales (definidas en `supabase/migrations/001_schema.sql`):

| Tabla | Propósito |
| --- | --- |
| `profiles` | Perfil 1:1 con `auth.users`. Usuario de inicio de sesión, rol `admin` o `floor_user`. |
| `floors` | Piso 1 (Nasly), Piso 2 (Lucy), Piso 3 (Juan). |
| `services` | Energía, agua, alcantarillado. Alcantarillado se marca como `copied` desde agua. |
| `floor_service_meters` | Qué combinaciones piso/servicio tienen contador. |
| `floor_memberships` | Usuario de piso → un piso. |
| `billing_periods` | Período con `label`, `starts_on`, `ends_on`, `status` (`open`, `ready`, `closed`). |
| `bills` | Recibo 1:1 con el período, PDF y subtotal de otros servicios + alumbrado público. |
| `bill_service_totals` | Consumo total por servicio en el recibo (kWh / m³). |
| `bill_service_charges` | Importes en pesos por renglón del recibo (energía, agua, alcantarillado). |
| `meter_readings` | Lectura vigente por período + piso + servicio. Guarda `submitted_value` (original) y `value` (vigente). Estados: `pending`, `approved`, `rejected`. |
| `reading_photos` | Fotografías; las anteriores no se borran. |
| `audit_logs` | Quién cambió qué, con valor anterior y nuevo. Lo rellenan triggers. |

Consumos **no** se persisten: se calculan.

## Instalación

Requisitos: Node.js 20 o superior y una cuenta de [Supabase](https://supabase.com).

```bash
git clone <url-del-repositorio>
cd home-services
npm install
copy .env.example .env.local
```

En macOS/Linux usa `cp .env.example .env.local`.

Edita `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Esas claves están en Supabase: **Project Settings → API**.

## Configuración de Supabase

### 1. Proyecto

Crea un proyecto en el dashboard de Supabase.

### 2. Autenticación

La pantalla de inicio usa **usuario y contraseña**, no correo. Supabase Auth sigue activo por debajo: cada cuenta tiene un correo interno `usuario@vivienda.local`. En **Authentication → Providers** deja habilitado Email.

En **Authentication → Settings** (o Providers → Email) puedes desactivar **Confirm email**. Los comandos `npm run user:*` ya marcan la cuenta como confirmada.

No implementes un sistema propio de contraseñas. Las cuentas se crean en Supabase Auth.

### 3. Esquema, RLS y buckets

Añade en `.env.local` la contraseña de la base de datos (la que definiste al crear el proyecto). Si no la recuerdas: **Project Settings → Database** → **Reset database password**.

```
SUPABASE_DB_PASSWORD=tu_contraseña_de_postgres
```

En la raíz del proyecto:

```bash
npm run db:schema
```

Eso ejecuta los SQL de `supabase/migrations/`: tablas, RLS, auditoría, semilla (3 pisos, 3 servicios, 4 contadores), buckets privados `bills` y `reading-photos`, y el usuario de inicio de sesión.

Si `db.<proyecto>.supabase.co` no conecta (IPv6 / red), copia en `.env.local` la URI de **Project Settings → Database → Connect → Session pooler** como `DATABASE_URL` y vuelve a correr el comando. `DATABASE_URL` tiene prioridad sobre `SUPABASE_DB_PASSWORD`.

También puedes pegar el SQL a mano en **SQL Editor**. Si alguna política de Storage dice que ya existe, el script usa `drop policy if exists` y suele ser seguro repetirlo.

### Reiniciar datos de prueba

Cuando un ensayo deje la base sucia:

```bash
npm run db:reset -- --yes
```

Eso borra períodos, recibos, lecturas, fotos, auditoría y **usuarios de Auth**. Vuelve a dejar los 3 pisos, 3 servicios y 4 contadores. No toca tablas, RLS ni `.env.local`.

Sin `--yes` no ejecuta nada; solo muestra la ayuda.

Después recrea las cuentas:

```bash
npm run user:admin -- admin "TuContraseña"
npm run user:piso-1 -- nasly "TuContraseña"
npm run user:piso-2 -- lucy "TuContraseña"
```

### 4. Crear usuarios (admin, Piso 1 y Piso 2)

Estos comandos crean la cuenta en Supabase Auth, asignan el usuario de inicio de sesión, el rol y, si corresponde, el piso.

Primero añade en `.env.local` la clave **secret** / **service_role** (no la anon):

```
SUPABASE_SERVICE_ROLE_KEY=pega_aqui_la_clave_secret
```

En el dashboard: **Project Settings → API Keys**. Copia **Secret key** (`sb_secret_...`) o, en **Legacy API Keys**, **`service_role`**. Esa clave no debe ir a Vercel ni usarse en el navegador.

Luego, en la raíz del proyecto:

```bash
npm run user:admin -- admin "TuContraseña"
npm run user:piso-1 -- nasly "TuContraseña"
npm run user:piso-2 -- lucy "TuContraseña"
```

Nombre visible opcional al final:

```bash
npm run user:piso-1 -- nasly "TuContraseña" "Nasly"
```

Si esa cuenta (admin, piso 1 o piso 2) ya existe, el comando actualiza usuario, contraseña, rol y piso en lugar de crear otra. En el login usa el usuario (`nasly`), no un correo.

El Piso 3 no envía lecturas en esta versión; no necesita cuenta.

### 5. Autenticación

En **Authentication → Providers** deja habilitado Email (Supabase lo necesita internamente). En la aplicación se entra con usuario y contraseña.

En **Authentication → Settings** (o Providers → Email) puedes desactivar **Confirm email**. Los comandos `npm run user:*` ya marcan la cuenta como confirmada.

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

Las políticas RLS se verifican en Supabase (SQL Editor o Table Editor iniciando sesión con cada usuario). No hace falta Docker.

Comprobación manual recomendada de RLS:

1. Entra como usuario del Piso 1 e intenta leer una fila de `meter_readings` del Piso 2: debe fallar.
2. Intenta aprobar una lectura desde el cliente del piso: la política solo permite dejar el estado en `pending`.
3. Las fotos viven en rutas `{floor_id}/...`; un usuario de otro piso no obtiene URL firmada.

## Build

```bash
npm run build
npm start
```

El build de producción necesita las mismas variables de entorno.

## Despliegue en Vercel

1. Sube el repositorio a GitHub/GitLab/Bitbucket.
2. En [Vercel](https://vercel.com) importa el proyecto (framework: Next.js).
3. Configura:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. Deploy.

No hace falta servicio role key en Vercel: la autorización está en RLS. No publiques los buckets.

En Authentication → URL configuration de Supabase, añade:

- `http://localhost:3000`
- `https://tu-dominio.vercel.app`

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
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` y Vercel | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` y Vercel | Clave anónima o publishable (con RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | solo `.env.local` | Clave secret / service_role para `npm run user:*`. No la subas a Vercel. |
| `SUPABASE_DB_PASSWORD` | solo `.env.local` | Contraseña de Postgres para `npm run db:schema`. |
| `DATABASE_URL` | solo `.env.local`, opcional | URI completa si la conexión directa falla. Tiene prioridad sobre `SUPABASE_DB_PASSWORD`. |

No subas `.env.local` al repositorio.

## Estructura del código

```text
app/                 páginas y server actions
components/          UI pequeña
lib/domain/          reglas de negocio (testeable, sin React)
lib/billing/         extractor de recibo
lib/data/            lecturas a Supabase
lib/supabase/        clientes Auth/DB
lib/storage/         rutas de archivos privados
supabase/migrations  SQL para pegar en el dashboard
tests/               Vitest
```

## Lo que no está en esta versión (a propósito)

- OCR de fotografías de contadores
- Panel de alta de usuarios
- Gráficos

La liquidación vive en `lib/domain/settlement.ts` y sigue `docs/procedimiento-liquidacion.md`.
