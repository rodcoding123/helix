// Primary dashboard component
export { DeviceManagementDashboard } from './DeviceManagementDashboard';
export type { PairingRequest } from './DeviceManagementDashboard';

// Dashboard sub-components
export { DeviceApprovalCard } from './DeviceApprovalCard';
export { DeviceDetailView } from './DeviceDetailView';
export type { DeviceDetailViewProps } from './DeviceDetailView';
export { NodeHealthPanel } from './NodeHealthPanel';
export type { NodeHealthMetrics, NodeHealthPanelProps } from './NodeHealthPanel';
export { DiscoveredNodeCard } from './DiscoveredNodeCard';
export type { DiscoveredNodeCardProps } from './DiscoveredNodeCard';
export type { DiscoveredNode } from './types';

// Legacy dashboard components
export { DevicesDashboard } from './DevicesDashboard';
export { DeviceCard } from './DeviceCard';
export { PairingApproval } from './PairingApproval';
