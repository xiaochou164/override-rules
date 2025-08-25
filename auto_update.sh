#!/bin/bash

# === 配置信息 ===
CONFIG_URL=""
CONFIG_PATH="/etc/mihomo/config.yaml"
BACKUP_DIR="/etc/mihomo"
BACKUP_PREFIX="config.yaml"
MAX_BACKUPS=7
TMP_PATH="/tmp/config.yaml.tmp"
LOG_FILE="/var/log/mihomo_update.log"
RETRY_MAX=3
RETRY_DELAY=5
RETRY_BACKOFF=2

# === 日志 ===
log() {
    echo "$(date '+%F %T') $1" | tee -a "$LOG_FILE"
}

# === 备份现有配置，并自动清理旧备份 ===
backup_config() {
    if [ -f "$CONFIG_PATH" ]; then
        backup_file="$BACKUP_DIR/${BACKUP_PREFIX}.$(date '+%Y%m%d_%H%M%S').bak"
        cp "$CONFIG_PATH" "$backup_file"
        log "配置文件已备份到 $backup_file"
        # 清理多余的备份，只保留最新的 $MAX_BACKUPS 个
        old_backups=$(ls -1t $BACKUP_DIR/${BACKUP_PREFIX}.*.bak 2>/dev/null | tail -n +$(($MAX_BACKUPS+1)))
        for f in $old_backups; do
            rm -f "$f" && log "已删除旧备份 $f"
        done
    else
        log "未找到现有配置文件，无需备份"
    fi
}

# === 下载新配置 ===
download_config() {
    log "开始下载新配置..."

    local attempt=1
    local delay="$RETRY_DELAY"
    while [ "$attempt" -le "$RETRY_MAX" ]; do
        curl -fsSL -o "$TMP_PATH" "$CONFIG_URL"
        local rc=$?

        if [ $rc -eq 0 ] && [ -s "$TMP_PATH" ]; then
            log "配置下载完成（第 $attempt 次尝试）"
            return 0
        fi

        # 失败原因与日志
        if [ $rc -ne 0 ]; then
            log "下载失败（第 $attempt/$RETRY_MAX 次）：curl 返回码 $rc"
        elif [ ! -s "$TMP_PATH" ]; then
            log "下载失败（第 $attempt/$RETRY_MAX 次）：文件为空或校验未通过"
        fi

        # 若还有机会，等待后重试
        if [ "$attempt" -lt "$RETRY_MAX" ]; then
            log "将在 ${delay}s 后重试下载"
            sleep "$delay"
            delay=$((delay * RETRY_BACKOFF))
        fi
        attempt=$((attempt + 1))
    done

    # 清理无效临时文件
    [ -f "$TMP_PATH" ] && [ ! -s "$TMP_PATH" ] && rm -f "$TMP_PATH"
    log "下载配置多次失败，放弃更新"
    return 1
}

# === 更新配置文件 ===
replace_config() {
    mv "$TMP_PATH" "$CONFIG_PATH"
    log "配置文件已更新"
}

# === 重启 mihomo 服务 ===
restart_service() {
    local attempt=1
    local delay="$RETRY_DELAY"
    while [ "$attempt" -le "$RETRY_MAX" ]; do
        systemctl restart mihomo
        local rc=$?
        if [ $rc -eq 0 ]; then
            log "mihomo 服务已重启（第 $attempt 次尝试）"
            return 0
        fi
        log "mihomo 服务重启失败（第 $attempt/$RETRY_MAX 次），返回码 $rc"
        if [ "$attempt" -lt "$RETRY_MAX" ]; then
            log "将在 ${delay}s 后重试重启"
            sleep "$delay"
            delay=$((delay * RETRY_BACKOFF))
        fi
        attempt=$((attempt + 1))
    done
    log "mihomo 服务多次重启失败，请手动检查"
    return 1
}

main() {
    backup_config

    download_config
    DL_STATUS=$?
    if [ "$DL_STATUS" -ne 0 ]; then
        log "操作终止：配置文件未更新，保留原有配置"
        exit 1
    fi

    replace_config

    restart_service

    log "=== 更新流程完成 ==="
}

main "$@"
