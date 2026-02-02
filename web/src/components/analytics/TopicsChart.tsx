import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TopicMetric } from '@/lib/types/analytics';

interface TopicsChartProps {
  data: TopicMetric[];
  height?: number;
}

export function TopicsChart({ data, height = 300 }: TopicsChartProps) {
  // Sort by count descending and limit to top 10
  const chartData = data.slice(0, 10).map((item) => ({
    topic: item.topic.substring(0, 20), // Truncate long topics
    count: item.count,
  }));

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <h3 className="mb-4 font-semibold text-slate-100">Top Topics</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 200, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis type="number" stroke="#94a3b8" style={{ fontSize: '12px' }} />
          <YAxis dataKey="topic" type="category" stroke="#94a3b8" width={190} style={{ fontSize: '11px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#e2e8f0' }}
          />
          <Bar dataKey="count" fill="#9333ea" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
