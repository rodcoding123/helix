/**
 * SkillEditor - Full-page editor for creating and editing custom SKILL.md files
 *
 * Provides a two-panel layout:
 *   Left panel (300px):  Structured frontmatter editor (name, description, requirements, gating)
 *   Right panel (flex):  Monospace markdown editor for the skill instruction body
 *
 * Skills are saved to: {workspacePath}/skills/{skillName}/SKILL.md
 * Uses Tauri invoke commands: write_file, read_file, list_directory
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useGateway } from '../../hooks/useGateway';
import { invoke } from '../../lib/tauri-compat';

/* =====================================================================
   Types
   ===================================================================== */

interface SkillEditorProps {
  workspacePath?: string;
  existingSkill?: string;
  onBack?: () => void;
  onSave?: (name: string) => void;
}

interface SkillFrontmatter {
  name: string;
  description: string;
  version: string;
  requirements: {
    bins: string[];
    env: string[];
    os: string[];
    config: string[];
  };
  gating: string[];
}

const OS_OPTIONS = [
  { value: 'darwin', label: 'macOS' },
  { value: 'linux', label: 'Linux' },
  { value: 'win32', label: 'Windows' },
] as const;

const KEBAB_CASE_REGEX = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SEMVER_REGEX = /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?$/;

/* =====================================================================
   Helpers
   ===================================================================== */

function createEmptyFrontmatter(): SkillFrontmatter {
  return {
    name: '',
    description: '',
    version: '1.0.0',
    requirements: {
      bins: [],
      env: [],
      os: [],
      config: [],
    },
    gating: [],
  };
}

function toKebabCase(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Serialise the frontmatter struct into a YAML string.
 * Hand-rolled to avoid pulling in a YAML library for a small surface area.
 */
function serialiseFrontmatter(fm: SkillFrontmatter): string {
  const lines: string[] = [];

  lines.push(`name: ${fm.name}`);
  lines.push(`description: ${fm.description}`);

  if (fm.version) {
    lines.push(`version: ${fm.version}`);
  }

  // Requirements block - only emit if at least one field is populated
  const hasReqs =
    fm.requirements.bins.length > 0 ||
    fm.requirements.env.length > 0 ||
    fm.requirements.os.length > 0 ||
    fm.requirements.config.length > 0;

  if (hasReqs) {
    lines.push('requirements:');

    if (fm.requirements.bins.length > 0) {
      lines.push('  bins:');
      for (const b of fm.requirements.bins) {
        lines.push(`    - ${b}`);
      }
    }

    if (fm.requirements.env.length > 0) {
      lines.push('  env:');
      for (const e of fm.requirements.env) {
        lines.push(`    - ${e}`);
      }
    }

    if (fm.requirements.os.length > 0) {
      lines.push('  os:');
      for (const o of fm.requirements.os) {
        lines.push(`    - ${o}`);
      }
    }

    if (fm.requirements.config.length > 0) {
      lines.push('  config:');
      for (const c of fm.requirements.config) {
        lines.push(`    - ${c}`);
      }
    }
  }

  // Gating
  if (fm.gating.length > 0) {
    lines.push('gating:');
    for (const g of fm.gating) {
      lines.push(`  - ${g}`);
    }
  }

  return lines.join('\n');
}

/**
 * Parse a SKILL.md file content into frontmatter struct + body.
 * Expects YAML frontmatter delimited by --- ... ---
 */
function parseSkillMd(content: string): { frontmatter: SkillFrontmatter; body: string } {
  const fm = createEmptyFrontmatter();
  let body = content;

  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: fm, body: content };
  }

  const yamlBlock = match[1];
  body = match[2];

  // Minimal YAML parser for the known structure
  let currentSection = '';
  let currentSubSection = '';

  for (const rawLine of yamlBlock.split('\n')) {
    const line = rawLine.replace(/\r$/, '');

    // Top-level scalar: key: value
    const scalarMatch = line.match(/^([a-z_]+):\s*(.+)$/);
    if (scalarMatch) {
      const [, key, value] = scalarMatch;
      switch (key) {
        case 'name':
          fm.name = value.trim();
          break;
        case 'description':
          fm.description = value.trim();
          break;
        case 'version':
          fm.version = value.trim();
          break;
      }
      currentSection = '';
      currentSubSection = '';
      continue;
    }

    // Top-level section header: key:
    const sectionMatch = line.match(/^([a-z_]+):\s*$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      currentSubSection = '';
      continue;
    }

    // Sub-section header (2-space indent): key:
    const subSectionMatch = line.match(/^ {2}([a-z_]+):\s*$/);
    if (subSectionMatch && currentSection === 'requirements') {
      currentSubSection = subSectionMatch[1];
      continue;
    }

    // List item under requirements sub-section (4-space indent)
    const deepItemMatch = line.match(/^ {4}- (.+)$/);
    if (deepItemMatch && currentSection === 'requirements') {
      const val = deepItemMatch[1].trim();
      switch (currentSubSection) {
        case 'bins':
          fm.requirements.bins.push(val);
          break;
        case 'env':
          fm.requirements.env.push(val);
          break;
        case 'os':
          fm.requirements.os.push(val);
          break;
        case 'config':
          fm.requirements.config.push(val);
          break;
      }
      continue;
    }

    // List item under top-level section (2-space indent)
    const shallowItemMatch = line.match(/^ {2}- (.+)$/);
    if (shallowItemMatch) {
      const val = shallowItemMatch[1].trim();
      if (currentSection === 'gating') {
        fm.gating.push(val);
      }
      continue;
    }
  }

  return { frontmatter: fm, body };
}

/**
 * Assemble the complete SKILL.md content from frontmatter + body.
 */
function assembleSkillMd(fm: SkillFrontmatter, body: string): string {
  return `---\n${serialiseFrontmatter(fm)}\n---\n\n${body}`;
}

/* =====================================================================
   Tag Input sub-component
   ===================================================================== */

function TagInput({
  tags,
  onChange,
  placeholder,
  id,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  id?: string;
}) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = inputValue.trim().replace(/,$/, '');
        if (val && !tags.includes(val)) {
          onChange([...tags, val]);
        }
        setInputValue('');
      } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
        onChange(tags.slice(0, -1));
      }
    },
    [inputValue, tags, onChange]
  );

  const removeTag = useCallback(
    (idx: number) => {
      onChange(tags.filter((_, i) => i !== idx));
    },
    [tags, onChange]
  );

  return (
    <div className="se-tag-input-wrapper" onClick={() => inputRef.current?.focus()}>
      {tags.map((tag, idx) => (
        <span key={`${tag}-${idx}`} className="se-tag">
          <span className="se-tag-text">{tag}</span>
          <button
            type="button"
            className="se-tag-remove"
            onClick={e => {
              e.stopPropagation();
              removeTag(idx);
            }}
            aria-label={`Remove ${tag}`}
          >
            <svg viewBox="0 0 12 12" width="10" height="10" fill="currentColor">
              <path d="M3.05 3.05a.5.5 0 01.707 0L6 5.293l2.243-2.243a.5.5 0 01.707.707L6.707 6l2.243 2.243a.5.5 0 01-.707.707L6 6.707 3.757 8.95a.5.5 0 01-.707-.707L5.293 6 3.05 3.757a.5.5 0 010-.707z" />
            </svg>
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        type="text"
        className="se-tag-input-field"
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ''}
      />
    </div>
  );
}

/* =====================================================================
   SkillEditor component
   ===================================================================== */

export function SkillEditor({ workspacePath, existingSkill, onBack, onSave }: SkillEditorProps) {
  const { connected } = useGateway();

  // ── Core state ──
  const [frontmatter, setFrontmatter] = useState<SkillFrontmatter>(createEmptyFrontmatter);
  const [body, setBody] = useState('# My Custom Skill\n\nInstructions for the agent go here.\n');
  const [originalContent, setOriginalContent] = useState('');
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [nameError, setNameError] = useState('');
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // ── Derived ──
  const isEditing = Boolean(existingSkill);
  const currentContent = useMemo(() => assembleSkillMd(frontmatter, body), [frontmatter, body]);
  const isModified = currentContent !== originalContent;

  const filePath = useMemo(() => {
    if (!workspacePath || !frontmatter.name) return '';
    const separator = workspacePath.includes('\\') ? '\\' : '/';
    return `${workspacePath}${separator}skills${separator}${frontmatter.name}${separator}SKILL.md`;
  }, [workspacePath, frontmatter.name]);

  // Line / char counts for the body editor
  const bodyStats = useMemo(() => {
    const lines = body.split('\n').length;
    const chars = body.length;
    return { lines, chars };
  }, [body]);

  // ── Validation ──
  const validateName = useCallback((name: string): string => {
    if (!name) return 'Skill name is required';
    if (!KEBAB_CASE_REGEX.test(name)) {
      return 'Must be kebab-case (lowercase, hyphens, start with letter)';
    }
    if (name.length > 64) return 'Name must be 64 characters or fewer';
    return '';
  }, []);

  const canSave = useMemo(() => {
    return (
      frontmatter.name.length > 0 &&
      validateName(frontmatter.name) === '' &&
      body.trim().length > 0 &&
      !saving
    );
  }, [frontmatter.name, validateName, body, saving]);

  // ── Load existing skill ──
  useEffect(() => {
    if (!existingSkill || !workspacePath) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const separator = workspacePath.includes('\\') ? '\\' : '/';
        const path = `${workspacePath}${separator}skills${separator}${existingSkill}${separator}SKILL.md`;
        const content = await invoke<string>('read_file', { path });

        if (cancelled) return;

        const { frontmatter: parsed, body: parsedBody } = parseSkillMd(content);
        setFrontmatter(parsed);
        setBody(parsedBody);
        setOriginalContent(content);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load skill:', err);
        setSaveStatus('error');
        setSaveMessage(`Failed to load skill: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [existingSkill, workspacePath]);

  // Set original content for new skills
  useEffect(() => {
    if (!existingSkill && originalContent === '') {
      setOriginalContent(currentContent);
    }
  }, [existingSkill, originalContent, currentContent]);

  // ── Save ──
  const handleSave = useCallback(async () => {
    if (!canSave || !workspacePath) return;

    const nameErr = validateName(frontmatter.name);
    if (nameErr) {
      setNameError(nameErr);
      return;
    }

    setSaving(true);
    setSaveStatus('idle');

    try {
      const assembled = assembleSkillMd(frontmatter, body);
      const separator = workspacePath.includes('\\') ? '\\' : '/';
      const dirPath = `${workspacePath}${separator}skills${separator}${frontmatter.name}`;
      const targetPath = `${dirPath}${separator}SKILL.md`;

      // Ensure directory exists by writing the file (Tauri write_file creates dirs)
      await invoke('write_file', { path: targetPath, content: assembled });

      setOriginalContent(assembled);
      setSaveStatus('saved');
      setSaveMessage(`Saved to ${targetPath}`);
      onSave?.(frontmatter.name);

      // Clear status after 3 seconds
      setTimeout(() => {
        setSaveStatus('idle');
        setSaveMessage('');
      }, 3000);
    } catch (err) {
      console.error('Failed to save skill:', err);
      setSaveStatus('error');
      setSaveMessage(`Failed to save: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }, [canSave, workspacePath, frontmatter, body, validateName, onSave]);

  // ── Keyboard shortcut: Ctrl+S / Cmd+S ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  // ── Discard changes ──
  const handleDiscard = useCallback(() => {
    if (existingSkill && originalContent) {
      const { frontmatter: parsed, body: parsedBody } = parseSkillMd(originalContent);
      setFrontmatter(parsed);
      setBody(parsedBody);
    } else {
      setFrontmatter(createEmptyFrontmatter());
      setBody('# My Custom Skill\n\nInstructions for the agent go here.\n');
      setOriginalContent('');
    }
    setSaveStatus('idle');
    setSaveMessage('');
    setNameError('');
  }, [existingSkill, originalContent]);

  // ── Frontmatter updaters ──
  const updateName = useCallback(
    (raw: string) => {
      const converted = toKebabCase(raw);
      setFrontmatter(prev => ({ ...prev, name: converted }));
      setNameError(validateName(converted));
    },
    [validateName]
  );

  const updateDescription = useCallback((value: string) => {
    setFrontmatter(prev => ({ ...prev, description: value }));
  }, []);

  const updateVersion = useCallback((value: string) => {
    setFrontmatter(prev => ({ ...prev, version: value }));
  }, []);

  const updateBins = useCallback((bins: string[]) => {
    setFrontmatter(prev => ({
      ...prev,
      requirements: { ...prev.requirements, bins },
    }));
  }, []);

  const updateEnv = useCallback((env: string[]) => {
    setFrontmatter(prev => ({
      ...prev,
      requirements: { ...prev.requirements, env },
    }));
  }, []);

  const updateConfig = useCallback((config: string[]) => {
    setFrontmatter(prev => ({
      ...prev,
      requirements: { ...prev.requirements, config },
    }));
  }, []);

  const toggleOs = useCallback((os: string) => {
    setFrontmatter(prev => {
      const current = prev.requirements.os;
      const next = current.includes(os) ? current.filter(o => o !== os) : [...current, os];
      return {
        ...prev,
        requirements: { ...prev.requirements, os: next },
      };
    });
  }, []);

  const updateGating = useCallback((gating: string[]) => {
    setFrontmatter(prev => ({ ...prev, gating }));
  }, []);

  // ── Line numbers for body editor ──
  const lineNumbers = useMemo(() => {
    const count = body.split('\n').length;
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [body]);

  // ── Sync scroll for line numbers ──
  const lineNumberRef = useRef<HTMLDivElement>(null);

  const handleBodyScroll = useCallback(() => {
    if (bodyRef.current && lineNumberRef.current) {
      lineNumberRef.current.scrollTop = bodyRef.current.scrollTop;
    }
  }, []);

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════

  if (loading) {
    return (
      <div className="se-root">
        <style>{skillEditorStyles}</style>
        <div className="se-loading">
          <div className="se-spinner" />
          <span>Loading skill...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="se-root">
      <style>{skillEditorStyles}</style>

      {/* ── Top bar ── */}
      <header className="se-topbar">
        <div className="se-topbar-left">
          <button className="se-btn se-btn-ghost" onClick={onBack} title="Back to Skills">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <div className="se-breadcrumb">
            <span className="se-breadcrumb-parent" onClick={onBack}>
              Skills
            </span>
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              width="12"
              height="12"
              className="se-breadcrumb-sep"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span className="se-breadcrumb-current">
              {isEditing ? frontmatter.name : 'New Skill'}
              {isModified && <span className="se-modified-dot">*</span>}
            </span>
          </div>
        </div>

        <div className="se-topbar-right">
          {isModified && (
            <button
              className="se-btn se-btn-ghost se-btn-discard"
              onClick={handleDiscard}
              title="Discard changes"
            >
              Discard
            </button>
          )}
          <button
            className={`se-btn se-btn-toggle ${preview ? 'se-btn-toggle-active' : ''}`}
            onClick={() => setPreview(p => !p)}
            title={preview ? 'Switch to editor' : 'Preview assembled SKILL.md'}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              {preview ? (
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              ) : (
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              )}
              {!preview && (
                <path
                  fillRule="evenodd"
                  d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                  clipRule="evenodd"
                />
              )}
            </svg>
            {preview ? 'Edit' : 'Preview'}
          </button>
          <button
            className="se-btn se-btn-primary"
            disabled={!canSave || saving}
            onClick={handleSave}
            title="Save skill (Ctrl+S)"
          >
            {saving ? (
              <>
                <div className="se-btn-spinner" />
                Saving...
              </>
            ) : (
              <>
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                  <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                </svg>
                Save
              </>
            )}
          </button>
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="se-main">
        {preview ? (
          /* ═══ Preview mode ═══ */
          <div className="se-preview">
            <div className="se-preview-header">
              <span className="se-preview-badge">Preview</span>
              <span className="se-preview-label">Assembled SKILL.md as the agent will see it</span>
            </div>
            <pre className="se-preview-content">{currentContent}</pre>
          </div>
        ) : (
          <>
            {/* ═══ Left panel: Frontmatter editor ═══ */}
            <aside className="se-sidebar">
              <div className="se-sidebar-scroll">
                <div className="se-sidebar-section">
                  <h3 className="se-section-title">Identity</h3>

                  {/* Name */}
                  <div className="se-field">
                    <label className="se-label" htmlFor="se-name">
                      Skill Name
                    </label>
                    <input
                      id="se-name"
                      type="text"
                      className={`se-input ${nameError ? 'se-input-error' : ''}`}
                      value={frontmatter.name}
                      onChange={e => updateName(e.target.value)}
                      placeholder="my-custom-skill"
                      spellCheck={false}
                      autoComplete="off"
                    />
                    {nameError && <span className="se-field-error">{nameError}</span>}
                    <span className="se-field-hint">kebab-case, lowercase</span>
                  </div>

                  {/* Description */}
                  <div className="se-field">
                    <label className="se-label" htmlFor="se-desc">
                      Description
                    </label>
                    <textarea
                      id="se-desc"
                      className="se-textarea"
                      value={frontmatter.description}
                      onChange={e => updateDescription(e.target.value)}
                      placeholder="Brief description of what this skill does"
                      rows={2}
                    />
                  </div>

                  {/* Version */}
                  <div className="se-field">
                    <label className="se-label" htmlFor="se-version">
                      Version
                    </label>
                    <input
                      id="se-version"
                      type="text"
                      className={`se-input ${
                        frontmatter.version && !SEMVER_REGEX.test(frontmatter.version)
                          ? 'se-input-error'
                          : ''
                      }`}
                      value={frontmatter.version}
                      onChange={e => updateVersion(e.target.value)}
                      placeholder="1.0.0"
                      spellCheck={false}
                    />
                    {frontmatter.version && !SEMVER_REGEX.test(frontmatter.version) && (
                      <span className="se-field-error">Must be valid semver (e.g. 1.0.0)</span>
                    )}
                  </div>
                </div>

                {/* Requirements */}
                <div className="se-sidebar-section">
                  <h3 className="se-section-title">Requirements</h3>

                  {/* Binaries */}
                  <div className="se-field">
                    <label className="se-label" htmlFor="se-bins">
                      Binaries
                    </label>
                    <TagInput
                      id="se-bins"
                      tags={frontmatter.requirements.bins}
                      onChange={updateBins}
                      placeholder="e.g. node, python (Enter to add)"
                    />
                    <span className="se-field-hint">CLIs that must exist on PATH</span>
                  </div>

                  {/* Environment Variables */}
                  <div className="se-field">
                    <label className="se-label" htmlFor="se-env">
                      Environment Variables
                    </label>
                    <TagInput
                      id="se-env"
                      tags={frontmatter.requirements.env}
                      onChange={updateEnv}
                      placeholder="e.g. MY_API_KEY (Enter to add)"
                    />
                    <span className="se-field-hint">Env vars that must be set</span>
                  </div>

                  {/* Operating Systems */}
                  <div className="se-field">
                    <label className="se-label">Operating Systems</label>
                    <div className="se-os-group">
                      {OS_OPTIONS.map(opt => (
                        <label key={opt.value} className="se-checkbox-label">
                          <input
                            type="checkbox"
                            className="se-checkbox"
                            checked={frontmatter.requirements.os.includes(opt.value)}
                            onChange={() => toggleOs(opt.value)}
                          />
                          <span className="se-checkbox-custom" />
                          <span className="se-checkbox-text">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                    <span className="se-field-hint">Leave unchecked for all platforms</span>
                  </div>

                  {/* Config Keys */}
                  <div className="se-field">
                    <label className="se-label" htmlFor="se-config">
                      Config Keys
                    </label>
                    <TagInput
                      id="se-config"
                      tags={frontmatter.requirements.config}
                      onChange={updateConfig}
                      placeholder="e.g. github.token (Enter to add)"
                    />
                    <span className="se-field-hint">Required config entries</span>
                  </div>
                </div>

                {/* Gating */}
                <div className="se-sidebar-section">
                  <h3 className="se-section-title">Gating</h3>
                  <div className="se-field">
                    <label className="se-label" htmlFor="se-gating">
                      Conditions
                    </label>
                    <TagInput
                      id="se-gating"
                      tags={frontmatter.gating}
                      onChange={updateGating}
                      placeholder="e.g. requires approval (Enter to add)"
                    />
                    <span className="se-field-hint">Safety gates before execution</span>
                  </div>
                </div>
              </div>
            </aside>

            {/* ═══ Right panel: Markdown editor ═══ */}
            <main className="se-editor-panel">
              <div className="se-editor-header">
                <span className="se-editor-title">Skill Instructions (Markdown)</span>
                <span className="se-editor-stats">
                  {bodyStats.lines} line{bodyStats.lines !== 1 ? 's' : ''} | {bodyStats.chars} char
                  {bodyStats.chars !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="se-editor-body">
                <div className="se-line-numbers" ref={lineNumberRef}>
                  {lineNumbers.map(n => (
                    <div key={n} className="se-line-number">
                      {n}
                    </div>
                  ))}
                </div>
                <textarea
                  ref={bodyRef}
                  className="se-editor-textarea"
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  onScroll={handleBodyScroll}
                  spellCheck={false}
                  placeholder="# Skill Title&#10;&#10;Write instructions for the agent here..."
                />
              </div>
            </main>
          </>
        )}
      </div>

      {/* ── Bottom bar ── */}
      <footer className="se-bottombar">
        <div className="se-bottombar-left">
          {isModified && (
            <span className="se-status-modified">
              <span className="se-status-dot" />
              Unsaved changes
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="se-status-saved">
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="se-status-error">
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {saveMessage}
            </span>
          )}
        </div>
        <div className="se-bottombar-right">
          {filePath && (
            <span className="se-filepath" title={filePath}>
              {filePath}
            </span>
          )}
          {!connected && <span className="se-gateway-status">Gateway offline</span>}
        </div>
      </footer>
    </div>
  );
}

export default SkillEditor;

/* =====================================================================
   Scoped styles (se- prefix)
   ===================================================================== */

const skillEditorStyles = `
/* ── Root ── */
.se-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary, #0a0a1a);
  color: var(--text-primary, #fff);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  overflow: hidden;
}

/* ── Top bar ── */
.se-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  min-height: 48px;
  padding: 0 12px;
  background: var(--bg-secondary, #111127);
  border-bottom: 1px solid rgba(255,255,255,0.08);
  gap: 12px;
  flex-shrink: 0;
}

.se-topbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.se-topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* ── Breadcrumb ── */
.se-breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  min-width: 0;
}

.se-breadcrumb-parent {
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s ease;
}

.se-breadcrumb-parent:hover {
  color: var(--accent-color, #6366f1);
}

.se-breadcrumb-sep {
  color: var(--text-tertiary, #606080);
  flex-shrink: 0;
}

.se-breadcrumb-current {
  color: var(--text-primary, #fff);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.se-modified-dot {
  color: var(--accent-color, #6366f1);
  margin-left: 2px;
  font-weight: 700;
}

/* ── Buttons ── */
.se-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  font-family: inherit;
  line-height: 1;
}

.se-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.se-btn-ghost {
  background: transparent;
  color: var(--text-secondary, #a0a0c0);
  padding: 6px 8px;
}

.se-btn-ghost:hover:not(:disabled) {
  background: rgba(255,255,255,0.06);
  color: var(--text-primary, #fff);
}

.se-btn-discard {
  color: #f87171;
}

.se-btn-discard:hover:not(:disabled) {
  background: rgba(248,113,113,0.12);
  color: #fca5a5;
}

.se-btn-primary {
  background: var(--accent-color, #6366f1);
  color: #fff;
}

.se-btn-primary:hover:not(:disabled) {
  background: #818cf8;
  box-shadow: 0 2px 8px rgba(99,102,241,0.35);
}

.se-btn-toggle {
  background: rgba(255,255,255,0.04);
  color: var(--text-secondary, #a0a0c0);
  border: 1px solid rgba(255,255,255,0.08);
}

.se-btn-toggle:hover {
  background: rgba(255,255,255,0.08);
  color: var(--text-primary, #fff);
  border-color: rgba(255,255,255,0.12);
}

.se-btn-toggle-active {
  background: rgba(99,102,241,0.15);
  color: #818cf8;
  border-color: rgba(99,102,241,0.3);
}

.se-btn-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: se-spin 0.6s linear infinite;
}

@keyframes se-spin {
  to { transform: rotate(360deg); }
}

/* ── Main layout ── */
.se-main {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ── Left sidebar: Frontmatter ── */
.se-sidebar {
  width: 300px;
  min-width: 300px;
  background: var(--bg-secondary, #111127);
  border-right: 1px solid rgba(255,255,255,0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.se-sidebar-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.se-sidebar-scroll::-webkit-scrollbar {
  width: 6px;
}

.se-sidebar-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.se-sidebar-scroll::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.1);
  border-radius: 3px;
}

.se-sidebar-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(255,255,255,0.2);
}

.se-sidebar-section {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.se-sidebar-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.se-section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary, #606080);
  margin: 0 0 12px;
}

/* ── Form fields ── */
.se-field {
  margin-bottom: 14px;
}

.se-field:last-child {
  margin-bottom: 0;
}

.se-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, #a0a0c0);
  margin-bottom: 5px;
}

.se-input {
  width: 100%;
  padding: 7px 10px;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-primary, #fff);
  font-family: var(--font-mono, 'SF Mono', 'Fira Code', 'Cascadia Code', monospace);
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  box-sizing: border-box;
}

.se-input:focus {
  border-color: var(--accent-color, #6366f1);
  box-shadow: 0 0 0 2px rgba(99,102,241,0.15);
}

.se-input::placeholder {
  color: var(--text-tertiary, #606080);
}

.se-input-error {
  border-color: #f87171 !important;
}

.se-input-error:focus {
  box-shadow: 0 0 0 2px rgba(248,113,113,0.2) !important;
}

.se-textarea {
  width: 100%;
  padding: 7px 10px;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-primary, #fff);
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  resize: vertical;
  min-height: 48px;
  line-height: 1.4;
  box-sizing: border-box;
}

.se-textarea:focus {
  border-color: var(--accent-color, #6366f1);
  box-shadow: 0 0 0 2px rgba(99,102,241,0.15);
}

.se-textarea::placeholder {
  color: var(--text-tertiary, #606080);
}

.se-field-hint {
  display: block;
  font-size: 10px;
  color: var(--text-tertiary, #606080);
  margin-top: 4px;
  line-height: 1.3;
}

.se-field-error {
  display: block;
  font-size: 10px;
  color: #f87171;
  margin-top: 4px;
  line-height: 1.3;
}

/* ── Tag Input ── */
.se-tag-input-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 5px 8px;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  min-height: 32px;
  cursor: text;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  align-items: center;
}

.se-tag-input-wrapper:focus-within {
  border-color: var(--accent-color, #6366f1);
  box-shadow: 0 0 0 2px rgba(99,102,241,0.15);
}

.se-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  background: rgba(99,102,241,0.15);
  border: 1px solid rgba(99,102,241,0.25);
  border-radius: 4px;
  font-size: 11px;
  color: #a5b4fc;
  line-height: 1;
}

.se-tag-text {
  font-family: var(--font-mono, 'SF Mono', 'Fira Code', 'Cascadia Code', monospace);
}

.se-tag-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: rgba(165,180,252,0.6);
  cursor: pointer;
  padding: 0;
  margin-left: 1px;
  border-radius: 2px;
  transition: color 0.1s ease, background 0.1s ease;
}

.se-tag-remove:hover {
  color: #f87171;
  background: rgba(248,113,113,0.15);
}

.se-tag-input-field {
  flex: 1;
  min-width: 60px;
  background: none;
  border: none;
  color: var(--text-primary, #fff);
  font-size: 12px;
  font-family: var(--font-mono, 'SF Mono', 'Fira Code', 'Cascadia Code', monospace);
  outline: none;
  padding: 2px 0;
}

.se-tag-input-field::placeholder {
  color: var(--text-tertiary, #606080);
  font-family: inherit;
}

/* ── OS Checkboxes ── */
.se-os-group {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.se-checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}

.se-checkbox {
  display: none;
}

.se-checkbox-custom {
  width: 16px;
  height: 16px;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 4px;
  background: var(--bg-primary, #0a0a1a);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.se-checkbox:checked + .se-checkbox-custom {
  background: var(--accent-color, #6366f1);
  border-color: var(--accent-color, #6366f1);
}

.se-checkbox:checked + .se-checkbox-custom::after {
  content: '';
  width: 8px;
  height: 5px;
  border-left: 2px solid #fff;
  border-bottom: 2px solid #fff;
  transform: rotate(-45deg) translateY(-1px);
}

.se-checkbox-label:hover .se-checkbox-custom {
  border-color: rgba(255,255,255,0.35);
}

.se-checkbox-text {
  font-size: 12px;
  color: var(--text-secondary, #a0a0c0);
}

/* ── Right panel: Editor ── */
.se-editor-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background: var(--bg-primary, #0a0a1a);
}

.se-editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: rgba(255,255,255,0.02);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}

.se-editor-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary, #606080);
}

.se-editor-stats {
  font-size: 11px;
  color: var(--text-tertiary, #606080);
  font-family: var(--font-mono, 'SF Mono', 'Fira Code', 'Cascadia Code', monospace);
}

.se-editor-body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

/* ── Line numbers ── */
.se-line-numbers {
  width: 44px;
  min-width: 44px;
  overflow: hidden;
  padding: 12px 0;
  background: rgba(255,255,255,0.015);
  border-right: 1px solid rgba(255,255,255,0.06);
  user-select: none;
  -webkit-user-select: none;
}

.se-line-number {
  height: 20px;
  line-height: 20px;
  font-size: 11px;
  font-family: var(--font-mono, 'SF Mono', 'Fira Code', 'Cascadia Code', monospace);
  color: var(--text-tertiary, #606080);
  text-align: right;
  padding-right: 10px;
}

/* ── Editor textarea ── */
.se-editor-textarea {
  flex: 1;
  width: 100%;
  padding: 12px 16px;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary, #fff);
  font-size: 13px;
  font-family: var(--font-mono, 'SF Mono', 'Fira Code', 'Cascadia Code', monospace);
  line-height: 20px;
  resize: none;
  overflow-y: auto;
  tab-size: 2;
  white-space: pre;
  box-sizing: border-box;
}

.se-editor-textarea::placeholder {
  color: var(--text-tertiary, #606080);
  white-space: pre;
}

.se-editor-textarea::-webkit-scrollbar {
  width: 8px;
}

.se-editor-textarea::-webkit-scrollbar-track {
  background: transparent;
}

.se-editor-textarea::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.1);
  border-radius: 4px;
}

.se-editor-textarea::-webkit-scrollbar-thumb:hover {
  background: rgba(255,255,255,0.2);
}

/* ── Preview mode ── */
.se-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.se-preview-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: rgba(255,255,255,0.02);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}

.se-preview-badge {
  display: inline-block;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #a5b4fc;
  background: rgba(99,102,241,0.15);
  border: 1px solid rgba(99,102,241,0.25);
  border-radius: 4px;
}

.se-preview-label {
  font-size: 11px;
  color: var(--text-tertiary, #606080);
}

.se-preview-content {
  flex: 1;
  margin: 0;
  padding: 16px 20px;
  overflow-y: auto;
  font-size: 13px;
  font-family: var(--font-mono, 'SF Mono', 'Fira Code', 'Cascadia Code', monospace);
  line-height: 1.6;
  color: var(--text-secondary, #a0a0c0);
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--bg-primary, #0a0a1a);
}

.se-preview-content::-webkit-scrollbar {
  width: 8px;
}

.se-preview-content::-webkit-scrollbar-track {
  background: transparent;
}

.se-preview-content::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.1);
  border-radius: 4px;
}

/* ── Bottom bar ── */
.se-bottombar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  min-height: 32px;
  padding: 0 12px;
  background: var(--bg-secondary, #111127);
  border-top: 1px solid rgba(255,255,255,0.08);
  font-size: 11px;
  flex-shrink: 0;
  gap: 12px;
}

.se-bottombar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.se-bottombar-right {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.se-status-modified {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #fbbf24;
}

.se-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fbbf24;
  animation: se-pulse 2s ease-in-out infinite;
}

@keyframes se-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.se-status-saved {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #34d399;
}

.se-status-error {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #f87171;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.se-filepath {
  color: var(--text-tertiary, #606080);
  font-family: var(--font-mono, 'SF Mono', 'Fira Code', 'Cascadia Code', monospace);
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 500px;
  direction: rtl;
  text-align: left;
}

.se-gateway-status {
  color: var(--text-tertiary, #606080);
  font-size: 10px;
  padding: 1px 6px;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 3px;
  white-space: nowrap;
}

/* ── Loading state ── */
.se-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-tertiary, #606080);
  font-size: 13px;
}

.se-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(255,255,255,0.08);
  border-top-color: var(--accent-color, #6366f1);
  border-radius: 50%;
  animation: se-spin 0.8s linear infinite;
}

/* ── Responsive tweaks ── */
@media (max-width: 768px) {
  .se-main {
    flex-direction: column;
  }

  .se-sidebar {
    width: 100%;
    min-width: 100%;
    max-height: 40vh;
    border-right: none;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }

  .se-filepath {
    max-width: 200px;
  }
}
`;
