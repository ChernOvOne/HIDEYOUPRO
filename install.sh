#!/bin/bash
# ============================================================
#  HIDEYOU PRO — Установка и управление
#  VPN Management + Accounting Platform
# ============================================================

set -euo pipefail

RED='\033[0;31m';  GREEN='\033[0;32m';  YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m';  BOLD='\033[1m'
DIM='\033[2m';     RESET='\033[0m'

ENV_FILE=".env"
LOG_FILE="./hideyoupro-install.log"

log()  { echo -e "${DIM}[$(date '+%H:%M:%S')]${RESET} $*" | tee -a "$LOG_FILE"; }
ok()   { echo -e "${GREEN}${BOLD}  ✓${RESET}  $*"; log "OK: $*"; }
warn() { echo -e "${YELLOW}${BOLD}  ⚠${RESET}  $*"; log "WARN: $*"; }
err()  { echo -e "${RED}${BOLD}  ✗${RESET}  $*"; log "ERR: $*"; }
info() { echo -e "${CYAN}  →${RESET}  $*"; }
step() { echo -e "\n${BLUE}${BOLD}══ $* ${RESET}"; }
ask()  { echo -e "${YELLOW}${BOLD}  ?${RESET}  $*"; }
sep()  { echo -e "  ${DIM}─────────────────────────────────────────────────${RESET}"; }

banner() {
  clear
  echo -e "${CYAN}${BOLD}"
  cat << 'EOF'

  ██╗  ██╗██╗██████╗ ███████╗██╗   ██╗ ██████╗ ██╗   ██╗
  ██║  ██║██║██╔══██╗██╔════╝╚██╗ ██╔╝██╔═══██╗██║   ██║
  ███████║██║██║  ██║█████╗   ╚████╔╝ ██║   ██║██║   ██║
  ██╔══██║██║██║  ██║██╔══╝    ╚██╔╝  ██║   ██║██║   ██║
  ██║  ██║██║██████╔╝███████╗   ██║   ╚██████╔╝╚██████╔╝
  ╚═╝  ╚═╝╚═╝╚═════╝ ╚══════╝   ╚═╝    ╚═════╝  ╚═════╝
                        ██████╗ ██████╗  ██████╗
                        ██╔══██╗██╔══██╗██╔═══██╗
                        ██████╔╝██████╔╝██║   ██║
                        ██╔═══╝ ██╔══██╗██║   ██║
                        ██║     ██║  ██║╚██████╔╝
                        ╚═╝     ╚═╝  ╚═╝ ╚═════╝
EOF
  echo -e "${RESET}"
  echo -e "  ${DIM}VPN Management + Accounting Platform${RESET}"
  echo -e "  ${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
}

# ── Зависимости ──────────────────────────────────────────────
check_docker() {
  command -v docker &>/dev/null || return 1
  ok "Docker $(docker version --format '{{.Server.Version}}' 2>/dev/null | sed 's/-.*//') найден"
}
check_compose() {
  docker compose version &>/dev/null 2>&1 || return 1
  ok "Docker Compose найден"
}

install_docker() {
  step "Установка Docker"
  if [[ -f /etc/os-release ]]; then . /etc/os-release; else err "Неизвестная ОС"; exit 1; fi
  case "$ID" in
    ubuntu|debian|raspbian)
      apt-get update -qq
      apt-get install -y -qq ca-certificates curl gnupg lsb-release
      install -m 0755 -d /etc/apt/keyrings
      curl -fsSL "https://download.docker.com/linux/$ID/gpg" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
      chmod a+r /etc/apt/keyrings/docker.gpg
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$ID $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
      apt-get update -qq
      apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
      ;;
    centos|rhel|fedora|rocky|almalinux)
      command -v dnf &>/dev/null && dnf install -y -q docker docker-compose-plugin || yum install -y -q docker docker-compose-plugin
      ;;
    *) err "Неподдерживаемая ОС: $ID"; exit 1 ;;
  esac
  systemctl enable docker --quiet && systemctl start docker
  ok "Docker установлен"
}

# ── .env ─────────────────────────────────────────────────────
create_env() {
  cat > "$ENV_FILE" << 'ENVEOF'
NODE_ENV=production

# ── Домен (задаётся при установке) ──────────────────────────
DOMAIN=

# ── Безопасность (генерируются автоматически) ─────────────────
JWT_SECRET=
COOKIE_SECRET=
APP_URL=

# ── База данных ───────────────────────────────────────────────
POSTGRES_PASSWORD=
DATABASE_URL=

# ── Redis ─────────────────────────────────────────────────────
REDIS_PASSWORD=
REDIS_URL=

# ── REMNAWAVE (настраивается в wizard) ────────────────────────
REMNAWAVE_URL=
REMNAWAVE_TOKEN=

# ── Telegram (настраивается в wizard) ─────────────────────────
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_NAME=

# ── Платежи (настраивается в wizard) ──────────────────────────
YUKASSA_SHOP_ID=
YUKASSA_SECRET_KEY=
YUKASSA_RETURN_URL=
CRYPTOPAY_API_TOKEN=
CRYPTOPAY_NETWORK=mainnet

# ── Email (настраивается в wizard) ────────────────────────────
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

# ── Функции ───────────────────────────────────────────────────
FEATURE_CRYPTO_PAYMENTS=true
FEATURE_REFERRAL=true
FEATURE_EMAIL_AUTH=true
FEATURE_TELEGRAM_AUTH=true
FEATURE_TRIAL=false
TRIAL_DAYS=3
FEATURE_GIFTS=true
FEATURE_BALANCE=true

REFERRAL_BONUS_DAYS=30
REFERRAL_MIN_DAYS=30
REFERRAL_REWARD_TYPE=days
REFERRAL_REWARD_AMOUNT=100

LOG_LEVEL=info
ENVEOF
}

setup_env() {
  step "Настройка окружения"

  if [[ -f "$ENV_FILE" ]]; then
    warn "Файл .env уже существует"
    ask "Перезаписать? [д/Н]"; read -r ans
    [[ "$ans" =~ ^[дДyY]$ ]] || { info "Оставляю существующий .env"; return 0; }
  fi

  create_env
  echo ""
  echo -e "  ${BOLD}Единственный вопрос:${RESET}"
  echo -e "  ${DIM}Остальное настроите в браузере при первом входе.${RESET}"
  echo ""

  printf "  ${CYAN}%-38s${RESET}" "Домен (например buh.example.com): "
  read -r domain
  domain="${domain:-localhost}"

  # Генерация секретов
  local pg_pass; pg_pass="$(openssl rand -hex 16)"
  local rd_pass; rd_pass="$(openssl rand -hex 16)"
  local jwt_secret; jwt_secret="$(openssl rand -hex 32)"
  local cookie_secret; cookie_secret="$(openssl rand -hex 32)"

  sed -i "s|^DOMAIN=.*|DOMAIN=${domain}|" "$ENV_FILE"
  sed -i "s|^APP_URL=.*|APP_URL=https://${domain}|" "$ENV_FILE"
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${pg_pass}|" "$ENV_FILE"
  sed -i "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=${rd_pass}|" "$ENV_FILE"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${jwt_secret}|" "$ENV_FILE"
  sed -i "s|^COOKIE_SECRET=.*|COOKIE_SECRET=${cookie_secret}|" "$ENV_FILE"
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://hideyoupro:${pg_pass}@postgres:5432/hideyoupro|" "$ENV_FILE"
  sed -i "s|^REDIS_URL=.*|REDIS_URL=redis://:${rd_pass}@redis:6379|" "$ENV_FILE"
  sed -i "s|^YUKASSA_RETURN_URL=.*|YUKASSA_RETURN_URL=https://${domain}/dashboard/payment-success|" "$ENV_FILE"

  ok "Файл .env настроен"
  echo -e "  ${DIM}Домен: ${BOLD}${domain}${RESET}"
  echo -e "  ${DIM}Все токены настроите в браузере при первом входе → Setup Wizard${RESET}"
}

# ── SSL ──────────────────────────────────────────────────────
setup_ssl() {
  step "SSL-сертификаты (Let's Encrypt)"

  local domain; domain=$(grep "^DOMAIN=" "$ENV_FILE" | cut -d= -f2)
  if [[ -z "$domain" || "$domain" == "localhost" ]]; then
    warn "Домен не задан или localhost — пропускаю SSL"
    return
  fi

  # Освободить порт 80
  docker compose stop nginx 2>/dev/null || true
  systemctl stop nginx 2>/dev/null || true

  command -v certbot &>/dev/null || {
    apt-get update -qq && apt-get install -y -qq certbot
  }

  certbot certonly --standalone -d "$domain" --non-interactive --agree-tos --register-unsafely-without-email 2>&1 | tee -a "$LOG_FILE"

  if [[ -f "/etc/letsencrypt/live/${domain}/fullchain.pem" ]]; then
    ok "SSL-сертификат получен для ${domain}"
  else
    warn "SSL не удалось получить — проверьте DNS"
  fi
}

# ── nginx.conf ───────────────────────────────────────────────
apply_nginx_conf() {
  local domain; domain=$(grep "^DOMAIN=" "$ENV_FILE" 2>/dev/null | cut -d= -f2)
  [[ -z "$domain" ]] && return

  local cert_path="/etc/letsencrypt/live/${domain}/fullchain.pem"
  if [[ -f "$cert_path" && -f "nginx/nginx.conf.template" ]]; then
    cp "nginx/nginx.conf.template" "nginx/nginx.conf"
    sed -i "s|MAIN_DOMAIN|${domain}|g" "nginx/nginx.conf"
    sed -i "s|ADMIN_DOMAIN|${domain}|g" "nginx/nginx.conf"
    sed -i "s|API_DOMAIN|${domain}|g" "nginx/nginx.conf"
    sed -i "s|CERT_DOMAIN|${domain}|g" "nginx/nginx.conf"
    ok "nginx.conf: SSL-режим (${domain})"
  elif [[ -f "nginx/nginx.conf.nossl" ]]; then
    cp "nginx/nginx.conf.nossl" "nginx/nginx.conf"
    ok "nginx.conf: HTTP-only режим"
  fi
}

# ── Сборка и запуск ──────────────────────────────────────────
build_services() {
  step "Сборка сервисов"
  docker compose build --no-cache 2>&1 | tee -a "$LOG_FILE"
  ok "Собрано"
}

run_migrations() {
  step "Миграции БД"

  if ! docker compose ps postgres 2>/dev/null | grep -q "Up\|running"; then
    info "Запускаю PostgreSQL..."
    docker compose up -d postgres 2>&1 | tee -a "$LOG_FILE"
  fi

  info "Жду готовности PostgreSQL..."
  local n=40
  until docker compose exec -T postgres pg_isready -U hideyoupro -d hideyoupro &>/dev/null; do
    sleep 3; n=$((n-1))
    [[ $n -le 0 ]] && { err "PostgreSQL не запустился"; return 1; }
    printf "."
  done
  echo ""; ok "PostgreSQL готов"

  info "Применяю миграции..."
  local db_url; db_url=$(grep "^DATABASE_URL=" "$ENV_FILE" | cut -d= -f2-)
  docker compose run --rm --no-deps -e DATABASE_URL="$db_url" backend npx prisma migrate deploy 2>&1 | tee -a "$LOG_FILE"
  ok "Миграции применены"
}

start_all() {
  step "Запуск сервисов"
  apply_nginx_conf
  docker compose up -d 2>&1 | tee -a "$LOG_FILE"
  ok "Запущено"
}

stop_all() {
  step "Остановка"
  docker compose down 2>&1 | tee -a "$LOG_FILE"
  ok "Остановлено"
}

show_status() {
  step "Статус сервисов"
  docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
}

show_logs() {
  echo -e "  Сервисы: ${CYAN}backend frontend nginx postgres redis bot все${RESET}"
  printf "  Чьи логи? [все] "; read -r svc; svc="${svc:-все}"
  if [[ "$svc" == "все" ]]; then docker compose logs --tail=100 -f
  else docker compose logs --tail=200 -f "$svc"; fi
}

restart_svc() {
  echo -e "  Сервисы: ${CYAN}backend frontend nginx postgres redis bot${RESET}"
  printf "  Какой перезапустить? "; read -r svc
  docker compose restart "$svc" 2>&1 | tee -a "$LOG_FILE"
  ok "Сервис $svc перезапущен"
}

do_backup() {
  step "Резервная копия"
  mkdir -p ./backups
  local ts; ts=$(date +%Y%m%d_%H%M%S)
  local db_pass; db_pass=$(grep "^POSTGRES_PASSWORD=" "$ENV_FILE" | cut -d= -f2-)
  docker compose exec -T postgres pg_dump -U hideyoupro hideyoupro | gzip > "backups/db_${ts}.sql.gz"
  cp "$ENV_FILE" "backups/env_${ts}.bak"
  ok "Бэкап: backups/db_${ts}.sql.gz"
}

do_update() {
  step "Обновление HIDEYOU PRO"
  git fetch --all --tags 2>&1 | tee -a "$LOG_FILE"
  local env_backup="/tmp/hyp_env_$(date +%s)"
  [[ -f "$ENV_FILE" ]] && cp "$ENV_FILE" "$env_backup"
  git pull --ff-only 2>&1 | tee -a "$LOG_FILE" || {
    warn "Fast-forward невозможен. Пробую reset..."
    git reset --hard origin/main 2>&1 | tee -a "$LOG_FILE"
  }
  [[ -f "$env_backup" ]] && cp "$env_backup" "$ENV_FILE" && rm -f "$env_backup" && ok ".env восстановлен"
  docker compose build 2>&1 | tee -a "$LOG_FILE"
  run_migrations
  docker compose up -d 2>&1 | tee -a "$LOG_FILE"
  ok "Обновлено до $(git describe --tags --always 2>/dev/null || git rev-parse --short HEAD)"
}

install_cli() {
  cat > /usr/local/bin/hyp << 'CLIPEOF'
#!/bin/bash
cd /root/hideyoupro && bash install.sh "$@"
CLIPEOF
  chmod +x /usr/local/bin/hyp
  ok "Команда ${BOLD}hyp${RESET} установлена (из любой папки)"
}

# ── Полная установка ─────────────────────────────────────────
full_install() {
  banner
  step "Полная установка HIDEYOU PRO"
  [[ $EUID -ne 0 ]] && warn "Запущено не от root"

  step "Проверка зависимостей"
  check_docker || {
    ask "Docker не найден. Установить? [Д/н]"; read -r ans
    [[ "$ans" =~ ^[нНnN]$ ]] && { err "Docker обязателен"; exit 1; }
    install_docker
  }
  check_compose || { err "Docker Compose не найден"; exit 1; }

  setup_env
  setup_ssl
  build_services

  step "Запуск базы данных"
  docker compose up -d postgres redis 2>&1 | tee -a "$LOG_FILE"
  sleep 8

  run_migrations

  step "Запуск всех сервисов"
  apply_nginx_conf
  docker compose up -d 2>&1 | tee -a "$LOG_FILE"
  sleep 5

  install_cli

  local domain; domain=$(grep "^DOMAIN=" "$ENV_FILE" | cut -d= -f2)

  echo ""; sep
  ok "HIDEYOU PRO установлен!"
  sep
  echo ""
  echo -e "  ${BOLD}Откройте в браузере:${RESET}"
  echo -e "  ${GREEN}https://${domain}${RESET}"
  echo ""
  echo -e "  ${BOLD}Что дальше:${RESET}"
  echo -e "  1. Зарегистрируйте первого администратора"
  echo -e "  2. Пройдите Setup Wizard (настройка токенов)"
  echo -e "  3. Готово!"
  echo ""
  echo -e "  ${BOLD}Управление:${RESET}  ${CYAN}hyp${RESET}  (из любой папки)"
  echo ""
}

# ── Меню ─────────────────────────────────────────────────────
main_menu() {
  [[ ! -f "/usr/local/bin/hyp" ]] && [[ $EUID -eq 0 ]] && install_cli 2>/dev/null || true
  while true; do
    banner
    echo -e "  ${BOLD}Главное меню${RESET}\n"
    echo -e "  ${CYAN}${BOLD}── Установка ─────────────────────────${RESET}"
    echo -e "  ${BOLD}[1]${RESET}  Полная установка (с нуля)"
    echo -e "  ${BOLD}[2]${RESET}  Настроить .env"
    echo -e "  ${BOLD}[3]${RESET}  Настроить SSL"
    echo ""
    echo -e "  ${CYAN}${BOLD}── Управление ────────────────────────${RESET}"
    echo -e "  ${BOLD}[4]${RESET}  Запустить"
    echo -e "  ${BOLD}[5]${RESET}  Остановить"
    echo -e "  ${BOLD}[6]${RESET}  Перезапустить сервис"
    echo -e "  ${BOLD}[7]${RESET}  Статус"
    echo -e "  ${BOLD}[8]${RESET}  Логи"
    echo ""
    echo -e "  ${CYAN}${BOLD}── Данные ────────────────────────────${RESET}"
    echo -e "  ${BOLD}[9]${RESET}  Миграции БД"
    echo -e "  ${BOLD}[10]${RESET} Резервная копия"
    echo ""
    echo -e "  ${CYAN}${BOLD}── Обслуживание ──────────────────────${RESET}"
    echo -e "  ${BOLD}[11]${RESET} Обновить"
    echo -e "  ${BOLD}[12]${RESET} Пересобрать образы"
    echo -e "  ${BOLD}[0]${RESET}  Выход"
    echo ""; sep
    printf "  ${BOLD}Выбери пункт:${RESET} "
    read -r choice
    case "$choice" in
      1)  full_install ;;
      2)  setup_env ;;
      3)  setup_ssl ;;
      4)  start_all ;;
      5)  stop_all ;;
      6)  restart_svc ;;
      7)  show_status ;;
      8)  show_logs ;;
      9)  run_migrations ;;
      10) do_backup ;;
      11) do_update ;;
      12) build_services ;;
      0)  echo ""; info "До свидания!"; echo ""; exit 0 ;;
      *)  warn "Неизвестный пункт" ;;
    esac
    echo ""; printf "  ${DIM}Enter для возврата...${RESET}"; read -r
  done
}

# ── Точка входа ──────────────────────────────────────────────
case "${1:-menu}" in
  install)   full_install ;;
  update)    do_update ;;
  start)     start_all ;;
  stop)      stop_all ;;
  status)    show_status ;;
  logs)      show_logs ;;
  backup)    do_backup ;;
  migrate)   run_migrations ;;
  menu|"")   main_menu ;;
  *)
    echo "Использование: $0 [install|update|start|stop|status|logs|backup|migrate]"
    exit 1 ;;
esac
