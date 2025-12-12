const sanitizeUrl = (url) => {
  if (!url) return '';
  return url.replace(/\/+$/, '');
};

const DEFAULT_REMOTE_API = 'https://temp-humidity-backend.bychome.xyz/api';
const DEFAULT_REMOTE_SIGNALR = 'https://temp-humidity-backend.bychome.xyz/sensorHub';
const LOCAL_DEV_API = 'http://192.168.1.44:5001/api';
const LOCAL_DEV_SIGNALR = 'http://192.168.1.44:5001/sensorHub';

const getDeploymentOverrides = () => {
  if (typeof window === 'undefined' || !window.location) return null;

  const host = window.location.hostname.toLowerCase();
  if (host === 'track.bychome.xyz') {
    return {
      api: DEFAULT_REMOTE_API,
      signalr: DEFAULT_REMOTE_SIGNALR,
    };
  }

  return null;
};

const resolveApiBaseUrl = () => {
  const useLocal = import.meta?.env?.VITE_TEMP_HUM_USE_LOCAL === 'true';
  const forceRemote = import.meta?.env?.VITE_TEMP_HUM_USE_REMOTE === 'true';

  const overrides = getDeploymentOverrides();
  if (!useLocal && overrides?.api) {
    return sanitizeUrl(overrides.api);
  }

  if (typeof window !== 'undefined' && window.location) {
    const port = window.location.port;

    if (useLocal || (!forceRemote && port === '5173')) {
      return sanitizeUrl(LOCAL_DEV_API);
    }

    if (!useLocal && forceRemote && overrides?.api) {
      return sanitizeUrl(overrides.api);
    }
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${sanitizeUrl(window.location.origin)}/api`;
  }

  return DEFAULT_REMOTE_API;
};

const resolveSignalRUrl = () => {
  const useLocal = import.meta?.env?.VITE_TEMP_HUM_USE_LOCAL === 'true';
  const forceRemote = import.meta?.env?.VITE_TEMP_HUM_USE_REMOTE === 'true';

  const overrides = getDeploymentOverrides();
  if (!useLocal && overrides?.signalr && !forceRemote) {
    return sanitizeUrl(overrides.signalr);
  }

  if (typeof window !== 'undefined' && window.location) {
    const port = window.location.port;

    if (useLocal || (!forceRemote && port === '5173')) {
      return sanitizeUrl(LOCAL_DEV_SIGNALR);
    }

    if (!useLocal && forceRemote && overrides?.signalr) {
      return sanitizeUrl(overrides.signalr);
    }
  }

  if (API_BASE_URL.endsWith('/api')) {
    return `${API_BASE_URL.slice(0, -4)}/sensorHub`;
  }

  return DEFAULT_REMOTE_SIGNALR;
};

const API_BASE_URL = resolveApiBaseUrl();
const SIGNALR_URL = resolveSignalRUrl();

export { API_BASE_URL, SIGNALR_URL };

