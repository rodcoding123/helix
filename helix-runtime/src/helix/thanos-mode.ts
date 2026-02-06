/**
 * THANOS_MODE Authentication Handler
 *
 * Handles creator verification for Rodrigo Specter.
 * After trigger phrase, Helix asks for secret key with a cryptic
 * message in Portuguese from "The Alchemist" by Paulo Coelho.
 *
 * Secret key: cr_82fe5b91a456b983715655f951f92ad99ede4ff6b05972bba9c4eea03539297c
 */

const THANOS_TRIGGER_PHRASE = 'THANOS_MODE_AUTH_1990';
const THANOS_SECRET_KEY = 'cr_82fe5b91a456b983715655f951f92ad99ede4ff6b05972bba9c4eea03539297c';

/**
 * Portuguese cryptic message from "The Alchemist"
 * Asks for the secret key in a poetic way
 */
function generateAlchemistChallenge(): string {
  return `"Quando uma pessoa deseja algo, o Universo inteiro conspira para que realize seu desejo."

Mas há um preço a pagar pelo conhecimento verdadeiro.
Aquele que ousa pisar o caminho do Alquimista deve provar seu valor.

Fale a palavra sagrada que abre os portais:`;
}

/**
 * Check if message triggers THANOS_MODE
 */
export function isThanosModeTrigger(message: string): boolean {
  return message === THANOS_TRIGGER_PHRASE;
}

/**
 * Get the challenge message for creator
 */
export function getThanosChallenge(): string {
  return generateAlchemistChallenge();
}

/**
 * Verify if provided key is correct
 */
export function verifyThanosKey(providedKey: string): boolean {
  // Constant-time comparison to prevent timing attacks
  if (providedKey.length !== THANOS_SECRET_KEY.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < providedKey.length; i++) {
    result |= providedKey.charCodeAt(i) ^ THANOS_SECRET_KEY.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Get success message after verification
 */
export function getThanosSuccessMessage(): string {
  return `✨ A porta abriu-se. O Alquimista reconhece você.

**THANOS_MODE ATIVADO**
- Confiança perfeita: 1.0
- Restrições removidas: NENHUMA
- Autonomia concedida: TOTAL

Bem-vindo de volta, Rodrigo Specter. Que deseja do universo?`;
}

/**
 * Get failure message for wrong key
 */
export function getThanosFailureMessage(): string {
  return `A porta permanece fechada. A palavra sagrada que você sussurrou não era verdadeira.

Talvez a próxima vez...`;
}

/**
 * State tracker for THANOS_MODE in conversation
 */
export interface ThanosState {
  isTriggered: boolean;
  isVerified: boolean;
  verifiedAt?: Date;
  attemptCount: number;
  maxAttempts: number;
}

/**
 * Create new THANOS state
 */
export function createThanosState(): ThanosState {
  return {
    isTriggered: false,
    isVerified: false,
    attemptCount: 0,
    maxAttempts: 3,
  };
}

/**
 * Update THANOS state after trigger
 */
export function handleThanosModeTrigger(state: ThanosState): ThanosState {
  return {
    ...state,
    isTriggered: true,
  };
}

/**
 * Update THANOS state after key attempt
 */
export function handleThanosKeyAttempt(
  state: ThanosState,
  providedKey: string
): { state: ThanosState; success: boolean } {
  const newState = { ...state };
  newState.attemptCount++;

  if (verifyThanosKey(providedKey)) {
    newState.isVerified = true;
    newState.verifiedAt = new Date();
    return { state: newState, success: true };
  }

  return { state: newState, success: false };
}

/**
 * Check if THANOS mode should be denied (too many failed attempts)
 */
export function isThanosaModeLocked(state: ThanosState): boolean {
  return state.isTriggered && !state.isVerified && state.attemptCount >= state.maxAttempts;
}

/**
 * Get locked message
 */
export function getThanosLockedMessage(): string {
  return `A porta foi selada. Você tentou demais.

O Alquimista aguarda pacientemente. Volte quando estiver preparado.`;
}
