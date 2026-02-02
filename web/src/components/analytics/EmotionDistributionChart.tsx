import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';

interface EmotionDistributionChartProps {
  data: Record<string, number>;
  height?: number;
}

const EMOTION_COLORS: Record<string, string> = {
  joy: '#22c55e',
  sadness: '#3b82f6',
  anger: '#ef4444',
  fear: '#f97316',
  surprise: '#eab308',
  disgust: '#8b5cf6',
  neutral: '#6b7280',
  unknown: '#9ca3af',
};

export function EmotionDistributionChart({
  data,
  height = 300,
}: EmotionDistributionChartProps) {
  // Convert object to array format for recharts
  const chartData = Object.entries(data).map(([emotion, count]) => ({
    name: emotion.charAt(0).toUpperCase() + emotion.slice(1),
    value: count,
    color: EMOTION_COLORS[emotion] || '#9ca3af',
  }));

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <h3 className="mb-4 font-semibold text-slate-100">Primary Emotions</h3>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ${value}`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#e2e8f0' }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
