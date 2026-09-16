# ⚡ TeleFlow Pro — Advanced Telegram Bot Management Platform

**TeleFlow Pro** is a production-ready Telegram Bot Management Platform built with **Nuxt 4**, **Vue 3**, **Tailwind CSS 4**, **Pinia**, and **Nitro Server**.

The platform is designed to manage Telegram bots, groups, channels, scheduled broadcasts, automated messaging workflows, message templates, delivery analytics, and real-time monitoring from a modern web dashboard.

Unlike basic Telegram schedulers, TeleFlow Pro focuses on reliability, scalability, security, and enterprise-level Telegram Bot API integration.

---

# 🚀 Core Features

## 🤖 Telegram Bot Management

* Add multiple Telegram bots
* Secure token storage using AES-256 encryption
* Bot status monitoring
* Verify bot credentials via Telegram API
* Display bot information:

  * Bot ID
  * Username
  * First Name
  * Permissions
  * Status

### Supported Telegram APIs

* getMe
* getUpdates
* setWebhook
* deleteWebhook
* sendMessage
* sendPhoto
* sendDocument
* sendVideo
* sendMediaGroup
* editMessageText
* deleteMessage
* pinChatMessage
* unpinChatMessage

---

## 👥 Telegram Group & Channel Management

Manage all Telegram destinations from a single dashboard.

### Features

* Add Groups
* Add Channels
* Add Supergroups
* Add Private Chats
* Enable / Disable Targets
* Bulk Import Chat IDs
* Bulk Delete Targets
* Search & Filter Groups
* Real-Time Status Checking

### Auto Detection

When a bot is added:

* Detect available groups
* Detect channels
* Verify bot permissions
* Verify admin access

---

## 📅 Smart Message Scheduling

Create powerful automated campaigns.

### Schedule Types

* One Time
* Daily
* Weekly
* Monthly
* Custom Cron Expression

### Examples

Morning Message

08:00 AM

Lunch Reminder

12:00 PM

Evening Broadcast

05:00 PM

Night Report

10:00 PM

### Timezone Support

* UTC
* Asia/Phnom_Penh
* Asia/Bangkok
* Asia/Singapore
* Asia/Tokyo
* Custom Timezone Selection

Wall-clock fields are resolved with `Intl.DateTimeFormat.formatToParts`, so the
Worker's own timezone never affects when a schedule fires.

### Delivery Reliability

A Cloudflare cron trigger is best-effort — a tick can arrive late or be dropped.
Matching the clock exactly would silently lose the broadcast whenever the 08:00
tick slipped to 08:01, so a schedule stays **due for 10 minutes** after its slot
(`MISSED_RUN_GRACE_MINUTES` in `server/utils/scheduler.ts`).

Each dispatch resolves to the *slot* it belongs to rather than to "now", and the
slot is written to `lastExecutedAt` before any message is sent. A repeated or
delayed tick resolves to that same slot, sees it already claimed, and skips.

Known limitation: the claim lives in KV, which is eventually consistent (reads
can be served from edge cache for up to ~60s). A tick landing in the grace
window on a stale read can still double-send. Exactly-once delivery would need
the claim to move into a Durable Object.

### Manual Trigger

`POST /api/schedules/run` runs one scheduler tick on demand instead of waiting
for the cron. Its response includes a `skipped` reason — `no bot configured`,
`no active target groups`, `bot token could not be decrypted`, and so on —
which is the first thing to check when broadcasts are not arriving.

`{ "force": true }` dispatches every active schedule immediately regardless of
its slot, to confirm the token, chat IDs and permissions work at all.

---

## 📝 Rich Telegram Message Builder

Supports Telegram formatting:

### HTML Mode

```html
<b>Bold</b>
<i>Italic</i>
<u>Underline</u>
<code>Code</code>
<a href="https://example.com">Link</a>
```

### Markdown V2 Mode

```md
*Bold*
_Italic_
~Strike~
`Code`
```

### Message Types

* Text Messages
* Photos
* Videos
* Documents
* Stickers
* Polls
* Location
* Contact
* Albums

---

## 🔄 Queue & Retry System

Production-grade delivery handling.

### Retry Policy

* 1st Retry → 30 seconds
* 2nd Retry → 2 minutes
* 3rd Retry → 10 minutes

### Automatic Handling

* Network failures
* Telegram API errors
* Rate limit errors
* Temporary outages

---

## ⚡ Telegram Rate Limit Protection

Built-in Telegram flood protection.

### Features

* Queue Processing
* Request Throttling
* Sequential Dispatching
* Smart Delays
* Retry Backoff

### Prevents

* 429 Too Many Requests
* FloodWait Errors
* API Blocking

---

## 📊 Analytics Dashboard

Real-time monitoring.

### Statistics

* Total Bots
* Active Bots
* Total Groups
* Total Channels
* Messages Sent
* Success Rate
* Failed Deliveries
* Pending Queue

### Charts

* Daily Messages
* Weekly Activity
* Monthly Activity
* Success vs Failure
* Top Active Groups

---

## 🪵 Audit Logs & Tracking

Track every Telegram activity.

### Log Information

* Schedule ID
* Group ID
* Chat Title
* Message Content
* Execution Time
* Telegram Response
* Delivery Status
* Error Details

### Status Types

* SUCCESS
* FAILED
* PENDING
* RETRYING
* CANCELLED

---

## 🔔 Notification System

System notifications for:

* Failed Messages
* Bot Disconnected
* Invalid Token
* Missing Permissions
* Schedule Errors
* Queue Backlog

---

## 🔒 Security Features

### Encryption

* AES-256-CBC
* Random IV Generation
* Secure Token Storage

### Protection

* API Validation
* Input Sanitization
* Rate Limiting
* CSRF Protection
* Secure Environment Variables

---

## 🛠️ Technology Stack

### Frontend

* Nuxt 4
* Vue 3
* Pinia
* Tailwind CSS 4
* Lucide Icons

### Backend

* Nitro Server
* H3 API Routes
* Nitro Tasks + Cloudflare cron triggers (node-cron cannot run on Workers)
* Telegram Bot API

### Storage

* Local JSON Database
* Atomic Writes
* Auto Backup System

---

## 📂 Enhanced Project Structure

```text
teleflow-pro/
│
├── app/
│   ├── components/
│   ├── pages/
│   ├── stores/
│   ├── composables/
│   └── layouts/
│
├── server/
│   ├── api/
│   │   ├── bots/
│   │   ├── groups/
│   │   ├── schedules/
│   │   ├── messages/
│   │   ├── logs/
│   │   └── dashboard/
│   │
│   ├── tasks/
│   │   └── broadcast.ts     # runs every minute via Cloudflare cron
│   │
│   └── utils/
│       ├── crypto.ts
│       ├── db.ts
│       ├── scheduler.ts     # slot matching + dispatch
│       └── telegram.ts
│
├── data/                    # dev only; production reads/writes Cloudflare KV
│   ├── bot.json
│   ├── groups.json
│   ├── schedules.json
│   ├── logs.json
│   └── moderation.json
│
├── nuxt.config.ts
├── wrangler.toml
└── package.json
```

---

# 🎯 Production Goals

TeleFlow Pro should operate as a complete Telegram automation platform capable of:

* Managing multiple Telegram bots
* Managing unlimited groups/channels
* Running automated broadcasts
* Supporting media messages
* Handling retries automatically
* Monitoring delivery performance
* Providing complete audit logs
* Running continuously without external databases

Perfect for communities, businesses, customer support teams, educational groups, news channels, and marketing automation workflows.
