import { FC, useState } from 'react';
import { Loader, Play, Copy, Check } from 'lucide-react';
import type { CustomTool } from '@/lib/types/custom-tools';

interface CustomToolExecutorProps {
  tool: CustomTool;
  userId: string;
  onExecute: (params: Record<string, any>) => Promise<any>;
  isExecuting?: boolean;
}

interface ExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  executionTimeMs?: number;
}

export function CustomToolExecutor({
  tool,
  userId,
  onExecute,
  isExecuting = false,
}: CustomToolExecutorProps) {
  const [params, setParams] = useState<Record<string, any>>({});
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleExecute = async () => {
    setIsRunning(true);
    try {
      const execResult = await onExecute(params);
      setResult(execResult);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleParamChange = (paramName: string, value: any) => {
    setParams((prev) => ({ ...prev, [paramName]: value }));
  };

  const handleCopyResult = () => {
    if (result?.output) {
      navigator.clipboard.writeText(JSON.stringify(result.output, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const parameters = tool.parameters || [];

  return (
    <div className="space-y-4">
      {/* Parameter Inputs */}
      {parameters.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-slate-100">Parameters</h4>
          {parameters.map((param) => (
            <div key={param.name}>
              <label className="block text-sm text-slate-300 mb-1">
                {param.name}
                {param.required && <span className="text-red-400"> *</span>}
              </label>
              {param.type === 'boolean' ? (
                <select
                  value={String(params[param.name] ?? false)}
                  onChange={(e) =>
                    handleParamChange(param.name, e.target.value === 'true')
                  }
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                >
                  <option value="false">false</option>
                  <option value="true">true</option>
                </select>
              ) : param.type === 'number' ? (
                <input
                  type="number"
                  value={params[param.name] ?? ''}
                  onChange={(e) =>
                    handleParamChange(param.name, Number(e.target.value))
                  }
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                  placeholder={param.description}
                />
              ) : (
                <input
                  type="text"
                  value={params[param.name] ?? ''}
                  onChange={(e) =>
                    handleParamChange(param.name, e.target.value)
                  }
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                  placeholder={param.description}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Execute Button */}
      <button
        onClick={handleExecute}
        disabled={isRunning || isExecuting}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition-colors"
      >
        {isRunning || isExecuting ? (
          <>
            <Loader size={20} className="animate-spin" />
            Executing...
          </>
        ) : (
          <>
            <Play size={20} />
            Execute Tool
          </>
        )}
      </button>

      {/* Execution Result */}
      {result && (
        <div
          className={`p-4 rounded-lg border ${
            result.success
              ? 'bg-green-500/10 border-green-500/50'
              : 'bg-red-500/10 border-red-500/50'
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <p
              className={`font-semibold ${
                result.success ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {result.success ? '✓ Execution Successful' : '✗ Execution Failed'}
            </p>
            {result.executionTimeMs && (
              <p className="text-xs text-slate-400">
                {result.executionTimeMs}ms
              </p>
            )}
          </div>

          {result.error && (
            <p className="text-sm text-red-300 mb-3">{result.error}</p>
          )}

          {result.output && (
            <div className="relative">
              <pre className="bg-slate-900 p-3 rounded text-xs text-slate-300 overflow-x-auto max-h-48">
                {JSON.stringify(result.output, null, 2)}
              </pre>
              <button
                onClick={handleCopyResult}
                className="absolute top-2 right-2 p-1 bg-slate-800 hover:bg-slate-700 rounded"
                title="Copy result"
              >
                {copied ? (
                  <Check size={16} className="text-green-400" />
                ) : (
                  <Copy size={16} className="text-slate-400" />
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
