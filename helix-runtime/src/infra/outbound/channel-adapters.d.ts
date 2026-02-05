import type { ChannelId } from "../../channels/plugins/types.js";
export type ChannelMessageAdapter = {
    supportsEmbeds: boolean;
    buildCrossContextEmbeds?: (originLabel: string) => unknown[];
};
export declare function getChannelMessageAdapter(channel: ChannelId): ChannelMessageAdapter;
//# sourceMappingURL=channel-adapters.d.ts.map