# KiraUi

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.0.4.

## Development server

To start a local development server, run:

```bash
ng serve
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

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

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

## Login Session Notes (Local Dev)

The UI calls auth endpoints through `/gateway/*` (see `proxy.conf.js`) and relies on an HTTP-only cookie issued by `kira-gateway`.

If you can login successfully but are redirected back to login on refresh or protected pages:

1. Ensure UI proxy points to the running gateway instance.
2. For non-HTTPS local environments, set `APP_SECURITY_COOKIE_SECURE=false` for `kira-gateway`.
3. Keep `APP_SECURITY_COOKIE_PATH=/gateway` so the browser sends cookie for `/gateway/auth/me`.
4. Keep `APP_SECURITY_COOKIE_DOMAIN` empty for localhost development unless you explicitly need a custom domain.

Example local gateway env:

```bash
APP_SECURITY_COOKIE_SECURE=false
APP_SECURITY_COOKIE_PATH=/gateway
APP_SECURITY_COOKIE_DOMAIN=
APP_SECURITY_CORS_ALLOWED_ORIGINS=http://localhost:4200
```
