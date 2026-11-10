@echo off
set "ADB=C:\Users\jhimmy\AppData\Local\Android\Sdk\platform-tools\adb.exe"
set "JAVA_HOME=C:\Users\jhimmy\.jdk\jdk-21.0.13+9"

echo [1/3] Conectando ADB ao BlueStacks...
"%ADB%" connect 127.0.0.1:5555
"%ADB%" devices

echo [2/3] Compilando APK do Cine Ultimate (perfil otimizado de RAM)...
call "%~dp0gradlew.bat" :androidApp:assembleFullDebug -Dorg.gradle.jvmargs="-Xmx2048M -Dfile.encoding=UTF-8 -XX:MaxMetaspaceSize=512m" -Dkotlin.compiler.execution.strategy=in-process -Dorg.gradle.parallel=false --max-workers=2
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha na compilacao do APK.
    exit /b %ERRORLEVEL%
)

echo [3/3] Instalando e abrindo o Cine Ultimate no BlueStacks...
"%ADB%" -s 127.0.0.1:5555 install -r -t "%~dp0androidApp\build\outputs\apk\full\debug\androidApp-full-debug.apk"
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha na instalacao no BlueStacks.
    exit /b %ERRORLEVEL%
)
"%ADB%" -s 127.0.0.1:5555 shell am force-stop com.nuviodebug.com
"%ADB%" -s 127.0.0.1:5555 shell am start -n com.nuviodebug.com/com.nuvio.app.launcher.AppIconDefault
echo Concluido!
