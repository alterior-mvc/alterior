@echo off
call npm run -w packages/build build >nul
call node --no-deprecation ./packages/build/dist/main %*
