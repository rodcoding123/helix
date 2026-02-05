use anyhow::Result;
use helix_shared::Memory;
use ndarray::Array2;
use linfa::prelude::*;
use linfa_clustering::KMeans;
use uuid::Uuid;

pub struct Cluster {
    pub memory_ids: Vec<Uuid>,
    pub confidence: f32,
    pub description: String,
}

pub fn cluster_memories(memories: &[&Memory], min_cluster_size: usize) -> Result<Vec<Cluster>> {
    // Build feature matrix from embeddings
    let n_memories = memories.len();
    if n_memories == 0 {
        return Ok(Vec::new());
    }

    let embedding_dim = memories[0].embedding.as_ref().unwrap().len();

    let mut features = Array2::<f32>::zeros((n_memories, embedding_dim));

    for (i, memory) in memories.iter().enumerate() {
        if let Some(emb) = &memory.embedding {
            for (j, &val) in emb.iter().enumerate() {
                features[[i, j]] = val;
            }
        }
    }

    // K-means clustering with k determined by min_cluster_size
    let n_clusters = (n_memories / min_cluster_size).max(2).min(10);

    let dataset = DatasetBase::from(features);
    let kmeans = KMeans::params(n_clusters)
        .max_n_iterations(100)
        .fit(&dataset)?;

    let predictions = kmeans.predict(&dataset);

    // Convert to our Cluster format
    let mut result = Vec::new();
    let mut cluster_map: std::collections::HashMap<usize, Vec<Uuid>> = std::collections::HashMap::new();

    for (idx, &label) in predictions.iter().enumerate() {
        cluster_map.entry(label).or_default().push(memories[idx].id);
    }

    for (label, memory_ids) in cluster_map {
        if memory_ids.len() >= min_cluster_size {
            let len = memory_ids.len();
            result.push(Cluster {
                memory_ids,
                confidence: 0.75,
                description: format!("Semantic cluster {} with {} memories", label, len),
            });
        }
    }

    Ok(result)
}
