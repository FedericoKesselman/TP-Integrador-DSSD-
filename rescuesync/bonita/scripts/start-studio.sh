#!/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
STUDIO_APP=${BONITA_STUDIO_APP:-/Applications/BonitaStudioCommunity-2025.2-u0.app}
DOCKER=${DOCKER_BIN:-/Applications/Docker.app/Contents/Resources/bin/docker}
if [ -z "${BONITA_NOTIFICATION_TOKEN:-}" ]; then
  BONITA_NOTIFICATION_TOKEN=$("$DOCKER" compose -f "$SCRIPT_DIR/../../web-app/docker-compose.yml" exec -T server node -e 'process.stdout.write(process.env.BONITA_NOTIFICATION_TOKEN || "")' 2>/dev/null || true)
fi
if [ -z "${BONITA_NOTIFICATION_TOKEN:-}" ]; then
  ENV_FILE="$SCRIPT_DIR/../../web-app/server/.env"
  if [ -f "$ENV_FILE" ]; then
    BONITA_NOTIFICATION_TOKEN=$(sed -n 's/^BONITA_NOTIFICATION_TOKEN=//p' "$ENV_FILE" | tail -n 1)
  fi
fi
: "${RESCUESYNC_BACKEND_URL:=http://localhost:4000}"
: "${BONITA_NOTIFICATION_TOKEN:?Exportá BONITA_NOTIFICATION_TOKEN con el mismo valor que el backend}"
export RESCUESYNC_BACKEND_URL BONITA_NOTIFICATION_TOKEN

# Eclipse inicia Tomcat por separado. Configurar su entorno explícitamente
# evita depender de que el launcher de macOS conserve las variables de Studio.
# El secreto queda solo en la configuración local del runtime, fuera del repo.
LAUNCH="$STUDIO_APP/Contents/Eclipse/workspace/.metadata/.plugins/org.eclipse.debug.core/.launches/Tomcat v9.0 Server at localhost.launch"
if [ ! -f "$LAUNCH" ]; then
  echo 'No se encontró la configuración de Tomcat. Iniciá el runtime una vez desde Studio.' >&2
  exit 1
fi
if pgrep -f '/Contents/MacOS/BonitaStudioCommunity|org.apache.catalina.startup.Bootstrap' >/dev/null; then
  echo 'Guardá el trabajo y cerrá Studio y su runtime antes de ejecutar este script.' >&2
  exit 1
fi
/usr/bin/perl - "$LAUNCH" <<'PERL'
use strict;
use warnings;
my $path = shift @ARGV;
open my $in, '<', $path or die "No se pudo leer la configuración: $!";
local $/;
my $xml = <$in>;
close $in;
my $entries = '';
for my $key (qw(BONITA_NOTIFICATION_TOKEN RESCUESYNC_BACKEND_URL)) {
    my $value = $ENV{$key};
    $value =~ s/&/&amp;/g;
    $value =~ s/</&lt;/g;
    $value =~ s/>/&gt;/g;
    $value =~ s/"/&quot;/g;
    $value =~ s/\r/&#13;/g;
    $value =~ s/\n/&#10;/g;
    $xml =~ s{<mapEntry\s+key="$key"\s+value="[^"]*"\s*/>\s*}{}g;
    $entries .= "        <mapEntry key=\"$key\" value=\"$value\"/>\n";
}
my $map = 'org.eclipse.debug.core.environmentVariables';
if ($xml =~ /<mapAttribute key="\Q$map\E">/) {
    $xml =~ s{(<mapAttribute key="\Q$map\E">)}{$1\n$entries};
} else {
    $xml =~ s{</launchConfiguration>}{    <mapAttribute key="$map">\n$entries    </mapAttribute>\n</launchConfiguration>}
        or die "Formato de configuración inesperado";
}
chmod 0600, $path or die "No se pudieron restringir los permisos: $!";
open my $out, '>', $path or die "No se pudo actualizar la configuración: $!";
print {$out} $xml;
close $out or die "No se pudo guardar la configuración: $!";
PERL
echo 'Token configurado para el runtime de Bonita (valor oculto).'
exec "$STUDIO_APP/Contents/MacOS/BonitaStudioCommunity" "$@"
