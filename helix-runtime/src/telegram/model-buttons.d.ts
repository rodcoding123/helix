/**
 * Model Buttons - Type Stub
 * These functions are stubs for helix-runtime context
 */
export interface ProviderInfo {
    name: string;
    models: string[];
}
export declare function buildModelsKeyboard(_page: number, _pageSize: number): unknown;
export declare function buildProviderKeyboard(): unknown;
export declare function calculateTotalPages(_totalModels: number, _pageSize: number): number;
export declare function getModelsPageSize(): number;
export declare function parseModelCallbackData(_callbackData: string): {
    type: string;
    model?: string;
    page?: number;
} | null;
//# sourceMappingURL=model-buttons.d.ts.map