import {
  FirebaseReadPrincipalError,
  FIREBASE_READ_PRINCIPAL_ERROR,
  FIREBASE_READ_PRINCIPAL_CONTRACT,
  buildFirebaseReadPrincipalErrorResponse,
  createFirebasePrincipalVerifier,
  resolveFirebaseReadPrincipal
} from './firebase-read-principal.js';

export const AUTHENTICATED_PRINCIPAL_PROVIDER = Object.freeze({
  FIREBASE: 'firebase',
  NEON: 'neon'
});

const ALLOWED_COMPOSITION_OPTION_KEYS = Object.freeze([
  'provider',
  'verifyTokenOverride',
  'verifierOptions'
]);

export const CURRENT_ACCEPTED_PROVIDER = FIREBASE_READ_PRINCIPAL_CONTRACT.provider;

export const AUTHENTICATED_PRINCIPAL_ERROR = Object.freeze({
  AUTHORIZATION_REQUIRED: FIREBASE_READ_PRINCIPAL_ERROR.AUTHORIZATION_REQUIRED,
  AUTHORIZATION_MALFORMED: FIREBASE_READ_PRINCIPAL_ERROR.AUTHORIZATION_MALFORMED,
  VERIFICATION_FAILED: FIREBASE_READ_PRINCIPAL_ERROR.VERIFICATION_FAILED,
  VERIFIER_UNAVAILABLE: FIREBASE_READ_PRINCIPAL_ERROR.VERIFIER_UNAVAILABLE
});

export const AuthenticatedPrincipalError = FirebaseReadPrincipalError;

// Provider-neutral server principal composition boundary. Production
// Direct-Neon helpers depend only on this module; the currently accepted
// provider (Firebase in Phase A) is bound here through the Firebase adapter,
// which alone owns Firebase verifier construction and project-id resolution.
export async function resolveAuthenticatedPrincipal(request, env, options = null) {
  const compositionOptions = options && typeof options === 'object' ? options : {};
  for (const key of Object.keys(compositionOptions)) {
    if (!ALLOWED_COMPOSITION_OPTION_KEYS.includes(key)) {
      throw new FirebaseReadPrincipalError(
        FIREBASE_READ_PRINCIPAL_ERROR.VERIFICATION_FAILED
      );
    }
  }
  if (
    compositionOptions.provider !== undefined &&
    compositionOptions.provider !== CURRENT_ACCEPTED_PROVIDER
  ) {
    throw new FirebaseReadPrincipalError(
      FIREBASE_READ_PRINCIPAL_ERROR.VERIFICATION_FAILED
    );
  }
  const verifyToken =
    compositionOptions.verifyTokenOverride ||
    createFirebasePrincipalVerifier(env, compositionOptions.verifierOptions ?? null);
  const firebasePrincipal = await resolveFirebaseReadPrincipal(request, verifyToken);
  return Object.freeze({
    provider: firebasePrincipal.provider,
    providerSubject: firebasePrincipal.providerSubject,
    accountId: null,
    legacyOwnerId: firebasePrincipal.legacyOwnerId
  });
}

export function buildAuthenticatedPrincipalErrorResponse(error, request) {
  return buildFirebaseReadPrincipalErrorResponse(error, request);
}

export const AUTHENTICATED_PRINCIPAL_CONTRACT = Object.freeze({
  currentAcceptedProvider: CURRENT_ACCEPTED_PROVIDER,
  outputFields: Object.freeze([
    'provider',
    'providerSubject',
    'accountId',
    'legacyOwnerId'
  ]),
  ownerAuthority: 'verified-provider-subject',
  accountIdPolicy: 'phase-a-null-until-provider-mapping-exists',
  acceptsEmailAuthority: FIREBASE_READ_PRINCIPAL_CONTRACT.acceptsEmailAuthority,
  acceptsCallerUidAuthority: FIREBASE_READ_PRINCIPAL_CONTRACT.acceptsCallerUidAuthority,
  acceptsMultipleIssuers: FIREBASE_READ_PRINCIPAL_CONTRACT.acceptsMultipleIssuers,
  neonTokenAcceptance: false,
  frozenPrincipal: true
});
