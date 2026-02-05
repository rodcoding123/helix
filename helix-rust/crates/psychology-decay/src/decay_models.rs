use chrono::Duration;

pub trait DecayModel: Send + Sync {
    fn calculate_retention(&self, time_since_access: Duration, initial_strength: f32) -> f32;
}

/// Ebbinghaus forgetting curve: R(t) = e^(-t/S)
pub struct EbbinghausCurve {
    pub decay_constant: f32,
}

impl DecayModel for EbbinghausCurve {
    fn calculate_retention(&self, time_since_access: Duration, initial_strength: f32) -> f32 {
        let t = time_since_access.num_hours() as f32;
        let retention = initial_strength * (-t / self.decay_constant).exp();
        retention.max(0.0).min(1.0)
    }
}

/// Power law forgetting: R(t) = (1 + t)^(-b)
pub struct PowerLawDecay {
    pub exponent: f32,
}

impl DecayModel for PowerLawDecay {
    fn calculate_retention(&self, time_since_access: Duration, initial_strength: f32) -> f32 {
        let t = time_since_access.num_hours() as f32;
        let retention = initial_strength * (1.0 + t).powf(-self.exponent);
        retention.max(0.0).min(1.0)
    }
}

/// Exponential decay with half-life
pub struct ExponentialDecay {
    pub half_life_hours: f32,
}

impl DecayModel for ExponentialDecay {
    fn calculate_retention(&self, time_since_access: Duration, initial_strength: f32) -> f32 {
        let t = time_since_access.num_hours() as f32;
        let retention = initial_strength * 0.5f32.powf(t / self.half_life_hours);
        retention.max(0.0).min(1.0)
    }
}

pub fn get_model_for_layer(layer_number: i32) -> Box<dyn DecayModel> {
    match layer_number {
        1 => Box::new(ExponentialDecay { half_life_hours: 720.0 }), // 30 days for Narrative Core
        2 => Box::new(EbbinghausCurve { decay_constant: 168.0 }),   // 7 days for Emotional Memory
        3 => Box::new(PowerLawDecay { exponent: 0.5 }),              // Relational Memory
        4 => Box::new(ExponentialDecay { half_life_hours: 360.0 }), // 15 days for Prospective Self
        5 => Box::new(EbbinghausCurve { decay_constant: 240.0 }),   // 10 days for Integration
        6 => Box::new(ExponentialDecay { half_life_hours: 480.0 }), // 20 days for Transformation
        7 => Box::new(EbbinghausCurve { decay_constant: 1440.0 }),  // 60 days for Purpose Engine
        _ => Box::new(EbbinghausCurve { decay_constant: 168.0 }),   // Default 7 days
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ebbinghaus_curve_decay() {
        let model = EbbinghausCurve { decay_constant: 168.0 };
        let retention = model.calculate_retention(Duration::hours(0), 1.0);
        assert!((retention - 1.0).abs() < 0.01);

        let retention_after_1h = model.calculate_retention(Duration::hours(1), 1.0);
        assert!(retention_after_1h < 1.0);
        assert!(retention_after_1h > 0.0);
    }

    #[test]
    fn test_power_law_decay() {
        let model = PowerLawDecay { exponent: 0.5 };
        let retention = model.calculate_retention(Duration::hours(0), 1.0);
        assert!((retention - 1.0).abs() < 0.01);

        let retention_after_1h = model.calculate_retention(Duration::hours(1), 1.0);
        assert!(retention_after_1h < 1.0);
        assert!(retention_after_1h > 0.0);
    }

    #[test]
    fn test_exponential_decay() {
        let model = ExponentialDecay { half_life_hours: 720.0 };
        let retention = model.calculate_retention(Duration::hours(0), 1.0);
        assert!((retention - 1.0).abs() < 0.01);

        let retention_at_half_life = model.calculate_retention(Duration::hours(720), 1.0);
        assert!((retention_at_half_life - 0.5).abs() < 0.01);
    }

    #[test]
    fn test_retention_clamping() {
        let model = EbbinghausCurve { decay_constant: 168.0 };
        let retention = model.calculate_retention(Duration::days(365), 1.0);
        assert!(retention >= 0.0);
        assert!(retention <= 1.0);
    }

    #[test]
    fn test_get_model_for_layer() {
        for layer in 1..=7 {
            let model = get_model_for_layer(layer);
            let retention = model.calculate_retention(Duration::hours(0), 1.0);
            assert!((retention - 1.0).abs() < 0.01, "Layer {} should have full retention at t=0", layer);
        }
    }

    #[test]
    fn test_default_model() {
        let model = get_model_for_layer(999); // Unknown layer
        let retention = model.calculate_retention(Duration::hours(0), 1.0);
        assert!((retention - 1.0).abs() < 0.01);
    }
}
