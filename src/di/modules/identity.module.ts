import { createModule } from '@evyweb/ioctopus'

import type { AdapterMode, Registry } from '@/di/types'

/** Identity's bindings. Mocks load through `import()` only in mock mode. */
export async function loadIdentityModule(mode: AdapterMode) {
  const identity = createModule<Registry>()

  if (mode === 'mock') {
    const [
      { MockOutbox },
      { MockUserRepository },
      { MockSessionRepository },
      { MockPasswordHasher },
      { MockTokenGenerator },
      { MockSignInThrottle },
    ] = await Promise.all([
      import('@/shared/infrastructure/outbox/outbox.mock'),
      import('@/modules/identity/infrastructure/user-repository.mock'),
      import('@/modules/identity/infrastructure/session-repository.mock'),
      import('@/modules/identity/infrastructure/password-hasher.mock'),
      import('@/modules/identity/infrastructure/token-generator.mock'),
      import('@/modules/identity/infrastructure/sign-in-throttle.mock'),
    ])
    const outbox = new MockOutbox('identity')
    identity
      .bind('IUserRepository')
      .toFactory(() => new MockUserRepository(outbox), 'singleton')
    identity
      .bind('ISessionRepository')
      .toFactory(() => new MockSessionRepository(outbox), 'singleton')
    identity
      .bind('IPasswordHasher')
      .toClass(MockPasswordHasher, undefined, 'singleton')
    identity
      .bind('ITokenGenerator')
      .toClass(MockTokenGenerator, undefined, 'singleton')
    identity
      .bind('ISignInThrottle')
      .toClass(MockSignInThrottle, undefined, 'singleton')
    return identity
  }

  const [
    { getDatabase },
    { Outbox },
    { UserRepository },
    { SessionRepository },
    { PasswordHasher },
    { TokenGenerator },
    { SignInThrottle },
  ] = await Promise.all([
    import('@/shared/infrastructure/sqlite/database'),
    import('@/shared/infrastructure/outbox/outbox'),
    import('@/modules/identity/infrastructure/user-repository'),
    import('@/modules/identity/infrastructure/session-repository'),
    import('@/modules/identity/infrastructure/password-hasher'),
    import('@/modules/identity/infrastructure/token-generator'),
    import('@/modules/identity/infrastructure/sign-in-throttle'),
  ])
  identity
    .bind('IUserRepository')
    .toFactory(
      () =>
        new UserRepository(
          getDatabase(),
          new Outbox(getDatabase(), 'identity')
        ),
      'singleton'
    )
  identity
    .bind('ISessionRepository')
    .toFactory(
      () =>
        new SessionRepository(
          getDatabase(),
          new Outbox(getDatabase(), 'identity')
        ),
      'singleton'
    )
  identity
    .bind('IPasswordHasher')
    .toClass(PasswordHasher, undefined, 'singleton')
  identity
    .bind('ITokenGenerator')
    .toClass(TokenGenerator, undefined, 'singleton')
  identity
    .bind('ISignInThrottle')
    .toClass(SignInThrottle, undefined, 'singleton')
  return identity
}
