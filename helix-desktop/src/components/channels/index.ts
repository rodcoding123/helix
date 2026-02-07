/**
 * Channel Management Components
 *
 * Exports all channel-related UI components
 */

export { ChannelCenter } from './ChannelCenter';
export { ChannelDetail } from './ChannelDetail';
export { ChannelAccountTabs } from './ChannelAccountTabs';
export { PolicyEditor } from './PolicyEditor';
export { FilterBuilder } from './FilterBuilder';
export { FilterList } from './FilterList';
export { ChannelSetupModal } from './ChannelSetupModal';

export interface ChannelConfig {
  id: string;
  name: string;
  enabled: boolean;
  [key: string]: unknown;
}
