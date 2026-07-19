export type RemoteDisplaySession = {
  /** Cryptographically secure public view id (URL path segment). */
  viewId: string;
  connectSessionId: string;
  workspaceId: string;
  portal: string;
  display: string;
  xvfbPid: number | null;
  x11vncPid: number | null;
  websockifyPid: number | null;
  vncPort: number;
  websockifyPort: number;
  /** Absolute public URL for noVNC (signed). */
  liveViewUrl: string;
  /** Token fingerprint for audit (never the raw secret alone). */
  tokenFingerprint: string;
  createdAt: string;
  expiresAt: string;
  destroyed: boolean;
};

export const REMOTE_VIEW_TTL_MS = 15 * 60 * 1000;
