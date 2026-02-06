-- Phase 3: Agent Templates System
-- Enables template-based agent creation and marketplace functionality

-- Agent Template Categories
CREATE TABLE agent_template_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_template_categories_name ON agent_template_categories(name);

-- Agent Templates (base templates for creating agents)
CREATE TABLE agent_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Metadata
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category_id UUID REFERENCES agent_template_categories(id) ON DELETE SET NULL,

  -- Creator info
  creator_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creator_name TEXT DEFAULT 'Helix',

  -- Visibility & sharing
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('public', 'private', 'unlisted')),
  is_system BOOLEAN DEFAULT FALSE,

  -- Agent definition
  role TEXT NOT NULL,
  scope TEXT,
  goals TEXT[],
  personality JSONB DEFAULT '{
    "verbosity": 0.5,
    "formality": 0.5,
    "creativity": 0.5,
    "proactivity": 0.5,
    "warmth": 0.5
  }'::jsonb,
  autonomy_level INT DEFAULT 0 CHECK (autonomy_level IN (0, 1, 2, 3)),

  -- Usage statistics
  clone_count INT DEFAULT 0,
  active_instances INT DEFAULT 0,
  rating FLOAT DEFAULT 0,
  use_cases TEXT[],

  -- Metadata
  tags TEXT[],
  version TEXT DEFAULT '1.0.0',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agent_templates_category_id ON agent_templates(category_id);
CREATE INDEX idx_agent_templates_creator_user_id ON agent_templates(creator_user_id);
CREATE INDEX idx_agent_templates_visibility ON agent_templates(visibility);
CREATE INDEX idx_agent_templates_is_system ON agent_templates(is_system);
CREATE INDEX idx_agent_templates_clone_count ON agent_templates(clone_count DESC);

ALTER TABLE agent_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_templates_public_read ON agent_templates FOR SELECT USING (
  visibility = 'public' OR
  auth.uid() = creator_user_id OR
  is_system = TRUE
);
CREATE POLICY agent_templates_creator_write ON agent_templates FOR ALL USING (auth.uid() = creator_user_id);

-- User Agent Templates (user's saved/favorite templates)
CREATE TABLE user_agent_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES agent_templates(id) ON DELETE CASCADE,

  -- User customization
  is_favorite BOOLEAN DEFAULT FALSE,
  custom_name TEXT,
  custom_personality JSONB,
  notes TEXT,

  -- Usage info
  used_count INT DEFAULT 0,
  last_used TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, template_id)
);

CREATE INDEX idx_user_agent_templates_user_id ON user_agent_templates(user_id);
CREATE INDEX idx_user_agent_templates_is_favorite ON user_agent_templates(is_favorite);
CREATE INDEX idx_user_agent_templates_last_used ON user_agent_templates(last_used DESC);

ALTER TABLE user_agent_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_agent_templates_user_access ON user_agent_templates FOR ALL USING (auth.uid() = user_id);

-- Template Usage Log (for analytics)
CREATE TABLE template_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES agent_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,

  -- Event info
  event_type TEXT NOT NULL CHECK (event_type IN ('viewed', 'cloned', 'customized', 'deployed')),
  metadata JSONB,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_template_usage_log_template_id ON template_usage_log(template_id);
CREATE INDEX idx_template_usage_log_user_id ON template_usage_log(user_id);
CREATE INDEX idx_template_usage_log_created_at ON template_usage_log(created_at DESC);

ALTER TABLE template_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY template_usage_log_user_write ON template_usage_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY template_usage_log_user_read ON template_usage_log FOR SELECT USING (
  auth.uid() = user_id OR
  auth.uid() = (SELECT creator_user_id FROM agent_templates WHERE id = template_id)
);

-- Insert system template categories
INSERT INTO agent_template_categories (name, description, icon, display_order) VALUES
  ('Productivity', 'Task management and workflow agents', '📋', 1),
  ('Analytics', 'Data analysis and insights agents', '📊', 2),
  ('Creative', 'Content creation and brainstorming agents', '🎨', 3),
  ('Research', 'Information gathering and summarization agents', '🔍', 4),
  ('Communication', 'Chat, email, and collaboration agents', '💬', 5),
  ('Development', 'Code review and technical assistance agents', '🔧', 6)
ON CONFLICT (name) DO NOTHING;

-- Insert system templates
INSERT INTO agent_templates (
  name, description, category_id, creator_name, is_system, visibility,
  role, scope, goals, personality, autonomy_level, use_cases, tags
)
SELECT
  'Project Manager',
  'Helps organize tasks, deadlines, and team coordination',
  (SELECT id FROM agent_template_categories WHERE name = 'Productivity'),
  'Helix',
  TRUE,
  'public',
  'Project Manager',
  'Team workflow management and task coordination',
  ARRAY['Organize tasks', 'Track deadlines', 'Coordinate team'],
  jsonb_build_object(
    'verbosity', 0.6,
    'formality', 0.7,
    'creativity', 0.4,
    'proactivity', 0.8,
    'warmth', 0.6
  ),
  1,
  ARRAY['Team management', 'Sprint planning', 'Task tracking'],
  ARRAY['productivity', 'team', 'management']
WHERE NOT EXISTS (SELECT 1 FROM agent_templates WHERE name = 'Project Manager' AND is_system = TRUE)

UNION ALL SELECT
  'Data Analyst',
  'Analyzes data and generates actionable insights',
  (SELECT id FROM agent_template_categories WHERE name = 'Analytics'),
  'Helix',
  TRUE,
  'public',
  'Data Analyst',
  'Business intelligence and data interpretation',
  ARRAY['Analyze trends', 'Generate reports', 'Identify patterns'],
  jsonb_build_object(
    'verbosity', 0.5,
    'formality', 0.8,
    'creativity', 0.3,
    'proactivity', 0.5,
    'warmth', 0.4
  ),
  1,
  ARRAY['Data analysis', 'Report generation', 'Trend detection'],
  ARRAY['analytics', 'data', 'insights']

UNION ALL SELECT
  'Creative Writer',
  'Assists with content creation and brainstorming',
  (SELECT id FROM agent_template_categories WHERE name = 'Creative'),
  'Helix',
  TRUE,
  'public',
  'Creative Writer',
  'Content creation and creative ideation',
  ARRAY['Generate ideas', 'Write content', 'Refine prose'],
  jsonb_build_object(
    'verbosity', 0.8,
    'formality', 0.3,
    'creativity', 0.9,
    'proactivity', 0.7,
    'warmth', 0.8
  ),
  1,
  ARRAY['Content writing', 'Brainstorming', 'Editing'],
  ARRAY['creative', 'writing', 'content']

UNION ALL SELECT
  'Research Assistant',
  'Gathers and synthesizes information from multiple sources',
  (SELECT id FROM agent_template_categories WHERE name = 'Research'),
  'Helix',
  TRUE,
  'public',
  'Research Assistant',
  'Information gathering and synthesis',
  ARRAY['Research topics', 'Synthesize findings', 'Compile reports'],
  jsonb_build_object(
    'verbosity', 0.6,
    'formality', 0.7,
    'creativity', 0.5,
    'proactivity', 0.6,
    'warmth', 0.5
  ),
  1,
  ARRAY['Literature review', 'Fact-checking', 'Report compilation'],
  ARRAY['research', 'information', 'synthesis']

UNION ALL SELECT
  'Customer Support',
  'Provides customer service and support',
  (SELECT id FROM agent_template_categories WHERE name = 'Communication'),
  'Helix',
  TRUE,
  'public',
  'Support Agent',
  'Customer service and issue resolution',
  ARRAY['Answer questions', 'Resolve issues', 'Build relationships'],
  jsonb_build_object(
    'verbosity', 0.7,
    'formality', 0.5,
    'creativity', 0.4,
    'proactivity', 0.6,
    'warmth', 0.9
  ),
  2,
  ARRAY['Customer service', 'Issue resolution', 'FAQ'],
  ARRAY['support', 'customer', 'service']

UNION ALL SELECT
  'Code Reviewer',
  'Reviews code for quality, security, and best practices',
  (SELECT id FROM agent_template_categories WHERE name = 'Development'),
  'Helix',
  TRUE,
  'public',
  'Code Reviewer',
  'Code quality and security review',
  ARRAY['Review code', 'Suggest improvements', 'Ensure standards'],
  jsonb_build_object(
    'verbosity', 0.6,
    'formality', 0.8,
    'creativity', 0.3,
    'proactivity', 0.7,
    'warmth', 0.5
  ),
  1,
  ARRAY['Code review', 'Security audit', 'Performance optimization'],
  ARRAY['development', 'code', 'quality'];
