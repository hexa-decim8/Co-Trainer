import { useBranding } from '../contexts/BrandingContext';

interface BrandMarkProps {
  variant?: 'nav' | 'hero';
  subtitle?: string;
}

export default function BrandMark({ variant = 'nav', subtitle }: BrandMarkProps) {
  const { branding } = useBranding();
  const hasLogo = Boolean(branding?.logo_url);

  if (variant === 'hero') {
    return (
      <div className="text-center mb-8">
        {hasLogo ? (
          <img
            src={branding?.logo_url ?? undefined}
            alt="Team logo"
            className="mx-auto h-24 w-24 object-contain mb-4"
          />
        ) : (
          <div className="derby-star text-primary-500 text-6xl mb-4">★</div>
        )}
        <h1 className="text-4xl font-display font-bold text-gray-900 tracking-wider">
          CO-TRAINER
        </h1>
        {subtitle && <p className="text-gray-600 mt-2">{subtitle}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 min-w-0">
      {hasLogo ? (
        <img
          src={branding?.logo_url ?? undefined}
          alt="Team logo"
          className="h-12 w-12 rounded-md object-contain bg-white/10 p-1"
        />
      ) : (
        <div className="derby-star text-primary-500 text-4xl">★</div>
      )}
      <h1 className="text-3xl font-display font-bold text-white tracking-wider truncate">
        CO-TRAINER
      </h1>
    </div>
  );
}
