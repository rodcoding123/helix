/**
 * Orchestrator Route - Phase 2 Job Management Dashboard
 *
 * Displays the orchestrator control center with:
 * - Job submission interface
 * - Real-time job monitoring
 * - Execution history
 * - Cost tracking and budgets
 * - Approval workflows
 */

import { OrchestratorPanel } from '../components/orchestrator';
import './Orchestrator.css';

export default function OrchestratorRoute() {
  return (
    <div className="orchestrator-route">
      <div className="route-header">
        <h1>Orchestrator</h1>
        <p>Submit, monitor, and manage orchestration jobs</p>
      </div>

      <div className="route-content">
        <OrchestratorPanel />
      </div>
    </div>
  );
}
