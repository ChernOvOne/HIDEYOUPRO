-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'EDITOR', 'INVESTOR');

-- CreateEnum
CREATE TYPE "SubStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED', 'TRIAL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('YUKASSA', 'CRYPTOPAY', 'BALANCE', 'MANUAL', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('SUBSCRIPTION', 'TOPUP', 'GIFT');

-- CreateEnum
CREATE TYPE "TariffType" AS ENUM ('SUBSCRIPTION', 'TRAFFIC_ADDON');

-- CreateEnum
CREATE TYPE "NewsType" AS ENUM ('NEWS', 'PROMOTION');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'WARNING', 'SUCCESS', 'PROMO');

-- CreateEnum
CREATE TYPE "GiftStatus" AS ENUM ('PENDING', 'CLAIMED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BalanceTransactionType" AS ENUM ('TOPUP', 'REFERRAL_REWARD', 'PURCHASE', 'GIFT', 'REFUND');

-- CreateEnum
CREATE TYPE "ReferralBonusType" AS ENUM ('DAYS', 'MONEY');

-- CreateEnum
CREATE TYPE "EmailVerificationType" AS ENUM ('REGISTRATION', 'EMAIL_CHANGE', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "BroadcastStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BotMsgDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "BotBlockType" AS ENUM ('MESSAGE', 'CONDITION', 'ACTION', 'INPUT', 'DELAY', 'SPLIT', 'REDIRECT', 'NOTIFY_ADMIN', 'HTTP', 'REACTION');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "InkasType" AS ENUM ('DIVIDEND', 'RETURN_INV', 'INVESTMENT');

-- CreateEnum
CREATE TYPE "ServerStatus" AS ENUM ('ACTIVE', 'WARNING', 'EXPIRED', 'INACTIVE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "telegram_id" TEXT,
    "telegram_name" TEXT,
    "password_hash" TEXT,
    "remnawave_uuid" TEXT,
    "sub_expire_at" TIMESTAMP(3),
    "sub_status" "SubStatus" NOT NULL DEFAULT 'INACTIVE',
    "sub_link" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "bonus_days" INTEGER NOT NULL DEFAULT 0,
    "total_paid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payments_count" INTEGER NOT NULL DEFAULT 0,
    "referral_code" TEXT NOT NULL,
    "referred_by_id" TEXT,
    "utm_code" TEXT,
    "source" TEXT,
    "avatar_color" TEXT,
    "notes" TEXT,
    "last_ip" TEXT,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tariffs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_rub" DECIMAL(10,2) NOT NULL,
    "price_usdt" DECIMAL(10,2),
    "duration_days" INTEGER NOT NULL,
    "traffic_gb" INTEGER,
    "device_limit" INTEGER NOT NULL DEFAULT 3,
    "countries" TEXT,
    "protocol" TEXT,
    "speed" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "is_trial" BOOLEAN NOT NULL DEFAULT false,
    "type" "TariffType" NOT NULL DEFAULT 'SUBSCRIPTION',
    "remnawave_tag" TEXT,
    "remnawave_squads" TEXT[],
    "traffic_strategy" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'single',
    "variants" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tariffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tariff_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" "PaymentProvider" NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL DEFAULT 'SUBSCRIPTION',
    "external_id" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_bonuses" (
    "id" TEXT NOT NULL,
    "referrer_id" TEXT NOT NULL,
    "triggered_by_payment_id" TEXT NOT NULL,
    "bonus_type" "ReferralBonusType" NOT NULL DEFAULT 'DAYS',
    "bonus_days" INTEGER NOT NULL DEFAULT 0,
    "bonus_amount" DECIMAL(10,2),
    "bonus_currency" TEXT DEFAULT 'RUB',
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_bonuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "NewsType" NOT NULL DEFAULT 'NEWS',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "publish_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "image_url" TEXT,
    "cta_text" TEXT,
    "cta_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_reads" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_proxies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tg_link" TEXT,
    "https_link" TEXT,
    "tag" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_proxies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_notes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_subscriptions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "recipient_id" TEXT,
    "tariff_id" TEXT NOT NULL,
    "status" "GiftStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "claimed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balance_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "type" "BalanceTransactionType" NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "balance_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "EmailVerificationType" NOT NULL DEFAULT 'REGISTRATION',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instruction_platforms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instruction_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instruction_apps" (
    "id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "deeplink" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instruction_apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instruction_steps" (
    "id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "image_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instruction_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "import_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "remnawave_uuid" TEXT,
    "matched_by" TEXT,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "bonus_days" INTEGER,
    "discount_pct" INTEGER,
    "balance_amount" DECIMAL(10,2),
    "tariff_ids" TEXT[],
    "max_uses" INTEGER,
    "max_uses_per_user" INTEGER NOT NULL DEFAULT 1,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_usages" (
    "id" TEXT NOT NULL,
    "promo_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_messages" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "user_id" TEXT,
    "direction" "BotMsgDirection" NOT NULL,
    "text" TEXT NOT NULL,
    "buttons_json" JSONB,
    "callback_data" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcasts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "BroadcastStatus" NOT NULL DEFAULT 'DRAFT',
    "channel_tg" BOOLEAN NOT NULL DEFAULT false,
    "channel_email" BOOLEAN NOT NULL DEFAULT false,
    "tg_text" TEXT,
    "tg_parse_mode" TEXT NOT NULL DEFAULT 'Markdown',
    "tg_buttons" JSONB,
    "tg_media_url" TEXT,
    "tg_media_type" TEXT,
    "tg_poll_question" TEXT,
    "tg_poll_options" JSONB,
    "tg_poll_anon" BOOLEAN NOT NULL DEFAULT true,
    "tg_poll_multi" BOOLEAN NOT NULL DEFAULT false,
    "email_subject" TEXT,
    "email_html" TEXT,
    "email_template" TEXT NOT NULL DEFAULT 'dark',
    "audience_type" TEXT NOT NULL DEFAULT 'all',
    "audience_value" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "fail_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funnels" (
    "id" TEXT NOT NULL,
    "trigger_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funnels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funnel_steps" (
    "id" TEXT NOT NULL,
    "funnel_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL DEFAULT 0,
    "delay_type" TEXT NOT NULL DEFAULT 'immediate',
    "delay_value" INTEGER NOT NULL DEFAULT 0,
    "delay_time" TEXT,
    "condition" TEXT NOT NULL DEFAULT 'none',
    "channel_tg" BOOLEAN NOT NULL DEFAULT false,
    "channel_email" BOOLEAN NOT NULL DEFAULT false,
    "channel_lk" BOOLEAN NOT NULL DEFAULT false,
    "tg_text" TEXT,
    "tg_buttons" JSONB,
    "tg_parse_mode" TEXT NOT NULL DEFAULT 'Markdown',
    "email_subject" TEXT,
    "email_html" TEXT,
    "email_btn_text" TEXT,
    "email_btn_url" TEXT,
    "email_template" TEXT NOT NULL DEFAULT 'dark',
    "lk_title" TEXT,
    "lk_message" TEXT,
    "lk_type" TEXT NOT NULL DEFAULT 'INFO',
    "action_type" TEXT NOT NULL DEFAULT 'none',
    "action_value" INTEGER NOT NULL DEFAULT 0,
    "action_promo_expiry" INTEGER NOT NULL DEFAULT 7,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funnel_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funnel_logs" (
    "id" TEXT NOT NULL,
    "funnel_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL DEFAULT 0,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funnel_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_block_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_block_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_blocks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group_id" TEXT,
    "type" "BotBlockType" NOT NULL,
    "text" TEXT,
    "media_url" TEXT,
    "media_type" TEXT,
    "parse_mode" TEXT NOT NULL DEFAULT 'Markdown',
    "pin_message" BOOLEAN NOT NULL DEFAULT false,
    "delete_prev" TEXT NOT NULL DEFAULT 'none',
    "reply_keyboard" JSONB,
    "remove_reply_kb" BOOLEAN NOT NULL DEFAULT false,
    "condition_type" TEXT,
    "condition_value" TEXT,
    "next_block_true" TEXT,
    "next_block_false" TEXT,
    "action_type" TEXT,
    "action_value" TEXT,
    "next_block_id" TEXT,
    "input_prompt" TEXT,
    "input_var" TEXT,
    "input_validation" TEXT,
    "delay_minutes" INTEGER,
    "split_variants" JSONB,
    "redirect_block_id" TEXT,
    "reaction_emoji" TEXT,
    "notify_admin_text" TEXT,
    "http_method" TEXT,
    "http_url" TEXT,
    "http_headers" JSONB,
    "http_body" TEXT,
    "http_save_var" TEXT,
    "throttle_minutes" INTEGER,
    "schedule_start" TEXT,
    "schedule_end" TEXT,
    "schedule_days" JSONB,
    "schedule_block_id" TEXT,
    "is_draft" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "published_at" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_buttons" (
    "id" TEXT NOT NULL,
    "block_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "next_block_id" TEXT,
    "url" TEXT,
    "row" INTEGER NOT NULL DEFAULT 0,
    "col" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_buttons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_triggers" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "block_id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_block_stats" (
    "id" TEXT NOT NULL,
    "block_id" TEXT NOT NULL,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bot_block_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_tags" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_variables" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#534AB7',
    "icon" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_tag_rules" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,

    CONSTRAINT "auto_tag_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "date" DATE NOT NULL,
    "category_id" TEXT,
    "description" TEXT,
    "receipt_url" TEXT,
    "is_historical" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT,
    "payment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role_label" TEXT,
    "tg_username" TEXT,
    "tg_id" TEXT,
    "share_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "avatar_color" TEXT,
    "initials" TEXT,
    "notes" TEXT,
    "initial_investment" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "initial_returned" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "initial_dividends" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inkas_records" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "type" "InkasType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "date" DATE NOT NULL,
    "month_label" TEXT,
    "description" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inkas_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_campaigns" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "channel_name" TEXT NOT NULL,
    "channel_url" TEXT,
    "format" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "subscribers_gained" INTEGER NOT NULL DEFAULT 0,
    "screenshot_url" TEXT,
    "notes" TEXT,
    "budget_source" TEXT NOT NULL DEFAULT 'account',
    "investor_partner_id" TEXT,
    "utm_code" TEXT,
    "target_url" TEXT,
    "target_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utm_clicks" (
    "id" TEXT NOT NULL,
    "utm_code" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "referer" TEXT,
    "country" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utm_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utm_leads" (
    "id" TEXT NOT NULL,
    "utm_code" TEXT NOT NULL,
    "customer_id" TEXT,
    "customer_name" TEXT,
    "username" TEXT,
    "extra_data" JSONB,
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utm_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT,
    "ip_address" TEXT,
    "purpose" TEXT,
    "panel_url" TEXT,
    "monthly_cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "payment_day" INTEGER,
    "next_payment_date" DATE,
    "status" "ServerStatus" NOT NULL DEFAULT 'ACTIVE',
    "notify_days_before" INTEGER NOT NULL DEFAULT 3,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_payments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "payment_day" INTEGER NOT NULL,
    "description" TEXT,
    "server_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_channels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notify_income" BOOLEAN NOT NULL DEFAULT true,
    "notify_expense" BOOLEAN NOT NULL DEFAULT true,
    "notify_inkas" BOOLEAN NOT NULL DEFAULT false,
    "notify_payment" BOOLEAN NOT NULL DEFAULT true,
    "notify_ad" BOOLEAN NOT NULL DEFAULT false,
    "notify_server" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "target_amount" DECIMAL(10,2) NOT NULL,
    "current_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'revenue',
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_stats" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "online_count" INTEGER,
    "online_weekly" INTEGER,
    "pdp_in_channel" INTEGER,
    "avg_check" DECIMAL(10,2),
    "total_payments" INTEGER,
    "total_refunds" INTEGER,
    "tag_paid" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "old_data" JSONB,
    "new_data" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used" TIMESTAMP(3),
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_remnawave_uuid_key" ON "users"("remnawave_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_external_id_key" ON "payments"("external_id");

-- CreateIndex
CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "referral_bonuses_triggered_by_payment_id_key" ON "referral_bonuses"("triggered_by_payment_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notification_reads_user_id_notification_id_key" ON "notification_reads"("user_id", "notification_id");

-- CreateIndex
CREATE INDEX "admin_notes_user_id_idx" ON "admin_notes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "gift_subscriptions_code_key" ON "gift_subscriptions"("code");

-- CreateIndex
CREATE INDEX "balance_transactions_user_id_created_at_idx" ON "balance_transactions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "email_verifications_email_code_idx" ON "email_verifications"("email", "code");

-- CreateIndex
CREATE UNIQUE INDEX "import_records_user_id_key" ON "import_records"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "promo_usages_promo_id_user_id_key" ON "promo_usages"("promo_id", "user_id");

-- CreateIndex
CREATE INDEX "bot_messages_chat_id_created_at_idx" ON "bot_messages"("chat_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "bot_messages_user_id_idx" ON "bot_messages"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "funnels_trigger_id_key" ON "funnels"("trigger_id");

-- CreateIndex
CREATE INDEX "funnel_steps_funnel_id_step_order_idx" ON "funnel_steps"("funnel_id", "step_order");

-- CreateIndex
CREATE INDEX "funnel_logs_funnel_id_user_id_step_order_idx" ON "funnel_logs"("funnel_id", "user_id", "step_order");

-- CreateIndex
CREATE INDEX "bot_blocks_group_id_idx" ON "bot_blocks"("group_id");

-- CreateIndex
CREATE INDEX "bot_buttons_block_id_idx" ON "bot_buttons"("block_id");

-- CreateIndex
CREATE UNIQUE INDEX "bot_triggers_type_value_key" ON "bot_triggers"("type", "value");

-- CreateIndex
CREATE UNIQUE INDEX "bot_block_stats_block_id_date_key" ON "bot_block_stats"("block_id", "date");

-- CreateIndex
CREATE INDEX "user_tags_tag_idx" ON "user_tags"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "user_tags_user_id_tag_key" ON "user_tags"("user_id", "tag");

-- CreateIndex
CREATE UNIQUE INDEX "user_variables_user_id_key_key" ON "user_variables"("user_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_payment_id_key" ON "transactions"("payment_id");

-- CreateIndex
CREATE INDEX "transactions_type_date_idx" ON "transactions"("type", "date");

-- CreateIndex
CREATE INDEX "transactions_category_id_idx" ON "transactions"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "partners_user_id_key" ON "partners"("user_id");

-- CreateIndex
CREATE INDEX "inkas_records_partner_id_idx" ON "inkas_records"("partner_id");

-- CreateIndex
CREATE UNIQUE INDEX "ad_campaigns_utm_code_key" ON "ad_campaigns"("utm_code");

-- CreateIndex
CREATE INDEX "utm_clicks_utm_code_idx" ON "utm_clicks"("utm_code");

-- CreateIndex
CREATE INDEX "utm_leads_utm_code_idx" ON "utm_leads"("utm_code");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_stats_year_month_key" ON "monthly_stats"("year", "month");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_id_fkey" FOREIGN KEY ("referred_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tariff_id_fkey" FOREIGN KEY ("tariff_id") REFERENCES "tariffs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_bonuses" ADD CONSTRAINT "referral_bonuses_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_bonuses" ADD CONSTRAINT "referral_bonuses_triggered_by_payment_id_fkey" FOREIGN KEY ("triggered_by_payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_notes" ADD CONSTRAINT "admin_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_notes" ADD CONSTRAINT "admin_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_subscriptions" ADD CONSTRAINT "gift_subscriptions_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_subscriptions" ADD CONSTRAINT "gift_subscriptions_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_transactions" ADD CONSTRAINT "balance_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instruction_apps" ADD CONSTRAINT "instruction_apps_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "instruction_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instruction_steps" ADD CONSTRAINT "instruction_steps_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "instruction_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_records" ADD CONSTRAINT "import_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_usages" ADD CONSTRAINT "promo_usages_promo_id_fkey" FOREIGN KEY ("promo_id") REFERENCES "promo_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_usages" ADD CONSTRAINT "promo_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_messages" ADD CONSTRAINT "bot_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_steps" ADD CONSTRAINT "funnel_steps_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "funnels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_logs" ADD CONSTRAINT "funnel_logs_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "funnels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_blocks" ADD CONSTRAINT "bot_blocks_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "bot_block_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_buttons" ADD CONSTRAINT "bot_buttons_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "bot_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_triggers" ADD CONSTRAINT "bot_triggers_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "bot_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_block_stats" ADD CONSTRAINT "bot_block_stats_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "bot_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tags" ADD CONSTRAINT "user_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_variables" ADD CONSTRAINT "user_variables_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_tag_rules" ADD CONSTRAINT "auto_tag_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inkas_records" ADD CONSTRAINT "inkas_records_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inkas_records" ADD CONSTRAINT "inkas_records_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_investor_partner_id_fkey" FOREIGN KEY ("investor_partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utm_clicks" ADD CONSTRAINT "utm_clicks_utm_code_fkey" FOREIGN KEY ("utm_code") REFERENCES "ad_campaigns"("utm_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utm_leads" ADD CONSTRAINT "utm_leads_utm_code_fkey" FOREIGN KEY ("utm_code") REFERENCES "ad_campaigns"("utm_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
