import { FC, useEffect, useState } from 'react';
import { getStatusService, type SystemStatus } from '@/services/status/status-service';
import { CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';

export const StatusPage: FC = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const service = getStatusService();
        const currentStatus = await service.getStatus();
        setStatus(currentStatus);
      } catch (error) {
        console.error('[StatusPage] Failed to load status:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStatus();
    const interval = setInterval(loadStatus, 60000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="max-w-3xl mx-auto text-center py-12">
          <p className="text-slate-400">Loading system status...</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="max-w-3xl mx-auto text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-slate-400">Unable to load system status</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-3xl mx-auto p-6 space-y-8">
        <div className="text-center py-8">
          <h1 className="text-4xl font-bold text-white mb-2">Helix Status</h1>
          <p className="text-slate-400">System Health and Incident History</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center space-y-4">
          {status.overall === 'operational' && (
            <>
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
              <h2 className="text-2xl font-bold text-white">All Systems Operational</h2>
            </>
          )}
          {status.overall === 'degraded' && (
            <>
              <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto" />
              <h2 className="text-2xl font-bold text-white">Degraded Performance</h2>
            </>
          )}
          {status.overall === 'major_outage' && (
            <>
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
              <h2 className="text-2xl font-bold text-white">Major Outage</h2>
            </>
          )}
          <p className="text-slate-400">
            90-day uptime: {status.uptime_90d.toFixed(2)}%
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-bold text-white">Component Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(status.components).map(([name, component]) => {
              const statusColor =
                component.status === 'operational'
                  ? 'bg-green-500/10 text-green-400'
                  : component.status === 'degraded'
                    ? 'bg-yellow-500/10 text-yellow-400'
                    : 'bg-red-500/10 text-red-400';

              return (
                <div
                  key={name}
                  className="bg-slate-900 border border-slate-800 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white capitalize">
                      {name.replace(/_/g, ' ')}
                    </span>
                    <span className={`px-3 py-1 rounded text-sm font-medium ${statusColor}`}>
                      {component.status.charAt(0).toUpperCase() + component.status.slice(1)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {status.incidents.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white">Recent Incidents</h3>
            <div className="space-y-3">
              {status.incidents.map((incident) => (
                <div
                  key={incident.id}
                  className="bg-slate-900 border border-slate-800 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-white">{incident.title}</h4>
                  </div>
                  <p className="text-sm text-slate-400">{incident.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <p className="text-sm text-blue-300">
            Last updated: {new Date(status.lastUpdated).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};
