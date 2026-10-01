#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(dirname "$SCRIPT_DIR")
cd "$PROJECT_DIR"

if [ ! -f .env ]; then
  echo "Error: missing runtime configuration: $PROJECT_DIR/.env" >&2
  exit 1
fi
ATTVIZ_PORT=${ATTVIZ_PORT:-$(sed -n 's/^[[:space:]]*ATTVIZ_PORT[[:space:]]*=[[:space:]]*//p' .env | tail -n 1)}
case "$ATTVIZ_PORT" in
  ''|*[!0-9]*) echo "Error: ATTVIZ_PORT in .env must be an integer." >&2; exit 1 ;;
esac
if [ "$ATTVIZ_PORT" -lt 1 ] || [ "$ATTVIZ_PORT" -gt 65535 ]; then
  echo "Error: ATTVIZ_PORT in .env must be between 1 and 65535." >&2
  exit 1
fi
export ATTVIZ_PORT

# Match bind-mounted campaign files to the invoking Unix user. Callers may
# override either value; Docker Desktop users can safely rely on the defaults.
ATTVIZ_UID=${ATTVIZ_UID:-$(id -u)}
ATTVIZ_GID=${ATTVIZ_GID:-$(id -g)}
export ATTVIZ_UID ATTVIZ_GID

usage() {
  cat <<'EOF'
Usage: ./scripts/docker.sh <command>

Commands:
  up        Start existing image in the background
  rebuild   Rebuild the image and start the service
  start     Start a previously stopped service
  stop      Stop the service without removing it
  restart   Restart the service without rebuilding
  down      Stop and remove the container and network
  logs      Follow application logs
  status    Show Compose service status
  health    Query the application health endpoint
EOF
}

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: Docker is not installed or is not available in PATH." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Error: Docker Compose v2 is required (docker compose)." >&2
  exit 1
fi

command=${1:-}
case "$command" in
  up)      docker compose up -d ;;
  rebuild) docker compose up --build -d ;;
  start)   docker compose start ;;
  stop)    docker compose stop ;;
  restart) docker compose restart ;;
  down)    docker compose down ;;
  logs)    docker compose logs -f attack-visualizer ;;
  status)  docker compose ps ;;
  health)  curl --fail --silent --show-error "http://127.0.0.1:${ATTVIZ_PORT}/healthz" && printf '\n' ;;
  -h|--help|help) usage ;;
  *) usage >&2; exit 2 ;;
esac
