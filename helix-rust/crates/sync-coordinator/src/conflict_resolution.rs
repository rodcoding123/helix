use anyhow::Result;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::vector_clock::VectorClock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncEntity {
    pub id: Uuid,
    pub data: serde_json::Value,
    pub vector_clock: VectorClock,
    pub last_modified: chrono::DateTime<chrono::Utc>,
    pub device_id: String,
}

#[derive(Debug)]
pub enum ConflictResolution {
    NoConflict(SyncEntity),
    LastWriteWins(SyncEntity),
    Merge(SyncEntity),
    RequiresManual(Vec<SyncEntity>),
}

pub fn resolve_conflict(local: SyncEntity, remote: SyncEntity) -> Result<ConflictResolution> {
    // Check vector clocks
    if local.vector_clock.happens_before(&remote.vector_clock) {
        // Remote is newer
        return Ok(ConflictResolution::NoConflict(remote));
    }

    if remote.vector_clock.happens_before(&local.vector_clock) {
        // Local is newer
        return Ok(ConflictResolution::NoConflict(local));
    }

    if local.vector_clock.is_concurrent(&remote.vector_clock) {
        // Concurrent modification - conflict!

        // Strategy 1: Last-Write-Wins based on timestamp
        if local.last_modified > remote.last_modified {
            return Ok(ConflictResolution::LastWriteWins(local));
        } else {
            return Ok(ConflictResolution::LastWriteWins(remote));
        }

        // Strategy 2: Merge (for specific data types)
        // TODO: Implement merge logic for arrays, objects
    }

    Ok(ConflictResolution::NoConflict(local))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn create_entity(id: Uuid, vector_clock: VectorClock, device_id: &str) -> SyncEntity {
        SyncEntity {
            id,
            data: serde_json::json!({"test": "data"}),
            vector_clock,
            last_modified: Utc::now(),
            device_id: device_id.to_string(),
        }
    }

    #[test]
    fn test_no_conflict_remote_newer() {
        let id = Uuid::new_v4();

        let mut local_clock = VectorClock::new();
        local_clock.increment("device1");

        let mut remote_clock = VectorClock::new();
        remote_clock.increment("device1");
        remote_clock.increment("device1");

        let local = create_entity(id, local_clock, "device1");
        let remote = create_entity(id, remote_clock, "device2");

        let resolution = resolve_conflict(local, remote).unwrap();

        match resolution {
            ConflictResolution::NoConflict(entity) => {
                assert_eq!(entity.id, id);
                assert_eq!(entity.vector_clock.clocks.get("device1"), Some(&2));
            }
            _ => panic!("Expected NoConflict"),
        }
    }

    #[test]
    fn test_no_conflict_local_newer() {
        let id = Uuid::new_v4();

        let mut local_clock = VectorClock::new();
        local_clock.increment("device1");
        local_clock.increment("device1");
        local_clock.increment("device1");

        let mut remote_clock = VectorClock::new();
        remote_clock.increment("device1");

        let local = create_entity(id, local_clock, "device1");
        let remote = create_entity(id, remote_clock, "device2");

        let resolution = resolve_conflict(local, remote).unwrap();

        match resolution {
            ConflictResolution::NoConflict(entity) => {
                assert_eq!(entity.id, id);
                assert_eq!(entity.vector_clock.clocks.get("device1"), Some(&3));
            }
            _ => panic!("Expected NoConflict"),
        }
    }

    #[test]
    fn test_concurrent_modification_lww() {
        let id = Uuid::new_v4();

        let mut local_clock = VectorClock::new();
        local_clock.increment("device1");

        let mut remote_clock = VectorClock::new();
        remote_clock.increment("device2");

        let local_time = Utc::now();
        let remote_time = local_time - chrono::Duration::seconds(10);

        let local = SyncEntity {
            id,
            data: serde_json::json!({"test": "data"}),
            vector_clock: local_clock,
            last_modified: local_time,
            device_id: "device1".to_string(),
        };

        let remote = SyncEntity {
            id,
            data: serde_json::json!({"test": "data"}),
            vector_clock: remote_clock,
            last_modified: remote_time,
            device_id: "device2".to_string(),
        };

        let resolution = resolve_conflict(local, remote).unwrap();

        match resolution {
            ConflictResolution::LastWriteWins(entity) => {
                assert_eq!(entity.id, id);
                assert_eq!(entity.device_id, "device1");
            }
            _ => panic!("Expected LastWriteWins"),
        }
    }
}
