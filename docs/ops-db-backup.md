# server DB 备份与恢复（#1151 / ADR 0016 裁决 7）

状态离机之后，server 的 SQLite 库（任务 / 线程 / 审核记录的真值）是唯一单点。本页是它的备份与恢复正本：脚本在仓内（`scripts/ops/backup-server-db.sh`），调度与目标机属部署侧，随本页模板落地。

## 备份

```sh
scripts/ops/backup-server-db.sh --db ~/.pacman/server.db --out ~/backups/pacman \
  --remote dmit:~/pacman-db-backups --keep 48
```

行为：`sqlite3 .backup`（活库安全、原子）→ `integrity_check` 不过即失败 → gzip 落本地 `--out` → scp 推远端 → 两端各滚动保留最新 48 份。RPO = 调度间隔（一小时）。**任何一步失败都以非零退出并打印失败点**——备份是「坏了没人会知道」的那类东西，调度侧必须能看到失败（timer 失败状态 / cron 邮件），不许静默。

## 调度（mea：systemd user timer）

`~/.config/systemd/user/pacman-db-backup.service`：

```ini
[Unit]
Description=pacman server DB backup

[Service]
Type=oneshot
ExecStart=/home/measure/pacman/scripts/ops/backup-server-db.sh --db %h/.pacman/server.db --out %h/backups/pacman --remote dmit:~/pacman-db-backups --keep 48
```

`~/.config/systemd/user/pacman-db-backup.timer`：

```ini
[Unit]
Description=hourly pacman server DB backup

[Timer]
OnCalendar=hourly
Persistent=true

[Install]
WantedBy=timers.target
```

启用：`systemctl --user daemon-reload && systemctl --user enable --now pacman-db-backup.timer`。`Persistent=true` = 停机窗口在开机后补跑。验证：`systemctl --user list-timers pacman-db-backup.timer` 有下一拍；手动触发一次 `systemctl --user start pacman-db-backup.service` 后两端目录各多一份。

## 恢复

1. `systemctl --user stop pacman-dev-server`（停写）。
2. 从 dmit 拉回最新一份：`scp dmit:~/pacman-db-backups/<最新>.db.gz /tmp/` → `gunzip`。
3. `sqlite3 /tmp/server.db 'PRAGMA integrity_check;'` 必须 `ok`。
4. 换入：`mv /tmp/server.db ~/.pacman/server.db`（旧库改名留底，别删）。
5. `systemctl --user start pacman-dev-server`，开 web 抽查最近任务在；daemon 会自重连（`systemctl --user status pacman-daemon` 看无报错）。

## 演练纪律

恢复演练永远在**副本**上做：拉回备份 → gunzip → integrity_check + 关键表行数与活库对账（todo / build / chief_thread）。不碰运行中的 server。演练输出随首次落地的 PR 归档进 `docs/verify/1151/`。
