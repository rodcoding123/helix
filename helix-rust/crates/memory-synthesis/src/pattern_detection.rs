use anyhow::{Context, Result};
use helix_shared::{Memory, MemorySynthesis, SupabaseClient};
use sqlx::Row;
use uuid::Uuid;
use tracing::{debug, info};
use chrono::Utc;

use crate::clustering::cluster_memories;

pub struct PatternDetector {
    client: SupabaseClient,
    min_confidence: f32,
}

impl PatternDetector {
    pub fn new(client: SupabaseClient, min_confidence: f32) -> Self {
        Self { client, min_confidence }
    }

    pub async fn synthesize_patterns(&self, user_id: Uuid, limit: i32) -> Result<usize> {
        info!("Fetching recent {} memories for user {}", limit, user_id);

        // 1. Fetch recent memories from Supabase
        let memories = self.fetch_recent_memories(user_id, limit).await?;

        if memories.is_empty() {
            info!("No memories found for synthesis");
            return Ok(0);
        }

        debug!("Found {} memories to analyze", memories.len());

        // 2. Detect temporal patterns
        let temporal = self.detect_temporal_patterns(&memories)?;

        // 3. Detect semantic clusters
        let semantic = self.detect_semantic_patterns(&memories)?;

        // 4. Detect emotional patterns
        let emotional = self.detect_emotional_patterns(&memories)?;

        // 5. Write synthesis results to Supabase
        let mut count = 0;
        count += self.write_patterns(user_id, "temporal", temporal).await?;
        count += self.write_patterns(user_id, "semantic", semantic).await?;
        count += self.write_patterns(user_id, "emotional", emotional).await?;

        Ok(count)
    }

    async fn fetch_recent_memories(&self, user_id: Uuid, limit: i32) -> Result<Vec<Memory>> {
        let rows = sqlx::query(
            "SELECT id, user_id, type, content, embedding, emotional_valence, created_at, last_accessed
             FROM memories
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT $2"
        )
        .bind(user_id)
        .bind(limit)
        .fetch_all(self.client.pool())
        .await
        .context("Failed to fetch memories from Supabase")?;

        let memories: Vec<Memory> = rows.iter().map(|row| {
            Memory {
                id: row.get("id"),
                user_id: row.get("user_id"),
                memory_type: serde_json::from_str(&row.get::<String, _>("type")).unwrap(),
                content: row.get("content"),
                embedding: row.try_get("embedding").ok(),
                emotional_valence: row.try_get("emotional_valence").ok(),
                created_at: row.get("created_at"),
                last_accessed: row.try_get("last_accessed").ok(),
            }
        }).collect();

        Ok(memories)
    }

    fn detect_temporal_patterns(&self, memories: &[Memory]) -> Result<Vec<Pattern>> {
        // Group memories by time windows (daily, weekly)
        let mut patterns = Vec::new();

        // Simple temporal grouping: memories within 24 hours
        let mut current_group = Vec::new();
        let mut last_timestamp = None;

        for memory in memories {
            if let Some(last) = last_timestamp {
                let diff = memory.created_at.signed_duration_since(last);
                if diff.num_hours().abs() > 24 {
                    if current_group.len() >= 3 {
                        patterns.push(Pattern {
                            memory_ids: current_group.clone(),
                            pattern_type: "temporal_cluster".to_string(),
                            confidence: 0.8,
                            synthesis: format!("Cluster of {} memories within 24-hour period", current_group.len()),
                        });
                    }
                    current_group.clear();
                }
            }
            current_group.push(memory.id);
            last_timestamp = Some(memory.created_at);
        }

        Ok(patterns)
    }

    fn detect_semantic_patterns(&self, memories: &[Memory]) -> Result<Vec<Pattern>> {
        // Use embeddings for semantic clustering
        let memories_with_embeddings: Vec<_> = memories.iter()
            .filter(|m| m.embedding.is_some())
            .collect();

        if memories_with_embeddings.is_empty() {
            return Ok(Vec::new());
        }

        let clusters = cluster_memories(&memories_with_embeddings, 3)?;

        let patterns = clusters.into_iter().map(|cluster| {
            Pattern {
                memory_ids: cluster.memory_ids,
                pattern_type: "semantic_cluster".to_string(),
                confidence: cluster.confidence,
                synthesis: cluster.description,
            }
        }).collect();

        Ok(patterns)
    }

    fn detect_emotional_patterns(&self, memories: &[Memory]) -> Result<Vec<Pattern>> {
        // Group by emotional valence
        let mut positive = Vec::new();
        let mut negative = Vec::new();
        let mut neutral = Vec::new();

        for memory in memories {
            if let Some(valence) = memory.emotional_valence {
                if valence > 0.3 {
                    positive.push(memory.id);
                } else if valence < -0.3 {
                    negative.push(memory.id);
                } else {
                    neutral.push(memory.id);
                }
            }
        }

        let mut patterns = Vec::new();

        if positive.len() >= 5 {
            patterns.push(Pattern {
                memory_ids: positive,
                pattern_type: "emotional_positive".to_string(),
                confidence: 0.85,
                synthesis: "Cluster of positive emotional memories".to_string(),
            });
        }

        if negative.len() >= 5 {
            patterns.push(Pattern {
                memory_ids: negative,
                pattern_type: "emotional_negative".to_string(),
                confidence: 0.85,
                synthesis: "Cluster of negative emotional memories".to_string(),
            });
        }

        Ok(patterns)
    }

    async fn write_patterns(&self, user_id: Uuid, category: &str, patterns: Vec<Pattern>) -> Result<usize> {
        let mut count = 0;

        for pattern in patterns {
            if pattern.confidence < self.min_confidence {
                continue;
            }

            let synthesis = MemorySynthesis {
                id: Uuid::new_v4(),
                user_id,
                pattern_type: format!("{}_{}", category, pattern.pattern_type),
                memory_ids: pattern.memory_ids.clone(),
                synthesis_content: pattern.synthesis.clone(),
                confidence_score: pattern.confidence,
                created_at: Utc::now(),
            };

            sqlx::query(
                "INSERT INTO memory_synthesis (id, user_id, pattern_type, memory_ids, synthesis_content, confidence_score, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)"
            )
            .bind(synthesis.id)
            .bind(synthesis.user_id)
            .bind(&synthesis.pattern_type)
            .bind(&synthesis.memory_ids)
            .bind(&synthesis.synthesis_content)
            .bind(synthesis.confidence_score)
            .bind(synthesis.created_at)
            .execute(self.client.pool())
            .await
            .context("Failed to write synthesis to Supabase")?;

            count += 1;
        }

        info!("Wrote {} {} patterns to Supabase", count, category);
        Ok(count)
    }
}

#[derive(Debug)]
struct Pattern {
    memory_ids: Vec<Uuid>,
    pattern_type: String,
    confidence: f32,
    synthesis: String,
}
