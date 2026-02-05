use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Memory {
    pub id: Uuid,
    pub user_id: Uuid,
    #[serde(rename = "type")]
    pub memory_type: MemoryType,
    pub content: String,
    pub embedding: Option<Vec<f32>>,
    pub emotional_valence: Option<f32>,
    pub created_at: DateTime<Utc>,
    pub last_accessed: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MemoryType {
    Episodic,
    Semantic,
    Procedural,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemorySynthesis {
    pub id: Uuid,
    pub user_id: Uuid,
    pub pattern_type: String,
    pub memory_ids: Vec<Uuid>,
    pub synthesis_content: String,
    pub confidence_score: f32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PsychologyLayer {
    pub id: Uuid,
    pub user_id: Uuid,
    pub layer_number: i32,
    pub layer_name: String,
    pub data: serde_json::Value,
    pub decay_rate: f32,
    pub last_updated: DateTime<Utc>,
}
