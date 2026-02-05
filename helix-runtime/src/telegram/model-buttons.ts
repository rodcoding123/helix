/**
 * Model Buttons - Type Stub
 * These functions are stubs for helix-runtime context
 */

export interface ProviderInfo {
  name: string;
  models: string[];
}

export function buildModelsKeyboard(_page: number, _pageSize: number): unknown {
  // Stub implementation - returns empty keyboard
  return { inline_keyboard: [] };
}

export function buildProviderKeyboard(): unknown {
  // Stub implementation - returns empty keyboard
  return { inline_keyboard: [] };
}

export function calculateTotalPages(_totalModels: number, _pageSize: number): number {
  // Stub implementation
  return 0;
}

export function getModelsPageSize(): number {
  // Stub implementation
  return 10;
}

export function parseModelCallbackData(_callbackData: string): { model?: string; page?: number } {
  // Stub implementation
  return {};
}
