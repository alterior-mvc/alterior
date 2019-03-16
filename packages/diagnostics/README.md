# @alterior/diagnostics

Enables `@ConsoleTrace()` and other debugging features of `@alterior/logging`. Declare a dev-dependency on this to enable tracing in development.

```
npm i @alterior/diagnostics -D
```

If you need this information in production, declare a proper dependency:

```
npm i @alterior/diagnostics
```

Decorate any method with the `@ConsoleTrace()` mutation decorator from `@alterior/logging` to cause it to be traced to the console when tracing is enabled. This package just enables tracing.

See `@alterior/logging` for more details.