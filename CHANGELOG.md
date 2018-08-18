# 2.0
- Transitioned from `@angular/core` DI to `injection-js`, substantially reducing install times
  and complexity of install (`injection-js` is [5.1KB](https://github.com/mgechev/injection-js))
- Improved and updated dev documentation
- Introduced an official Code of Conduct

# 1.1

- Dropped support for Node 5.11 test target, minimum supported version is now Node.js 6.1
- Support extended to Node 8 and 10
- Introduces ESM build
- Upgraded dependencies, and moved typings dependencies into dev-deps
- Refactored to use async/await internally
- Now sends `Content-Type: application.json` when serializing a `Response` object which is 
  `encodedAs` JSON unless otherwise specified.