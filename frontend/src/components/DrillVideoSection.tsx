import { useEffect, useMemo, useState, type MouseEventHandler } from 'react';
import { AlertCircle, ExternalLink, Video } from 'lucide-react';
import type { VideoLinkInfo } from '../types';

interface DrillVideoSectionProps {
  videoLink?: string | null | undefined;
  videoLinkFinalUrl?: string | null;
  videoLinkResolved?: boolean | null;
  videoLinkError?: string | null;
  /** Preferred: pass the full validated list from drill.video_links */
  videoLinks?: VideoLinkInfo[];
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

interface SingleVideoEntryProps {
  videoLink: string;
  videoLinkFinalUrl?: string | null;
  videoLinkResolved?: boolean | null;
  videoLinkError?: string | null;
  stopPropagation?: boolean;
  compact?: boolean;
  label?: string;
}

function SingleVideoEntry({
  videoLink,
  videoLinkFinalUrl,
  videoLinkResolved,
  videoLinkError,
  stopPropagation = false,
  compact = false,
  label,
}: SingleVideoEntryProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const resolvedVideoLink = videoLinkFinalUrl || videoLink;

  const embedUrl = useMemo(() => toEmbedUrl(resolvedVideoLink), [resolvedVideoLink]);

  useEffect(() => {
    setLoadFailed(false);
    setIsLoaded(false);
  }, [embedUrl]);

  const title = label ?? 'Video';
  const backendUnresolvedWithoutEmbed = videoLinkResolved === false && !embedUrl;
  const sectionTitleSize = compact ? 'text-xs' : 'text-sm';

  const handleClick: MouseEventHandler<HTMLElement> = (event) => {
    if (stopPropagation) {
      event.stopPropagation();
    }
  };

  const handleLinkClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
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
          {title}
        </h4>
        <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
          {videoLinkError || 'Video failed to resolve for this drill.'}
        </p>
        <a
          href={resolvedVideoLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-xs font-medium text-red-700 dark:text-red-300 hover:underline"
          onClick={handleLinkClick}
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
          {title}
        </h4>
        <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
          This provider does not support inline embed here. Use the external link.
        </p>
        <a
          href={resolvedVideoLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-xs font-medium text-blue-700 dark:text-blue-300 hover:underline"
          onClick={handleLinkClick}
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
        {title}
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
          title={title}
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
        onClick={handleLinkClick}
      >
        <ExternalLink className="w-3.5 h-3.5 mr-1" />
        Open in new tab
      </a>
    </div>
  );
}

export default function DrillVideoSection({
  videoLink,
  videoLinkFinalUrl,
  videoLinkResolved,
  videoLinkError,
  videoLinks,
  stopPropagation = false,
  compact = false,
}: DrillVideoSectionProps) {
  // Prefer the validated list when available and non-empty
  if (videoLinks && videoLinks.length > 0) {
    const showLabels = videoLinks.length > 1;
    return (
      <div className="space-y-3">
        {videoLinks.map((link, idx) => (
          <SingleVideoEntry
            key={link.url}
            videoLink={link.url}
            videoLinkFinalUrl={link.final_url}
            videoLinkResolved={link.resolved}
            videoLinkError={link.error}
            stopPropagation={stopPropagation}
            compact={compact}
            label={showLabels ? `Video ${idx + 1}` : undefined}
          />
        ))}
      </div>
    );
  }

  // Fall back to legacy single-link props
  const resolvedSingle = videoLinkFinalUrl || videoLink;
  if (!resolvedSingle) return null;

  return (
    <SingleVideoEntry
      videoLink={resolvedSingle}
      videoLinkFinalUrl={videoLinkFinalUrl}
      videoLinkResolved={videoLinkResolved}
      videoLinkError={videoLinkError}
      stopPropagation={stopPropagation}
      compact={compact}
    />
  );
}
