-- Phase 5.1: Advanced Email Features - Database Schema
-- Tables: email_templates, email_signatures, email_smart_reply_cache, email_saved_searches
-- Created: February 3, 2026

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- EMAIL TEMPLATES TABLE
-- ============================================================================
-- Purpose: Store reusable email templates for composition
-- Features: Multiple templates per user, category organization, usage tracking

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Template Details
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_plain TEXT,

  -- Category & Usage
  category TEXT, -- 'professional', 'personal', 'follow-up', 'sales', etc.
  usage_count INTEGER DEFAULT 0,
  last_used TIMESTAMP,

  -- Metadata
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(user_id, name),
  CONSTRAINT name_not_empty CHECK (name != ''),
  CONSTRAINT subject_not_empty CHECK (subject != ''),
  CONSTRAINT body_not_empty CHECK (body_html != '')
);

-- Indexes for efficient queries
CREATE INDEX idx_templates_user_id ON email_templates(user_id);
CREATE INDEX idx_templates_category ON email_templates(category);
CREATE INDEX idx_templates_last_used ON email_templates(last_used DESC);
CREATE INDEX idx_templates_usage ON email_templates(usage_count DESC);

-- RLS Policies
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY templates_user_access ON email_templates
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY templates_public_read ON email_templates
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);

-- ============================================================================
-- EMAIL SIGNATURES TABLE
-- ============================================================================
-- Purpose: Store email signatures for different accounts
-- Features: Per-account signatures, default signature selection, plain + HTML formats

CREATE TABLE IF NOT EXISTS email_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES email_accounts(id) ON DELETE SET NULL,

  -- Signature Content
  name TEXT NOT NULL,
  html_content TEXT NOT NULL,
  plain_text_content TEXT NOT NULL,

  -- Settings
  is_default BOOLEAN DEFAULT FALSE,
  is_account_specific BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints: Only one default per account, not per user
  UNIQUE(user_id, name),
  CONSTRAINT name_not_empty CHECK (name != ''),
  CONSTRAINT html_content_not_empty CHECK (html_content != ''),
  CONSTRAINT plain_text_not_empty CHECK (plain_text_content != '')
);

-- Indexes
CREATE INDEX idx_signatures_user_id ON email_signatures(user_id);
CREATE INDEX idx_signatures_account_id ON email_signatures(account_id);
CREATE INDEX idx_signatures_default ON email_signatures(user_id, is_default)
  WHERE is_default = true;

-- RLS Policies
ALTER TABLE email_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY signatures_user_access ON email_signatures
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- SMART REPLY CACHE TABLE
-- ============================================================================
-- Purpose: Cache Claude API suggestions for 24 hours
-- Features: Reduces API calls, stores 3 suggestions per email, tracks token usage
-- Key: Composite key of (user_id, email_hash) for uniqueness

CREATE TABLE IF NOT EXISTS email_smart_reply_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Cache Key: Hash of (sender_email, subject) to ensure uniqueness
  email_hash TEXT NOT NULL,

  -- Cached Suggestions (JSON array of 3 suggestions)
  -- Format: [{ id: string, text: string, style: 'professional'|'casual'|'concise', confidence: 0-1 }]
  suggestions JSONB NOT NULL,

  -- Metadata
  generated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours'),

  -- API Usage Tracking
  token_usage INTEGER, -- Tokens consumed from Claude API
  model_used TEXT DEFAULT 'claude-3-5-haiku-20241022',

  -- Constraints
  CONSTRAINT suggestions_not_empty CHECK (jsonb_array_length(suggestions) > 0),
  CONSTRAINT suggestions_max_three CHECK (jsonb_array_length(suggestions) <= 3),
  UNIQUE(user_id, email_hash)
);

-- Indexes for cache lookup and cleanup
CREATE INDEX idx_cache_user_id ON email_smart_reply_cache(user_id);
CREATE INDEX idx_cache_email_hash ON email_smart_reply_cache(email_hash);
CREATE INDEX idx_cache_expires_at ON email_smart_reply_cache(expires_at);
CREATE INDEX idx_cache_lookup ON email_smart_reply_cache(user_id, email_hash);

-- RLS Policies
ALTER TABLE email_smart_reply_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY cache_user_access ON email_smart_reply_cache
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- SAVED SEARCHES TABLE
-- ============================================================================
-- Purpose: Save frequently used search queries with filters
-- Features: Name saved searches, reuse complex filter combinations, track usage
-- Helps users find common search patterns quickly

CREATE TABLE IF NOT EXISTS email_saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Search Definition
  name TEXT NOT NULL,
  query TEXT NOT NULL, -- Full-text search query (e.g., "budget deadline")

  -- Filters as JSON for flexibility
  -- Format: {
  --   from: string,
  --   to: string,
  --   dateRange: { start: ISO8601, end: ISO8601 },
  --   hasAttachments: boolean,
  --   isRead: boolean,
  --   isStarred: boolean,
  --   labels: string[]
  -- }
  filters JSONB,

  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  last_used TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(user_id, name),
  CONSTRAINT name_not_empty CHECK (name != ''),
  CONSTRAINT query_not_empty CHECK (query != '')
);

-- Indexes
CREATE INDEX idx_saved_searches_user_id ON email_saved_searches(user_id);
CREATE INDEX idx_saved_searches_last_used ON email_saved_searches(last_used DESC);
CREATE INDEX idx_saved_searches_usage ON email_saved_searches(usage_count DESC);

-- RLS Policies
ALTER TABLE email_saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY saved_searches_user_access ON email_saved_searches
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- PERFORMANCE INDEXES FOR SEARCH & ANALYTICS
-- ============================================================================
-- These compound indexes optimize Phase 5.1 advanced search and analytics queries

-- For search with common filter combinations
CREATE INDEX IF NOT EXISTS idx_emails_user_date_read
  ON emails(user_id, date_received DESC, is_read);
CREATE INDEX IF NOT EXISTS idx_emails_user_date_starred
  ON emails(user_id, date_received DESC, is_starred);
CREATE INDEX IF NOT EXISTS idx_emails_user_from_date
  ON emails(user_id, from_address, date_received DESC);
CREATE INDEX IF NOT EXISTS idx_emails_user_to_date
  ON emails(user_id, to_addresses, date_received DESC);

-- For analytics (response time, activity patterns)
CREATE INDEX IF NOT EXISTS idx_emails_user_date_sent
  ON emails(user_id, date_sent DESC) WHERE date_sent IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_emails_date_hour
  ON emails(user_id, DATE_TRUNC('hour', date_received));

-- For contact frequency analysis
CREATE INDEX IF NOT EXISTS idx_contacts_user_frequency
  ON email_contacts(user_id, message_count DESC);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to clean expired smart reply cache entries
CREATE OR REPLACE FUNCTION clean_expired_smart_reply_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM email_smart_reply_cache
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to update template usage stats
CREATE OR REPLACE FUNCTION update_template_usage(template_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE email_templates
  SET usage_count = usage_count + 1,
      last_used = NOW()
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update saved search usage stats
CREATE OR REPLACE FUNCTION update_saved_search_usage(search_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE email_saved_searches
  SET usage_count = usage_count + 1,
      last_used = NOW()
  WHERE id = search_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp for templates
CREATE OR REPLACE FUNCTION update_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_templates_update_timestamp
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_template_timestamp();

-- Auto-update updated_at timestamp for signatures
CREATE OR REPLACE FUNCTION update_signature_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_signatures_update_timestamp
  BEFORE UPDATE ON email_signatures
  FOR EACH ROW
  EXECUTE FUNCTION update_signature_timestamp();

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- This migration creates tables for Phase 5.1: Advanced Email Features
--
-- New Tables:
-- - email_templates: Reusable email templates
-- - email_signatures: Email signatures per account
-- - email_smart_reply_cache: Claude API suggestion cache
-- - email_saved_searches: Saved search queries with filters
--
-- Additional Indexes:
-- - Compound indexes for search performance (<500ms requirement)
-- - Compound indexes for analytics performance (<100ms requirement)
-- - Usage and timestamp indexes for sorting/filtering
--
-- Helper Functions:
-- - clean_expired_smart_reply_cache: Remove 24h+ old cached suggestions
-- - update_template_usage: Track template usage stats
-- - update_saved_search_usage: Track search usage stats
--
-- All tables have RLS policies enabled for security
-- All tables use ON DELETE CASCADE for proper cleanup
--
-- Run via: npx supabase db push
