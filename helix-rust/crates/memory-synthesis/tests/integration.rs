use helix_shared::{Memory, MemoryType, SupabaseClient};
use uuid::Uuid;
use chrono::Utc;

#[tokio::test]
async fn test_memory_synthesis_integration() {
    let client = SupabaseClient::new().await.expect("Failed to create client");
    let test_user_id = Uuid::new_v4();

    // Create test memories
    let memories = vec![
        Memory {
            id: Uuid::new_v4(),
            user_id: test_user_id,
            memory_type: MemoryType::Episodic,
            content: "Test memory 1".to_string(),
            embedding: Some(vec![0.1; 1536]),
            emotional_valence: Some(0.5),
            created_at: Utc::now(),
            last_accessed: None,
        },
        Memory {
            id: Uuid::new_v4(),
            user_id: test_user_id,
            memory_type: MemoryType::Episodic,
            content: "Test memory 2".to_string(),
            embedding: Some(vec![0.2; 1536]),
            emotional_valence: Some(0.6),
            created_at: Utc::now(),
            last_accessed: None,
        },
    ];

    // Insert test memories
    for memory in &memories {
        sqlx::query(
            "INSERT INTO memories (id, user_id, type, content, embedding, emotional_valence, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)"
        )
        .bind(memory.id)
        .bind(memory.user_id)
        .bind(serde_json::to_string(&memory.memory_type).unwrap())
        .bind(&memory.content)
        .bind(&memory.embedding)
        .bind(memory.emotional_valence)
        .bind(memory.created_at)
        .execute(client.pool())
        .await
        .expect("Failed to insert test memory");
    }

    // Run synthesis
    use memory_synthesis::PatternDetector;
    let detector = PatternDetector::new(client.clone(), 0.5);
    let count = detector.synthesize_patterns(test_user_id, 10).await.expect("Synthesis failed");

    assert!(count > 0, "Should create at least one synthesis pattern");

    // Cleanup
    sqlx::query("DELETE FROM memories WHERE user_id = $1")
        .bind(test_user_id)
        .execute(client.pool())
        .await
        .expect("Cleanup failed");
}
