use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VectorClock {
    pub clocks: HashMap<String, u64>,
}

impl VectorClock {
    pub fn new() -> Self {
        Self {
            clocks: HashMap::new(),
        }
    }

    pub fn increment(&mut self, device_id: &str) {
        let counter = self.clocks.entry(device_id.to_string()).or_insert(0);
        *counter += 1;
    }

    pub fn merge(&mut self, other: &VectorClock) {
        for (device, &count) in &other.clocks {
            let current = self.clocks.entry(device.clone()).or_insert(0);
            *current = (*current).max(count);
        }
    }

    pub fn happens_before(&self, other: &VectorClock) -> bool {
        let mut at_least_one_less = false;

        for (device, &count) in &self.clocks {
            let other_count = other.clocks.get(device).copied().unwrap_or(0);
            if count > other_count {
                return false;
            }
            if count < other_count {
                at_least_one_less = true;
            }
        }

        for (device, &other_count) in &other.clocks {
            if !self.clocks.contains_key(device) && other_count > 0 {
                at_least_one_less = true;
            }
        }

        at_least_one_less
    }

    pub fn is_concurrent(&self, other: &VectorClock) -> bool {
        !self.happens_before(other) && !other.happens_before(self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vector_clock_ordering() {
        let mut v1 = VectorClock::new();
        v1.increment("A");

        let mut v2 = VectorClock::new();
        v2.increment("A");
        v2.increment("A");

        assert!(v1.happens_before(&v2));
        assert!(!v2.happens_before(&v1));
    }

    #[test]
    fn test_concurrent_clocks() {
        let mut v1 = VectorClock::new();
        v1.increment("A");

        let mut v2 = VectorClock::new();
        v2.increment("B");

        assert!(v1.is_concurrent(&v2));
        assert!(v2.is_concurrent(&v1));
    }

    #[test]
    fn test_merge() {
        let mut v1 = VectorClock::new();
        v1.increment("A");
        v1.increment("A");

        let mut v2 = VectorClock::new();
        v2.increment("B");
        v2.increment("B");

        v1.merge(&v2);

        assert_eq!(v1.clocks.get("A"), Some(&2));
        assert_eq!(v1.clocks.get("B"), Some(&2));
    }

    #[test]
    fn test_happens_before_reflexive() {
        let mut v1 = VectorClock::new();
        v1.increment("A");

        assert!(!v1.happens_before(&v1));
    }

    #[test]
    fn test_single_device() {
        let mut v1 = VectorClock::new();
        v1.increment("device1");

        let mut v2 = VectorClock::new();
        v2.increment("device1");
        v2.increment("device1");
        v2.increment("device1");

        assert!(v1.happens_before(&v2));
    }

    #[test]
    fn test_multiple_devices() {
        let mut v1 = VectorClock::new();
        v1.increment("A");
        v1.increment("B");

        let mut v2 = VectorClock::new();
        v2.increment("A");
        v2.increment("A");
        v2.increment("B");

        assert!(v1.happens_before(&v2));
    }
}
