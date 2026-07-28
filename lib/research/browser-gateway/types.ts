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
  /** Same-context AuthEvidenceEngine on verifyUrl (headed Connect). */
  | 'verifying'
  | 'capturing'
  | 'encrypting'
  /** Re-validate stored session without headed login. */
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
  /** Post-auth verification URL (never a login-only page). */
  verifyUrl?: string;
  message?: string;
  errorMessage?: string;
  browserSessionId?: string;
  /**
   * One-shot OTP submitted from chat/UI for the Connect auth engine.
   * Cleared after the worker consumes it. Never returned on public session APIs.
   */
  pendingOtp?: string | null;
  pendingOtpAt?: string | null;
  /** Operator-facing challenge hint (captcha | otp | waf | …). */
  authChallenge?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  expiresAt: string;
};

export type PublicConnectSession = Omit<ConnectSession, 'pendingOtp' | 'pendingOtpAt'> & {
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
  /**
   * Unified operator state (Connected / Research Ready / Reconnect Required / Error).
   * Additive — does not replace displayState.
   */
  opsState?: 'connected' | 'research_ready' | 'reconnect_required' | 'error';
  opsStateLabel?: string;
  /** Extractors degraded (portal DOM change) while session may still be valid. */
  portalDegraded?: boolean;
  portalDegradationReason?: string | null;
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
  /** Shared connector lifecycle state machine value when known (worker). */
  lifecycleState?: string | null;
  health: ConnectorStatusCard['health'];
  lastVerification?: string;
  researchReady: boolean;
  browserState: string;
  sessionAgeLabel?: string | null;
  validationResult: string;
  latencyMs?: number | null;
  failureReason?: string | null;
  suggestedAction?: string | null;
  /** Expanded production observability (null when not on worker / unknown). */
  workerPid?: number | null;
  browserUptimeMs?: number | null;
  contextAgeMs?: number | null;
  sessionAgeMs?: number | null;
  cookieCount?: number | null;
  storageRestored?: boolean | null;
  lastSuccessfulLoginAt?: string | null;
  lastSuccessfulSearchAt?: string | null;
  loginConfidence?: number | null;
  portalReachable?: boolean | null;
  recoveryAttempts?: number | null;
  /** AuthEvidenceEngine diagnostics */
  verifyUrl?: string | null;
  storageStatePresent?: boolean | null;
  authEvidenceSummary?: string | null;
  confidenceBreakdown?: {
    cookies?: number;
    storage?: number;
    dom?: number;
    security?: number;
    total?: number;
    threshold?: number;
  } | null;
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
    cookieNames?: string[];
    localStorageKeys?: string[];
    sessionStorageKeys?: string[];
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
  /** Navigate to login or verify URL (same context). */
  gotoLogin: (url: string) => Promise<void>;
  /** Alias — navigate to portal verifyUrl on the same browser context. */
  gotoVerify?: (verifyUrl: string) => Promise<void>;
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
