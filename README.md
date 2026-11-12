# Registro de vacaciones

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.8.

## Configurar Supabase

1. Crea un proyecto gratuito en [Supabase](https://supabase.com).
2. En **SQL Editor**, ejecuta el contenido de `supabase/schema.sql`.
   Si ya ejecutaste el esquema anterior, ejecuta en su lugar
   `supabase/migration-add-employee-details.sql`; esta migración conserva los registros existentes.
3. En **Project Settings > API**, copia la URL y la clave pública `anon`.
4. Pega esos valores en `src/environments/environment.ts`:

```ts
export const environment = {
  production: false,
  supabaseUrl: 'https://tu-proyecto.supabase.co',
  supabaseAnonKey: 'tu-clave-anon'
};
```

La clave pública está diseñada para el navegador. Nunca coloques la `service_role` en Angular.

## Seguridad y acceso del administrador

La aplicación usa Supabase Auth con correo y contraseña. En Supabase:

1. Ve a **Authentication > Users** y crea el único usuario administrador.
2. En **Authentication > Providers > Email**, desactiva el registro público si sólo habrá un administrador.
3. Ejecuta `supabase/migration-vacation-management.sql` para reemplazar las políticas públicas
   por políticas para usuarios `authenticated`.
4. Cierra sesión al terminar y no compartas la contraseña.

La clave pública puede permanecer en Angular; nunca publiques la clave `service_role`.
La aplicación no permite consultar empleados ni vacaciones sin una sesión válida.

## Directorio de empleados

El formulario requiere nombre, edad, sexo, cumpleaños y fecha de ingreso. La lista se consulta
directamente desde la tabla `employees` y muestra los empleados activos e inactivos. Para una base
creada desde cero, `schema.sql` ya incluye estos campos. Para una base existente, usa la migración
indicada arriba antes de abrir la aplicación.

## Panel administrativo de vacaciones

El panel no crea solicitudes ni aprobaciones para empleados. El administrador registra directamente
vacaciones disfrutadas o programadas. Las fechas se cuentan como días naturales, incluyendo el día
de descanso semanal. Una fecha futura reserva sus días en el saldo, pero no aparece como
"Actualmente de vacaciones" hasta que inicia; al llegar la fecha, el sistema la marca como disfrutada.
Los registros históricos sin período asociado se vinculan por su fecha de inicio al período laboral correspondiente.
No se permiten períodos traslapados para el mismo empleado.

Antes de usar el panel, ejecuta `supabase/migration-vacation-management.sql` en una base existente.
La migración agrega el descanso semanal del empleado y metadatos de período, estado, origen y
trazabilidad a los registros de vacaciones sin eliminar información.

## Development server

To start a local development server, run:

```bash
npm start
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
