/**
 * Tauri Command Wrappers
 * Desktop-specific file operations and system interactions
 */

import { invoke } from '../lib/tauri-compat';

// Lazy-load Tauri plugins to avoid build-time issues
let dialogModule: any = null;
let fsModule: any = null;
let notificationModule: any = null;

async function getDialogModule() {
  if (!dialogModule) {
    try {
      dialogModule = await import('@tauri-apps/plugin-dialog');
    } catch {
      // In test/browser environment, plugins not available
    }
  }
  return dialogModule;
}

async function getFsModule() {
  if (!fsModule) {
    try {
      fsModule = await import('@tauri-apps/plugin-fs');
    } catch {
      // In test/browser environment, plugins not available
    }
  }
  return fsModule;
}

async function getNotificationModule() {
  if (!notificationModule) {
    try {
      notificationModule = await import('@tauri-apps/plugin-notification');
    } catch {
      // In test/browser environment, plugins not available
    }
  }
  return notificationModule;
}

/**
 * Notification Types
 */
export type NotificationType = 'success' | 'error' | 'info' | 'warning';

/** Minimal shape for items that can be exported as JSON files */
export interface Exportable {
  name: string;
}

/**
 * Send desktop notification
 */
export async function showNotification(
  title: string,
  body: string,
  _notificationType: NotificationType = 'info'
): Promise<void> {
  try {
    const notifModule = await getNotificationModule();
    if (notifModule?.sendNotification) {
      await notifModule.sendNotification({
        title,
        body
      });
    } else {
      console.log(`[Notification] ${title}: ${body}`);
    }
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}

/**
 * File Dialog Operations
 */

/**
 * Open file picker for importing tools/skills
 */
export async function pickImportFile(fileType: 'tool' | 'skill'): Promise<string | null> {
  try {
    const dialogMod = await getDialogModule();
    if (!dialogMod?.open || !fsModule?.readTextFile) {
      console.log(`[File Dialog] Would open ${fileType} import dialog`);
      return null;
    }

    const filters = fileType === 'tool'
      ? [{ name: 'JSON', extensions: ['json'] }]
      : [{ name: 'JSON', extensions: ['json'] }];

    const file = await dialogMod.open({
      title: `Import ${fileType}`,
      filters,
      multiple: false
    });

    if (!file) return null;

    // Read file content
    const fsMod = await getFsModule();
    const content = await fsMod.readTextFile(file as string);
    return content;
  } catch (error) {
    console.error(`Failed to pick import file for ${fileType}:`, error);
    throw error;
  }
}

/**
 * Save file dialog for exporting tools/skills
 */
export async function pickExportFile(fileType: 'tool' | 'skill', suggestedName: string): Promise<string | null> {
  try {
    const dialogMod = await getDialogModule();
    if (!dialogMod?.save) {
      console.log(`[File Dialog] Would save ${fileType} export dialog`);
      return null;
    }

    const defaultName = suggestedName.replace(/\s+/g, '_').toLowerCase();
    const fileName = fileType === 'tool'
      ? `${defaultName}_tool.json`
      : `${defaultName}_skill.json`;

    const path = await dialogMod.save({
      title: `Export ${fileType}`,
      defaultPath: fileName,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    return path || null;
  } catch (error) {
    console.error(`Failed to pick export file for ${fileType}:`, error);
    throw error;
  }
}

/**
 * Write content to file
 */
export async function writeToFile(filePath: string, content: string): Promise<void> {
  try {
    const fsMod = await getFsModule();
    if (!fsMod?.writeTextFile) {
      console.log(`[File IO] Would write to ${filePath}`);
      return;
    }
    await fsMod.writeTextFile(filePath, content);
  } catch (error) {
    console.error('Failed to write file:', error);
    throw error;
  }
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await invoke('copy_to_clipboard', { text });
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    // Fallback to web API
    try {
      await navigator.clipboard.writeText(text);
    } catch (webError) {
      console.error('Clipboard fallback also failed:', webError);
      throw webError;
    }
  }
}

/**
 * Paste text from clipboard
 */
export async function pasteFromClipboard(): Promise<string> {
  try {
    return await invoke('paste_from_clipboard');
  } catch (error) {
    console.error('Failed to paste from clipboard:', error);
    // Fallback to web API
    try {
      return await navigator.clipboard.readText();
    } catch (webError) {
      console.error('Clipboard fallback also failed:', webError);
      throw webError;
    }
  }
}

/**
 * Get application cache directory
 */
export async function getCacheDir(): Promise<string> {
  try {
    return await invoke('get_cache_dir');
  } catch (error) {
    console.error('Failed to get cache directory:', error);
    throw error;
  }
}

/**
 * Get application data directory
 */
export async function getDataDir(): Promise<string> {
  try {
    return await invoke('get_data_dir');
  } catch (error) {
    console.error('Failed to get data directory:', error);
    throw error;
  }
}

/**
 * Export tool as JSON
 */
export async function exportTool(tool: Exportable): Promise<void> {
  try {
    const filePath = await pickExportFile('tool', tool.name);
    if (!filePath) return;

    const content = JSON.stringify(tool, null, 2);
    await writeToFile(filePath, content);

    await showNotification(
      'Tool Exported',
      `${tool.name} exported successfully`,
      'success'
    );
  } catch (error) {
    await showNotification(
      'Export Failed',
      error instanceof Error ? error.message : 'Failed to export tool',
      'error'
    );
    throw error;
  }
}

/**
 * Export skill as JSON
 */
export async function exportSkill(skill: Exportable): Promise<void> {
  try {
    const filePath = await pickExportFile('skill', skill.name);
    if (!filePath) return;

    const content = JSON.stringify(skill, null, 2);
    await writeToFile(filePath, content);

    await showNotification(
      'Skill Exported',
      `${skill.name} exported successfully`,
      'success'
    );
  } catch (error) {
    await showNotification(
      'Export Failed',
      error instanceof Error ? error.message : 'Failed to export skill',
      'error'
    );
    throw error;
  }
}

/**
 * Import tool from file
 */
export async function importTool(): Promise<string | null> {
  try {
    const content = await pickImportFile('tool');
    if (!content) return null;

    const tool = JSON.parse(content);

    await showNotification(
      'Tool Imported',
      `${tool.name} imported successfully`,
      'success'
    );

    return content;
  } catch (error) {
    await showNotification(
      'Import Failed',
      error instanceof Error ? error.message : 'Failed to import tool',
      'error'
    );
    throw error;
  }
}

/**
 * Import skill from file
 */
export async function importSkill(): Promise<string | null> {
  try {
    const content = await pickImportFile('skill');
    if (!content) return null;

    const skill = JSON.parse(content);

    await showNotification(
      'Skill Imported',
      `${skill.name} imported successfully`,
      'success'
    );

    return content;
  } catch (error) {
    await showNotification(
      'Import Failed',
      error instanceof Error ? error.message : 'Failed to import skill',
      'error'
    );
    throw error;
  }
}

/**
 * Save execution result to file
 */
export async function saveExecutionResult(
  result: unknown,
  toolOrSkillName: string,
  _type: 'tool' | 'skill'
): Promise<void> {
  try {
    const dialogMod = await getDialogModule();
    if (!dialogMod?.save) {
      console.log('[File Dialog] Would save execution result');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const suggestedName = `${toolOrSkillName}_result_${timestamp}`;

    const filePath = await dialogMod.save({
      title: 'Save Execution Result',
      defaultPath: `${suggestedName}.json`,
      filters: [
        { name: 'JSON', extensions: ['json'] },
        { name: 'Text', extensions: ['txt'] }
      ]
    });

    if (!filePath) return;

    let content: string;
    if (filePath.endsWith('.json')) {
      content = JSON.stringify(result, null, 2);
    } else {
      content = JSON.stringify(result, null, 2);
    }

    await writeToFile(filePath, content);

    await showNotification(
      'Result Saved',
      'Execution result saved successfully',
      'success'
    );
  } catch (error) {
    await showNotification(
      'Save Failed',
      error instanceof Error ? error.message : 'Failed to save result',
      'error'
    );
    throw error;
  }
}

/**
 * Batch notification for long-running operations
 */
export async function notifyCompletion(
  operationType: 'tool' | 'skill' | 'synthesis',
  operationName: string,
  duration: number,
  success: boolean = true
): Promise<void> {
  const typeLabel = operationType === 'tool'
    ? 'Tool'
    : operationType === 'skill'
      ? 'Skill'
      : 'Synthesis';

  const durationLabel = duration > 1000
    ? `${(duration / 1000).toFixed(1)}s`
    : `${duration}ms`;

  await showNotification(
    `${typeLabel} ${success ? 'Completed' : 'Failed'}`,
    `${operationName} - ${durationLabel}`,
    success ? 'success' : 'error'
  );
}
