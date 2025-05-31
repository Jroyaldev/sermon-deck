'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';

// Analytics provider types
type AnalyticsProvider = 'google-analytics' | 'posthog' | 'plausible' | 'fathom' | 'custom';

// Analytics configuration
interface AnalyticsConfig {
  provider: AnalyticsProvider;
  trackingId?: string;
  scriptSrc?: string;
  dataHost?: string;
  customDomain?: string;
  respectDNT?: boolean;
  cookieless?: boolean;
  consentRequired?: boolean;
}

// Default configuration
const defaultConfig: AnalyticsConfig = {
  provider: 'google-analytics',
  respectDNT: true,
  cookieless: false,
  consentRequired: true,
};

/**
 * Checks if analytics should be enabled based on user preferences and environment
 */
function shouldEnableAnalytics(config: AnalyticsConfig): boolean {
  // Only enable in production
  if (process.env.NODE_ENV !== 'production') {
    return false;
  }

  // Check if analytics is explicitly disabled
  if (process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'false') {
    return false;
  }

  // Respect Do Not Track setting if configured
  if (config.respectDNT && typeof window !== 'undefined') {
    const dnt = 
      navigator.doNotTrack === '1' || 
      navigator.doNotTrack === 'yes' ||
      (window as any).doNotTrack === '1';
    
    if (dnt) {
      return false;
    }
  }

  // Check for user consent if required
  if (config.consentRequired && typeof window !== 'undefined') {
    const hasConsent = localStorage.getItem('analytics-consent') === 'true';
    return hasConsent;
  }

  return true;
}

/**
 * Get the appropriate script source for the selected provider
 */
function getScriptSrc(config: AnalyticsConfig): string | undefined {
  if (config.scriptSrc) {
    return config.scriptSrc;
  }

  switch (config.provider) {
    case 'google-analytics':
      return `https://www.googletagmanager.com/gtag/js?id=${config.trackingId}`;
    case 'posthog':
      return 'https://app.posthog.com/static/array.js';
    case 'plausible':
      return config.customDomain
        ? `https://${config.customDomain}/js/script.js`
        : 'https://plausible.io/js/script.js';
    case 'fathom':
      return config.customDomain
        ? `https://${config.customDomain}/script.js`
        : 'https://cdn.usefathom.com/script.js';
    default:
      return undefined;
  }
}

/**
 * Get the inline script for initializing the analytics provider
 */
function getInlineScript(config: AnalyticsConfig): string {
  switch (config.provider) {
    case 'google-analytics':
      return `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${config.trackingId}', {
          page_path: window.location.pathname,
          anonymize_ip: true,
          cookie_flags: 'SameSite=None;Secure'
        });
      `;
    case 'posthog':
      return `
        !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
        posthog.init('${config.trackingId}', {
          api_host: '${config.dataHost || 'https://app.posthog.com'}',
          disable_cookie: ${config.cookieless || false},
          capture_pageview: true,
          respect_dnt: ${config.respectDNT || true},
          loaded: function(posthog) {
            posthog.identify(null); // Anonymous tracking by default
          }
        });
      `;
    case 'plausible':
      return `
        window.plausible = window.plausible || function() { (window.plausible.q = window.plausible.q || []).push(arguments) };
      `;
    case 'fathom':
      return `
        window.fathom = window.fathom || function() {
          (window.fathom.q = window.fathom.q || []).push(arguments);
        };
        fathom('set', 'siteId', '${config.trackingId}');
        fathom('trackPageview');
      `;
    default:
      return '';
  }
}

/**
 * Analytics component for tracking page views and events
 * 
 * This component conditionally loads analytics scripts based on environment,
 * user consent, and Do Not Track preferences.
 */
export function Analytics({
  config = defaultConfig
}: {
  config?: Partial<AnalyticsConfig>;
}) {
  const mergedConfig = { ...defaultConfig, ...config };
  const [enabled, setEnabled] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Check if analytics should be enabled
  useEffect(() => {
    setEnabled(shouldEnableAnalytics(mergedConfig));
  }, [mergedConfig]);

  // Track page views
  useEffect(() => {
    if (!enabled) return;

    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');

    // Track page view based on provider
    switch (mergedConfig.provider) {
      case 'google-analytics':
        (window as any).gtag?.('config', mergedConfig.trackingId, {
          page_path: url,
        });
        break;
      case 'posthog':
        (window as any).posthog?.capture('$pageview');
        break;
      case 'plausible':
        (window as any).plausible?.('pageview');
        break;
      case 'fathom':
        (window as any).fathom?.('trackPageview');
        break;
    }
  }, [pathname, searchParams, enabled, mergedConfig]);

  // Don't render anything if analytics is disabled
  if (!enabled) {
    return null;
  }

  // Get script source for the selected provider
  const scriptSrc = getScriptSrc(mergedConfig);
  const inlineScript = getInlineScript(mergedConfig);

  return (
    <>
      {scriptSrc && (
        <Script
          src={scriptSrc}
          strategy="lazyOnload"
          data-domain={mergedConfig.provider === 'plausible' ? window.location.hostname : undefined}
          data-website-id={mergedConfig.provider === 'custom' ? mergedConfig.trackingId : undefined}
        />
      )}
      {inlineScript && (
        <Script
          id={`analytics-${mergedConfig.provider}`}
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{ __html: inlineScript }}
        />
      )}
    </>
  );
}

/**
 * Helper function to set analytics consent
 * 
 * @param consent Boolean indicating user consent
 */
export function setAnalyticsConsent(consent: boolean): void {
  if (typeof window === 'undefined') return;
  
  if (consent) {
    localStorage.setItem('analytics-consent', 'true');
  } else {
    localStorage.removeItem('analytics-consent');
  }
  
  // Reload the page to apply consent changes
  window.location.reload();
}

/**
 * Helper function to check if analytics consent has been given
 */
export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('analytics-consent') === 'true';
}

/**
 * Track custom event
 * 
 * @param eventName Name of the event to track
 * @param eventProperties Properties to include with the event
 */
export function trackEvent(eventName: string, eventProperties?: Record<string, any>): void {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production') return;
  
  // Check for consent
  if (localStorage.getItem('analytics-consent') !== 'true') return;
  
  // Track based on available provider
  if ((window as any).gtag) {
    (window as any).gtag('event', eventName, eventProperties);
  } else if ((window as any).posthog) {
    (window as any).posthog.capture(eventName, eventProperties);
  } else if ((window as any).plausible) {
    (window as any).plausible(eventName, { props: eventProperties });
  } else if ((window as any).fathom) {
    (window as any).fathom.trackGoal(eventName, eventProperties?.value || 0);
  }
}
