// Scheduler commands for managing Layer 5 integration jobs
// Provides Tauri command handlers for memory consolidation, synthesis, and scheduled tasks

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

/// Scheduler job status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum JobStatus {
    #[serde(rename = "pending")]
    Pending,
    #[serde(rename = "running")]
    Running,
    #[serde(rename = "completed")]
    Completed,
    #[serde(rename = "failed")]
    Failed,
    #[serde(rename = "paused")]
    Paused,
}

/// Scheduler job type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JobType {
    Consolidation,
    Synthesis,
    FullIntegration,
    MemoryFadeout,
    PatternAnalysis,
    RecommendationGeneration,
}

/// Scheduler job details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchedulerJob {
    pub id: String,
    pub job_type: JobType,
    pub status: JobStatus,
    pub scheduled_at: u64,
    pub started_at: Option<u64>,
    pub completed_at: Option<u64>,
    pub cron_expression: String,
    pub next_run: u64,
    pub last_run: Option<u64>,
    pub duration_ms: Option<u64>,
    pub error: Option<String>,
    pub result: Option<serde_json::Value>,
}

/// Scheduler configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchedulerConfig {
    pub enabled: bool,
    pub daily_consolidation: bool,
    pub consolidation_time: String, // HH:MM format (default: 06:00)
    pub daily_synthesis: bool,
    pub synthesis_time: String, // HH:MM format (default: 20:00)
    pub weekly_full_integration: bool,
    pub integration_day: String, // 0-6, default: 0 (Sunday)
    pub integration_time: String, // HH:MM format (default: 03:00)
    pub monthly_synthesis: bool,
    pub synthesis_day: u32, // Day of month (default: 1)
    pub max_concurrent_jobs: u32,
    pub timeout_seconds: u32,
}

impl Default for SchedulerConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            daily_consolidation: true,
            consolidation_time: "06:00".to_string(),
            daily_synthesis: true,
            synthesis_time: "20:00".to_string(),
            weekly_full_integration: true,
            integration_day: "0".to_string(),
            integration_time: "03:00".to_string(),
            monthly_synthesis: true,
            synthesis_day: 1,
            max_concurrent_jobs: 2,
            timeout_seconds: 1800, // 30 minutes
        }
    }
}

/// In-memory job registry (in production, this would be backed by SQLite)
static mut JOB_REGISTRY: Option<HashMap<String, SchedulerJob>> = None;
static mut JOB_COUNTER: u64 = 0;

fn get_helix_dir() -> Result<PathBuf, String> {
    if let Ok(dir) = std::env::var("HELIX_PROJECT_DIR") {
        return Ok(PathBuf::from(dir));
    }

    let home = dirs::home_dir()
        .ok_or_else(|| "Could not find home directory".to_string())?;

    Ok(home.join(".helix"))
}

fn get_config_path() -> Result<PathBuf, String> {
    let helix_dir = get_helix_dir()?;
    Ok(helix_dir.join("config").join("scheduler.json"))
}

fn ensure_registry() {
    unsafe {
        if JOB_REGISTRY.is_none() {
            JOB_REGISTRY = Some(HashMap::new());
        }
    }
}

/// Get current scheduler configuration
#[tauri::command]
pub fn get_scheduler_config() -> Result<SchedulerConfig, String> {
    let config_path = get_config_path()?;

    if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read scheduler config: {}", e))?;

        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse scheduler config: {}", e))
    } else {
        Ok(SchedulerConfig::default())
    }
}

/// Update scheduler configuration
#[tauri::command]
pub fn set_scheduler_config(config: SchedulerConfig) -> Result<(), String> {
    let config_path = get_config_path()?;

    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write scheduler config: {}", e))
}

/// Get all scheduled jobs
#[tauri::command]
pub fn get_scheduled_jobs() -> Result<Vec<SchedulerJob>, String> {
    ensure_registry();

    unsafe {
        if let Some(registry) = &JOB_REGISTRY {
            let mut jobs: Vec<_> = registry.values().cloned().collect();
            // Sort by next_run time
            jobs.sort_by_key(|j| j.next_run);
            Ok(jobs)
        } else {
            Ok(Vec::new())
        }
    }
}

/// Get a specific job by ID
#[tauri::command]
pub fn get_job(job_id: String) -> Result<SchedulerJob, String> {
    ensure_registry();

    unsafe {
        if let Some(registry) = &JOB_REGISTRY {
            registry
                .get(&job_id)
                .cloned()
                .ok_or_else(|| format!("Job not found: {}", job_id))
        } else {
            Err("Job registry not initialized".to_string())
        }
    }
}

/// Create a new scheduled job
#[tauri::command]
pub fn create_job(
    job_type: JobType,
    cron_expression: String,
) -> Result<SchedulerJob, String> {
    ensure_registry();

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Failed to get current time: {}", e))?
        .as_secs();

    let job = SchedulerJob {
        id: {
            unsafe {
                JOB_COUNTER = JOB_COUNTER.wrapping_add(1);
                format!("job_{}_{}", now, JOB_COUNTER)
            }
        },
        job_type,
        status: JobStatus::Pending,
        scheduled_at: now,
        started_at: None,
        completed_at: None,
        cron_expression,
        next_run: now + 3600, // Default: next run in 1 hour
        last_run: None,
        duration_ms: None,
        error: None,
        result: None,
    };

    let job_id = job.id.clone();

    unsafe {
        if let Some(registry) = &mut JOB_REGISTRY {
            registry.insert(job_id, job.clone());
        }
    }

    Ok(job)
}

/// Pause a scheduled job
#[tauri::command]
pub fn pause_job(job_id: String) -> Result<(), String> {
    ensure_registry();

    unsafe {
        if let Some(registry) = &mut JOB_REGISTRY {
            if let Some(job) = registry.get_mut(&job_id) {
                job.status = JobStatus::Paused;
                Ok(())
            } else {
                Err(format!("Job not found: {}", job_id))
            }
        } else {
            Err("Job registry not initialized".to_string())
        }
    }
}

/// Resume a paused job
#[tauri::command]
pub fn resume_job(job_id: String) -> Result<(), String> {
    ensure_registry();

    unsafe {
        if let Some(registry) = &mut JOB_REGISTRY {
            if let Some(job) = registry.get_mut(&job_id) {
                job.status = JobStatus::Pending;
                Ok(())
            } else {
                Err(format!("Job not found: {}", job_id))
            }
        } else {
            Err("Job registry not initialized".to_string())
        }
    }
}

/// Delete a scheduled job
#[tauri::command]
pub fn delete_job(job_id: String) -> Result<(), String> {
    ensure_registry();

    unsafe {
        if let Some(registry) = &mut JOB_REGISTRY {
            registry.remove(&job_id);
            Ok(())
        } else {
            Err("Job registry not initialized".to_string())
        }
    }
}

/// Manually trigger a job execution (for testing)
#[tauri::command]
pub fn trigger_job(job_id: String) -> Result<SchedulerJob, String> {
    ensure_registry();

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Failed to get current time: {}", e))?
        .as_secs();

    unsafe {
        if let Some(registry) = &mut JOB_REGISTRY {
            if let Some(job) = registry.get_mut(&job_id) {
                job.status = JobStatus::Running;
                job.started_at = Some(now);
                Ok(job.clone())
            } else {
                Err(format!("Job not found: {}", job_id))
            }
        } else {
            Err("Job registry not initialized".to_string())
        }
    }
}

/// Mark a job as completed
#[tauri::command]
pub fn complete_job(job_id: String, result: Option<serde_json::Value>) -> Result<(), String> {
    ensure_registry();

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Failed to get current time: {}", e))?
        .as_secs();

    unsafe {
        if let Some(registry) = &mut JOB_REGISTRY {
            if let Some(job) = registry.get_mut(&job_id) {
                job.status = JobStatus::Completed;
                job.completed_at = Some(now);
                job.last_run = Some(now);
                if let Some(started) = job.started_at {
                    job.duration_ms = Some((now - started) * 1000);
                }
                job.result = result;
                Ok(())
            } else {
                Err(format!("Job not found: {}", job_id))
            }
        } else {
            Err("Job registry not initialized".to_string())
        }
    }
}

/// Mark a job as failed
#[tauri::command]
pub fn fail_job(job_id: String, error: String) -> Result<(), String> {
    ensure_registry();

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Failed to get current time: {}", e))?
        .as_secs();

    unsafe {
        if let Some(registry) = &mut JOB_REGISTRY {
            if let Some(job) = registry.get_mut(&job_id) {
                job.status = JobStatus::Failed;
                job.completed_at = Some(now);
                job.error = Some(error);
                Ok(())
            } else {
                Err(format!("Job not found: {}", job_id))
            }
        } else {
            Err("Job registry not initialized".to_string())
        }
    }
}

/// Get scheduler health status (for monitoring)
#[tauri::command]
pub fn get_scheduler_health() -> Result<SchedulerHealth, String> {
    ensure_registry();

    let jobs = get_scheduled_jobs()?;

    let running_count = jobs.iter().filter(|j| j.status == JobStatus::Running).count();
    let failed_count = jobs.iter().filter(|j| j.status == JobStatus::Failed).count();
    let paused_count = jobs.iter().filter(|j| j.status == JobStatus::Paused).count();

    Ok(SchedulerHealth {
        healthy: failed_count == 0 && running_count < 10,
        total_jobs: jobs.len(),
        running: running_count,
        failed: failed_count,
        paused: paused_count,
    })
}

/// Scheduler health status
#[derive(Debug, Serialize, Deserialize)]
pub struct SchedulerHealth {
    pub healthy: bool,
    pub total_jobs: usize,
    pub running: usize,
    pub failed: usize,
    pub paused: usize,
}
