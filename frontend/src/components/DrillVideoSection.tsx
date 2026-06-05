import { useEffect, useMemo, useState, type MouseEventHandler } from 'react';
import { AlertCircle, ExternalLink, Video } from 'lucide-react';

interface DrillVideoSectionProps {
  videoLink: string | null | undefined;
  videoLinkFinalUrl?: string | null;
  videoLinkResolved?: boolean | null;
  videoLinkError?: string | null;
  stopPropagation?: boolean;
  compact?: boolean;
}

function extractInstagramCode(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  const [contentType, contentCode] = parts;
  if (!["p", "reel", "reels", "tv"].includes(contentType)) {
    return null;
  }

  return contentCode || null;
}

function toEmbedUrl(videoLink: string): string | null {
  try {
    const url = new URL(videoLink);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
      if (host === 'youtu.be') {
        const id = url.pathname.replace('/', '').trim();
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }

      if (url.pathname.startsWith('/shorts/')) {
        const id = url.pathname.split('/')[2];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }

      if (url.pathname.startsWith('/embed/')) {
        return `https://www.youtube.com${url.pathname}`;
      }

      const id = url.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const parts = url.pathname.split('/').filter(Boolean);
      const id = parts.length ? parts[parts.length - 1] : '';
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }

    if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
      const match = url.pathname.match(/\/(?:@[^/]+\/video|v)\/(\d+)/i);
      if (!match?.[1]) {
        return null;
      }

      return `https://www.tiktok.com/embed/v2/${match[1]}`;
    }

    if (host === 'instagram.com' || host === 'instagr.am') {
      const contentCode = extractInstagramCode(url.pathname);
      return contentCode ? `https://www.instagram.com${url.pathname.replace(/\/$/, '')}/embed/captioned/` : null;
    }

    return null;
  } catch {
    return null;
  }
}

export default function DrillVideoSection({
  videoLink,
  videoLinkFinalUrl,
  videoLinkResolved,
  videoLinkError,
  stopPropagation = false,
  compact = false,
}: DrillVideoSectionProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const resolvedVideoLink = videoLinkFinalUrl || videoLink;

  const embedUrl = useMemo(() => {
    if (!resolvedVideoLink) {
      return null;
    }
    return toEmbedUrl(resolvedVideoLink);
  }, [resolvedVideoLink]);

  useEffect(() => {
    setLoadFailed(false);
    setIsLoaded(false);
  }, [embedUrl]);

  if (!resolvedVideoLink) {
    return null;
  }

  const backendUnresolvedWithoutEmbed = videoLinkResolved === false && !embedUrl;
  const sectionTitleSize = compact ? 'text-xs' : 'text-sm';

  const handleClick: MouseEventHandler<HTMLElement> = (event) => {
    if (stopPropagation) {
      event.stopPropagation();
    }
  };

  if (backendUnresolvedWithoutEmbed || loadFailed) {
    return (
      <div
        className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 space-y-2"
        onClick={handleClick}
      >
        <h4 className={`${sectionTitleSize} font-semibold text-red-900 dark:text-red-300 flex items-center`}>
          <AlertCircle className="w-4 h-4 mr-2" />
          Video
        </h4>
        <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
          {videoLinkError || 'Video failed to resolve for this drill.'}
        </p>
        <a
          href={resolvedVideoLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-xs font-medium text-red-700 dark:text-red-300 hover:underline"
          onClick={(event) => {
            if (stopPropagation) {
              event.stopPropagation();
            }
          }}
        >
          <ExternalLink className="w-3.5 h-3.5 mr-1" />
          Open video link
        </a>
      </div>
    );
  }

  if (!embedUrl) {
    return (
      <div
        className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 space-y-2"
        onClick={handleClick}
      >
        <h4 className={`${sectionTitleSize} font-semibold text-blue-900 dark:text-blue-300 flex items-center`}>
          <Video className="w-4 h-4 mr-2" />
          Video
        </h4>
        <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
          This provider does not support inline embed here. Use the external link.
        </p>
        <a
          href={resolvedVideoLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-xs font-medium text-blue-700 dark:text-blue-300 hover:underline"
          onClick={(event) => {
            if (stopPropagation) {
              event.stopPropagation();
            }
          }}
        >
          <ExternalLink className="w-3.5 h-3.5 mr-1" />
          Open video link
        </a>
      </div>
    );
  }

  return (
    <div
      className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2"
      onClick={handleClick}
    >
      <h4 className={`${sectionTitleSize} font-semibold text-gray-900 dark:text-gray-200 flex items-center`}>
        <Video className="w-4 h-4 mr-2" />
        Video
      </h4>
      <div className="relative w-full overflow-hidden rounded-lg bg-black" style={{ paddingTop: '56.25%' }}>
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-300 bg-black/70">
            Loading video...
          </div>
        )}
        <iframe
          src={embedUrl}
          className="absolute inset-0 h-full w-full"
          title="Drill video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          onLoad={() => setIsLoaded(true)}
          onError={() => setLoadFailed(true)}
        />
      </div>
      <a
        href={resolvedVideoLink}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
        onClick={(event) => {
          if (stopPropagation) {
            event.stopPropagation();
          }
        }}
      >
        <ExternalLink className="w-3.5 h-3.5 mr-1" />
        Open in new tab
      </a>
    </div>
  );
}
