interface CircularProgressProps {
  progress: number;
  total: number | null;
  size?: number;
  strokeWidth?: number;
  showPercentage?: boolean;
}

export default function CircularProgress({ 
  progress, 
  total, 
  size = 120, 
  strokeWidth = 8,
  showPercentage = true 
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = total && total > 0 ? (progress / total) * 100 : 0;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200 dark:text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-primary-600 dark:text-primary-500 transition-all duration-300 ease-out"
        />
      </svg>
      {showPercentage && total && total > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {Math.round(percentage)}%
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {progress}/{total}
          </span>
        </div>
      )}
      {(!total || total === 0) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-pulse text-gray-900 dark:text-white font-semibold">
            {progress}
          </div>
        </div>
      )}
    </div>
  );
}
