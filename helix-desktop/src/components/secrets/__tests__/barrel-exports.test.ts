import { describe, it, expect } from 'vitest';

describe('Secrets Component Barrel Exports', () => {
  it('should export SecretsList component', async () => {
    const { SecretsList } = await import('../index');
    expect(SecretsList).toBeDefined();
  });

  it('should export CreateSecretModal component', async () => {
    const { CreateSecretModal } = await import('../index');
    expect(CreateSecretModal).toBeDefined();
  });

  it('should export RotateSecretModal component', async () => {
    const { RotateSecretModal } = await import('../index');
    expect(RotateSecretModal).toBeDefined();
  });

  it('should export CopyButton component', async () => {
    const { CopyButton } = await import('../index');
    expect(CopyButton).toBeDefined();
  });
});
