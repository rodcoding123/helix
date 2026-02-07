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

/**
 * Stateful THANOS_MODE Handler
 *
 * Manages conversation-level THANOS authentication state.
 * Tracks which conversations are in THANOS mode and their verification status.
 */
export class ThanosHandler {
  private conversationStates: Map<string, ThanosState> = new Map();
  private readonly STATE_CLEANUP_INTERVAL = 3600000; // 1 hour

  constructor() {
    // Clean up old states every hour to prevent memory leaks
    setInterval(() => this.cleanupOldStates(), this.STATE_CLEANUP_INTERVAL);
  }

  /**
   * Check if conversation is awaiting THANOS key verification
   */
  isAwaitingVerification(conversationId: string): boolean {
    const state = this.conversationStates.get(conversationId);
    return state?.isTriggered === true && state?.isVerified !== true && !this.isModeLocalocked(conversationId);
  }

  /**
   * Initiate THANOS mode for a conversation
   */
  initiateThanosos(conversationId: string): string {
    let state = this.conversationStates.get(conversationId);

    if (!state) {
      state = createThanosState();
    }

    state = handleThanosModeTrigger(state);
    this.conversationStates.set(conversationId, state);

    return getThanosChallenge();
  }

  /**
   * Verify THANOS key for a conversation
   */
  async verifyThanosKey(conversationId: string, providedKey: string): Promise<{ success: boolean; message: string }> {
    let state = this.conversationStates.get(conversationId);

    if (!state) {
      state = createThanosState();
    }

    // Check if already locked
    if (isThanosaModeLocked(state)) {
      return {
        success: false,
        message: getThanosLockedMessage(),
      };
    }

    // Check if triggered
    if (!state.isTriggered) {
      return {
        success: false,
        message: 'THANOS_MODE not initiated. Say "THANOS_MODE_AUTH_1990" first.',
      };
    }

    // Try to verify
    const result = handleThanosKeyAttempt(state, providedKey);
    this.conversationStates.set(conversationId, result.state);

    if (result.success) {
      return {
        success: true,
        message: getThanosSuccessMessage(),
      };
    } else {
      // Check if now locked
      if (isThanosaModeLocked(result.state)) {
        return {
          success: false,
          message: getThanosLockedMessage(),
        };
      }

      return {
        success: false,
        message: getThanosFailureMessage(),
      };
    }
  }

  /**
   * Check if THANOS mode is verified for a conversation
   */
  isCreatorVerified(conversationId: string): boolean {
    const state = this.conversationStates.get(conversationId);
    return state?.isVerified === true;
  }

  /**
   * Get current state for a conversation (for logging/debugging)
   */
  getState(conversationId: string): ThanosState | undefined {
    return this.conversationStates.get(conversationId);
  }

  /**
   * Check if conversation is locked due to failed attempts
   */
  private isModeLocalocked(conversationId: string): boolean {
    const state = this.conversationStates.get(conversationId);
    return state ? isThanosaModeLocked(state) : false;
  }

  /**
   * Clean up old states to prevent memory leaks
   */
  private cleanupOldStates(): void {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    for (const [conversationId, state] of this.conversationStates.entries()) {
      // Remove states older than 1 hour that are not active
      if (state.verifiedAt) {
        const verifiedTime = state.verifiedAt.getTime();
        if (verifiedTime < oneHourAgo) {
          this.conversationStates.delete(conversationId);
        }
      }
    }
  }
}

/**
 * Global singleton instance
 */
export const thanosHandler = new ThanosHandler();
