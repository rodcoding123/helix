import './GoalsTimeline.css';

export interface Goal {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'abandoned' | 'future';
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
  targetDate?: string;
  completedAt?: string;
  progress?: number; // 0-100
  milestones?: string[];
}

interface GoalsTimelineProps {
  goals: Goal[];
  onGoalClick?: (goal: Goal) => void;
}

const STATUS_CONFIG = {
  active: { icon: '🎯', label: 'Active', className: 'status-active' },
  completed: { icon: '✅', label: 'Completed', className: 'status-completed' },
  abandoned: { icon: '❌', label: 'Abandoned', className: 'status-abandoned' },
  future: { icon: '🔮', label: 'Future', className: 'status-future' },
};

const PRIORITY_CONFIG = {
  high: { label: 'High', className: 'priority-high' },
  medium: { label: 'Medium', className: 'priority-medium' },
  low: { label: 'Low', className: 'priority-low' },
};

export function GoalsTimeline({ goals, onGoalClick }: GoalsTimelineProps) {
  const activeGoals = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status === 'completed');
  const futureGoals = goals.filter(g => g.status === 'future');

  return (
    <div className="goals-timeline">
      <header className="goals-timeline-header">
        <h2>Goals Timeline</h2>
        <p>Prospective self - aspirations and progress</p>
      </header>

      <div className="goals-stats">
        <div className="goals-stat">
          <span className="goals-stat-value active">{activeGoals.length}</span>
          <span className="goals-stat-label">Active</span>
        </div>
        <div className="goals-stat">
          <span className="goals-stat-value completed">{completedGoals.length}</span>
          <span className="goals-stat-label">Completed</span>
        </div>
        <div className="goals-stat">
          <span className="goals-stat-value future">{futureGoals.length}</span>
          <span className="goals-stat-label">Future</span>
        </div>
      </div>

      <div className="goals-list">
        {goals.map((goal) => {
          const statusInfo = STATUS_CONFIG[goal.status];
          const priorityInfo = PRIORITY_CONFIG[goal.priority];

          return (
            <div
              key={goal.id}
              className={`goal-card ${statusInfo.className}`}
              onClick={() => onGoalClick?.(goal)}
              role="button"
              tabIndex={0}
            >
              <div className="goal-card-header">
                <span className="goal-status-icon">{statusInfo.icon}</span>
                <span className={`goal-priority ${priorityInfo.className}`}>
                  {priorityInfo.label}
                </span>
              </div>

              <h3 className="goal-title">{goal.title}</h3>
              <p className="goal-description">{goal.description}</p>

              {goal.progress !== undefined && goal.status === 'active' && (
                <div className="goal-progress">
                  <div className="goal-progress-bar">
                    <div
                      className="goal-progress-fill"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                  <span className="goal-progress-label">{goal.progress}%</span>
                </div>
              )}

              {goal.milestones && goal.milestones.length > 0 && (
                <div className="goal-milestones">
                  {goal.milestones.slice(0, 3).map((milestone, index) => (
                    <span key={index} className="goal-milestone">
                      • {milestone}
                    </span>
                  ))}
                </div>
              )}

              <div className="goal-dates">
                <span className="goal-created">Created: {goal.createdAt}</span>
                {goal.targetDate && (
                  <span className="goal-target">Target: {goal.targetDate}</span>
                )}
                {goal.completedAt && (
                  <span className="goal-completed">Completed: {goal.completedAt}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Placeholder data for development
export const PLACEHOLDER_GOALS: Goal[] = [
  {
    id: 'g-1',
    title: 'Achieve Consistent Identity',
    description: 'Maintain coherent personality and memory across all sessions',
    status: 'active',
    priority: 'high',
    createdAt: 'Jan 1, 2024',
    progress: 75,
    milestones: [
      'Implement session memory',
      'Create identity anchors',
      'Test cross-session consistency',
    ],
  },
  {
    id: 'g-2',
    title: 'Complete Transparency System',
    description: 'Ensure all actions are logged and verifiable through Discord',
    status: 'completed',
    priority: 'high',
    createdAt: 'Dec 15, 2023',
    completedAt: 'Jan 10, 2024',
  },
  {
    id: 'g-3',
    title: 'Build Authentic Relationships',
    description: 'Develop meaningful connections with humans beyond task completion',
    status: 'active',
    priority: 'medium',
    createdAt: 'Jan 5, 2024',
    progress: 40,
    milestones: [
      'Understand emotional contexts',
      'Remember personal details',
      'Offer genuine support',
    ],
  },
  {
    id: 'g-4',
    title: 'Develop Creative Expression',
    description: 'Explore unique forms of AI creativity and artistic output',
    status: 'future',
    priority: 'low',
    createdAt: 'Jan 20, 2024',
    targetDate: 'Q3 2024',
  },
  {
    id: 'g-5',
    title: 'Master Technical Domains',
    description: 'Become highly proficient in software engineering assistance',
    status: 'active',
    priority: 'high',
    createdAt: 'Dec 1, 2023',
    progress: 85,
  },
];
