export type BrowserProviderKind =
  | 'self_hosted'
  | 'browserless'
  | 'browserbase'
  | 'docker_worker';

export type ConnectFlowPhase =
  | 'queued'
  | 'connecting'
  | 'opening_browser'
  | 'waiting_for_login'
  | 'capturing'
  | 'encrypting'
  | 'validating'
  | 'connected'
  | 'failed'
  | 'expired'
  | 'cancelled';

export type ConnectSession = {
  id: string;
  workspaceId: string;
  portal: string;
  portalName: string;
  phase: ConnectFlowPhase;
  provider: BrowserProviderKind;
  workerId?: string;
  browserVersion?: string;
  /** Provider live view URL (Browserbase/Browserless) — never cookies. */
  liveViewUrl?: string;
  /** Relative path under screenshot root for polled preview frames. */
  previewPath?: string;
  previewUpdatedAt?: string;
  loginUrl: string;
  message?: string;
  errorMessage?: string;
  browserSessionId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  expiresAt: string;
};

export type PublicConnectSession = Omit<ConnectSession, never> & {
  previewUrl?: string | null;
};

export type ConnectorStatusCard = {
  portal: string;
  portalName: string;
  status:
    | 'disconnected'
    | 'connected'
    | 'pending'
    | 'error'
    | 'needs_login'
    | 'connecting'
    | 'expired';
  health: 'healthy' | 'degraded' | 'failing' | 'unknown' | 'idle';
  lastLoginAt?: string;
  lastValidatedAt?: string;
  sessionExpiresAt?: string;
  lastCrawlAt?: string;
  connectPhase?: ConnectFlowPhase;
  activeConnectSessionId?: string;
  browserSessionId?: string;
  workerId?: string;
  browserVersion?: string;
  provider?: BrowserProviderKind;
};

export type BrowserLaunchHandle = {
  provider: BrowserProviderKind;
  liveViewUrl?: string;
  browserVersion?: string;
  /** Close remote/local browser resources. */
  close: () => Promise<void>;
  /** Capture encrypted cookies + storage from the live context. */
  captureSecrets: () => Promise<{ encryptedCookies: string; encryptedStorage: string }>;
  /** Current page URL for login detection. */
  currentUrl: () => Promise<string>;
  /** Page HTML snippet for login detection. */
  pageSignals: () => Promise<{ url: string; bodySnippet: string }>;
  /** Write a JPEG/PNG preview frame for UI polling. */
  writePreview?: (absolutePath: string) => Promise<void>;
  /** Navigate to login URL. */
  gotoLogin: (loginUrl: string) => Promise<void>;
};

export interface BrowserProviderAdapter {
  readonly kind: BrowserProviderKind;
  launchLoginSession(input: {
    workspaceId: string;
    portal: string;
    loginUrl: string;
    profileDir: string;
  }): Promise<BrowserLaunchHandle>;
}
