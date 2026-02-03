-- Verify all tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'email_%'
ORDER BY table_name;
-- Expected: email_accounts, email_attachments, email_conversations, email_messages, email_sync_log

-- Verify foreign keys
SELECT constraint_name, table_name
FROM information_schema.table_constraints
WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY'
AND table_name LIKE 'email_%'
ORDER BY table_name;
-- Expected: 10+ foreign key constraints

-- Verify indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public' AND tablename LIKE 'email_%'
ORDER BY tablename, indexname;
-- Expected: 15+ indexes
