-- Register cloud-chat operations in the AI control plane
-- Required: ai_operation_log has FK to ai_model_routes(operation_id)
-- Without these rows, the cloud-chat Edge Function cannot log operations

INSERT INTO ai_model_routes (
  operation_id, operation_name, description,
  primary_model, fallback_model,
  cost_criticality, estimated_cost_usd,
  avg_input_tokens, avg_output_tokens
) VALUES
(
  'cloud-chat',
  'Cloud Chat',
  'General-purpose cloud-hosted chat with Helix personality and memory',
  'deepseek-v3.2', 'gemini-2.0-flash',
  'LOW', 0.002000,
  500, 300
),
(
  'cloud-chat-onboarding',
  'Onboarding Chat',
  'First-run conversational onboarding where Helix learns about the user',
  'deepseek-v3.2', 'gemini-2.0-flash',
  'LOW', 0.002000,
  500, 300
)
ON CONFLICT (operation_id) DO NOTHING;
