interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
  subtitle?: string;
}

export default function StatCard({ 
  title, 
  value, 
  icon, 
  color = 'text-primary-600 dark:text-primary-400',
  subtitle 
}: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {title}
        </h3>
        {icon && (
          <div className={color}>
            {icon}
          </div>
        )}
      </div>
      <p className={`text-3xl font-bold ${color}`}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
}
