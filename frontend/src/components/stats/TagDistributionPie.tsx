import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface TagDistributionPieProps {
  data: { name: string; value: number }[];
  title: string;
  colors?: string[];
}

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#6366f1', // indigo
  '#84cc16', // lime
  '#f97316', // orange
];

export default function TagDistributionPie({ 
  data, 
  title, 
  colors = DEFAULT_COLORS 
}: TagDistributionPieProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
        <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
          No data available
        </div>
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const percentage = ((payload[0].value / total) * 100).toFixed(1);
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {payload[0].name}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {payload[0].value} drills ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = (props: any) => {
    const { cx, cy, midAngle, outerRadius, percent, index } = props;
    const RADIAN = Math.PI / 180;
    
    // Point 1: Edge of pie slice
    const x1 = cx + outerRadius * Math.cos(-midAngle * RADIAN);
    const y1 = cy + outerRadius * Math.sin(-midAngle * RADIAN);
    
    // For smaller slices, adjust the angle to create more vertical spread
    // This creates more acute angles at the elbow joint
    let angleAdjustment = 0;
    if (percent < 0.03) {
      // Alternate between pushing up and down for extremely small slices
      angleAdjustment = (index % 2 === 0) ? -15 : 15; // ±15 degrees
    } else if (percent < 0.05) {
      angleAdjustment = (index % 2 === 0) ? -10 : 10; // ±10 degrees
    } else if (percent < 0.1) {
      angleAdjustment = (index % 2 === 0) ? -5 : 5; // ±5 degrees
    }
    
    const adjustedAngle = midAngle + angleAdjustment;
    const elbowRadius = outerRadius + 40;
    
    // Point 2: Elbow joint (with adjusted angle for smaller slices)
    const x2 = cx + elbowRadius * Math.cos(-adjustedAngle * RADIAN);
    const y2 = cy + elbowRadius * Math.sin(-adjustedAngle * RADIAN);
    
    // Point 3: End of horizontal line
    const isRightSide = x2 > cx;
    const horizontalLength = 45;
    const x3 = isRightSide ? x2 + horizontalLength : x2 - horizontalLength;
    const y3 = y2; // Horizontal line
    
    const textX = isRightSide ? x3 + 5 : x3 - 5;
    
    return (
      <g key={`label-group-${index}`}>
        <polyline
          points={`${x1},${y1} ${x2},${y2} ${x3},${y3}`}
          stroke="currentColor"
          strokeWidth={1}
          fill="none"
          className="stroke-gray-400 dark:stroke-gray-500"
        />
        <text
          x={textX}
          y={y3}
          fill="currentColor"
          textAnchor={isRightSide ? 'start' : 'end'}
          dominantBaseline="central"
          className="text-xs font-medium fill-gray-700 dark:fill-gray-300"
        >
          {`${data[index].name} (${(percent * 100).toFixed(0)}%)`}
        </text>
      </g>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={500}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={70}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
