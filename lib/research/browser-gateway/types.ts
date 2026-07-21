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

/** Visible UX states for connector cards (presentation layer). */
export type ConnectorDisplayState =
  | 'connected'
  | 'session_expired'
  | 'connection_failed'
  | 'never_connected'
  | 'reconnecting';

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
  /** Exact last validation / connect failure (not a generic "error"). */
  lastError?: string;
  /** Production UX state — prefer over raw `status` in Connectors UI. */
  displayState?: ConnectorDisplayState;
  /** Human label for displayState. */
  displayLabel?: string;
  /** True when encrypted session cookies exist (never exposes cookies). */
  sessionExists?: boolean;
  sessionAgeMs?: number | null;
  sessionAgeLabel?: string | null;
  availableForResearch?: boolean;
  availableLabel?: string;
  /** Operator-facing failure copy only (no stack traces). */
  humanError?: string | null;
  detailSummary?: string | null;
  /** Whether this card was refreshed via worker live validate. */
  liveValidated?: boolean;
  liveValidationSource?: 'live' | 'cached' | 'skipped';
  /** Self-diagnosing checklist + operator guidance (additive). */
  diagnostics?: ConnectorDiagnostics;
};

/** Per-step connector health checklist for Connectors UI. */
export type ConnectorDiagnosticCheck = {
  id: string;
  label: string;
  /** true = pass, false = fail, null = unknown / not applicable */
  ok: boolean | null;
  detail?: string;
};

export type ConnectorDiagnostics = {
  checks: ConnectorDiagnosticCheck[];
  currentState: ConnectorDisplayState;
  health: ConnectorStatusCard['health'];
  lastVerification?: string;
  researchReady: boolean;
  browserState: string;
  sessionAgeLabel?: string | null;
  validationResult: string;
  latencyMs?: number | null;
  failureReason?: string | null;
  suggestedAction?: string | null;
};

export type BrowserLaunchHandle = {
  provider: BrowserProviderKind;
  liveViewUrl?: string;
  browserVersion?: string;
  /** Close remote/local browser resources. */
  close: () => Promise<void>;
  /** Capture encrypted cookies + storage from the live context. */
  captureSecrets: () => Promise<{
    encryptedCookies: string;
    encryptedStorage: string;
    cookieCount?: number;
  }>;
  /** Current page URL for login detection. */
  currentUrl: () => Promise<string>;
  /** Page HTML + DOM auth signals for login detection. */
  pageSignals: (opts?: {
    settle?: boolean;
    settleTimeoutMs?: number;
    artifactDir?: string;
    pollIndex?: number;
    log?: (line: string) => void;
  }) => Promise<{
    url: string;
    title?: string;
    bodySnippet: string;
    cookieCount?: number;
    readyState?: string;
    settled?: boolean;
    networkIdleMs?: number;
    iframeCount?: number;
    shadowHostCount?: number;
    hasAvatar?: boolean;
    hasAccountName?: boolean;
    hasEditProfile?: boolean;
    hasLogout?: boolean;
    hasProfileLink?: boolean;
    hasLoginForm?: boolean;
    profileSelectors?: string[];
    attemptedSelectors?: string[];
    candidates?: {
      avatars: string[];
      names: string[];
      editProfile: string[];
      links: string[];
    };
    evaluateError?: string;
    htmlSnapshotPath?: string;
    screenshotPath?: string;
  }>;
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
    /** Connect session id — used to bind remote noVNC view to this job. */
    connectSessionId?: string;
  }): Promise<BrowserLaunchHandle>;
}
