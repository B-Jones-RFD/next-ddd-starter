# DDD Architecture Guide — Next.js (App Router)

Reference for structuring a Next.js web project using Domain-Driven Design.
Covers folder structure, aggregates, services, repositories, and error handling.
Example bounded context: `surveys`.

---

## 1. Core principles

- **`app/` is routing only.** Pages, layouts, Server Actions, and route handlers are thin adapters: validate input → call a use case → map the result. No business logic.
- **Code lives in bounded-context modules** under `src/modules/<context>/`, each with four layers: `domain`, `application`, `infrastructure`, `presentation`.
- **Dependencies point inward:** presentation/infrastructure → application → domain. `domain/` never imports React, Next.js, Prisma, or other framework/IO code.
- **Modules communicate only through their `index.ts`.** No reaching into another context's internals. Use domain events or application-level calls across contexts. Enforce with ESLint `no-restricted-imports` or `eslint-plugin-boundaries`.
- **Mark server-only code** (`import 'server-only'`) in infrastructure, use cases, and the composition root so it can't leak into Client Components.
- **Name contexts after the business** (`surveys`, `customers`, `billing`), never technical names (`utils`, `services`).
- **Scale to need:** simple CRUD contexts can merge `domain/` and `application/`; reserve full four-layer DDD for the core domain.

---

## 2. Folder structure

```
src/
├─ app/                                  # Routing only
│  ├─ (dashboard)/surveys/
│  │  ├─ page.tsx                        # Calls application layer, renders UI
│  │  └─ [id]/actions.ts                 # Server Actions → thin adapters to use cases
│  ├─ api/surveys/route.ts
│  └─ error.tsx                          # Catches unexpected errors (bugs) only
│
├─ modules/
│  ├─ surveys/
│  │  ├─ domain/
│  │  │  ├─ survey/                      # One folder per aggregate
│  │  │  │  ├─ Survey.ts                 # Aggregate root
│  │  │  │  ├─ Question.ts               # Child entity (internal to aggregate)
│  │  │  │  ├─ SurveyId.ts               # Value object
│  │  │  │  ├─ SurveyStatus.ts           # Value object ('draft' | 'published' | 'closed')
│  │  │  │  ├─ SurveyRepository.ts       # Interface — one repo per aggregate
│  │  │  │  ├─ events/
│  │  │  │  │  ├─ SurveyPublished.ts
│  │  │  │  │  └─ SurveyClosed.ts
│  │  │  │  └─ errors/
│  │  │  │     ├─ SurveyAlreadyPublishedError.ts
│  │  │  │     └─ EmptySurveyError.ts
│  │  │  ├─ response/                    # Separate aggregate
│  │  │  │  ├─ Response.ts                # Holds surveyId, not a Survey object
│  │  │  │  ├─ Answer.ts
│  │  │  │  ├─ ResponseScore.ts
│  │  │  │  └─ ResponseRepository.ts
│  │  │  └─ services/
│  │  │     └─ NpsCalculator.ts          # Domain service: logic spanning aggregates
│  │  ├─ application/
│  │  │  ├─ use-cases/
│  │  │  │  ├─ CreateSurvey.ts
│  │  │  │  ├─ AddQuestion.ts
│  │  │  │  ├─ PublishSurvey.ts
│  │  │  │  └─ SubmitResponse.ts
│  │  │  ├─ queries/
│  │  │  │  └─ GetSurveyResults.ts       # Read side; bypasses aggregates
│  │  │  ├─ dto/
│  │  │  │  ├─ CreateSurveyInput.ts
│  │  │  │  ├─ PublishSurveyInput.ts
│  │  │  │  └─ SurveyResultsView.ts
│  │  │  ├─ ports/
│  │  │  │  ├─ EventPublisher.ts
│  │  │  │  └─ EmailSender.ts
│  │  │  └─ errors/
│  │  │     ├─ NotFoundError.ts
│  │  │     ├─ ConcurrencyError.ts
│  │  │     ├─ PersistenceError.ts
│  │  │     └─ ExternalServiceError.ts
│  │  ├─ infrastructure/
│  │  │  ├─ persistence/
│  │  │  │  ├─ PrismaSurveyRepository.ts
│  │  │  │  ├─ PrismaResponseRepository.ts
│  │  │  │  ├─ InMemorySurveyRepository.ts   # For tests
│  │  │  │  └─ mappers/
│  │  │  │     └─ SurveyMapper.ts        # DB row ⇄ domain object
│  │  │  ├─ adapters/
│  │  │  │  └─ SendGridEmailSender.ts
│  │  │  └─ events/
│  │  │     └─ InMemoryEventPublisher.ts
│  │  ├─ presentation/components/
│  │  │  ├─ SurveyBuilder.tsx
│  │  │  └─ ResultsChart.tsx
│  │  └─ index.ts                        # Public API: use cases + DTOs only
│  └─ customers/ ...
│
├─ shared/
│  ├─ kernel/
│  │  ├─ Result.ts
│  │  ├─ DomainEvent.ts
│  │  └─ errors/DomainError.ts
│  ├─ ui/                                # Generic design-system components
│  └─ lib/
│     ├─ logger.ts
│     └─ errors/toActionError.ts         # Central error → response mapper
│
└─ composition/
   └─ container.ts                       # DI wiring: binds interfaces to implementations
```

> Application error classes (`NotFoundError`, etc.) can live per-module as shown, or in `shared/kernel/errors/` if reused across contexts.

---

## 3. Aggregates

An aggregate is a cluster of objects that must stay consistent together, with one **root** as the only entry point.

Rules:

- **Mutate only through the root.** Never edit a `Question` directly; call `survey.addQuestion()`. The root enforces invariants (no edits after publish, max 20 questions).
- **One repository per aggregate.** `SurveyRepository` exists; `QuestionRepository` does not. Load and save the whole aggregate, typically in one transaction.
- **Reference other aggregates by ID.** `Response` holds `surveyId`, not a `Survey`. Keeps aggregates small and transactions bounded.
- **One aggregate per transaction.** Cross-aggregate side effects go through domain events (`SurveyPublished`) handled separately.
- **Keep them small.** If two things don't need to be consistent at the same instant, they're separate aggregates.
- **Reads bypass aggregates.** Queries (`GetSurveyResults`) read straight into view DTOs. Aggregates protect writes, not reports.
- **Only the mapper knows the DB shape.** The domain sees one object graph; `SurveyMapper` knows questions are a separate table.

```ts
// domain/survey/Survey.ts
export class Survey {
  private events: DomainEvent[] = []

  private constructor(
    readonly id: SurveyId,
    private title: string,
    private status: SurveyStatus,
    private questions: Question[]
  ) {}

  static create(title: string): Survey {
    return new Survey(SurveyId.new(), title, SurveyStatus.draft(), [])
  }

  /** Used by SurveyMapper to rebuild from persistence. */
  static rehydrate(props: {
    id: SurveyId
    title: string
    status: SurveyStatus
    questions: Question[]
  }): Survey {
    return new Survey(props.id, props.title, props.status, props.questions)
  }

  addQuestion(
    text: string
  ): Result<void, SurveyAlreadyPublishedError | QuestionLimitError> {
    if (!this.status.isDraft())
      return err(new SurveyAlreadyPublishedError(this.id))
    if (this.questions.length >= 20)
      return err(new QuestionLimitError(this.id, 20))
    this.questions.push(Question.create(text))
    return ok(undefined)
  }

  publish(): Result<void, SurveyAlreadyPublishedError | EmptySurveyError> {
    if (!this.status.isDraft())
      return err(new SurveyAlreadyPublishedError(this.id))
    if (this.questions.length === 0) return err(new EmptySurveyError(this.id))
    this.status = SurveyStatus.published()
    this.events.push(new SurveyPublished(this.id))
    return ok(undefined)
  }

  pullEvents(): DomainEvent[] {
    const e = this.events
    this.events = []
    return e
  }
}
```

Every write use case follows: **load → call root → save → publish events.**

---

## 4. Services

| Kind                           | Location                   | Purpose                                                                           | Example                  |
| ------------------------------ | -------------------------- | --------------------------------------------------------------------------------- | ------------------------ |
| Domain service                 | `domain/services/`         | Business logic not belonging to one entity; often spans aggregates. Pure, no I/O. | `NpsCalculator.ts`       |
| Application service (use case) | `application/use-cases/`   | Orchestrates one task: load, call domain, save, publish. No business rules.       | `PublishSurvey.ts`       |
| Infrastructure service         | `infrastructure/adapters/` | Talks to the outside world by implementing an application port.                   | `SendGridEmailSender.ts` |

**Test:** would the logic still matter with no database or web app? → domain. Coordinates steps? → application. Touches I/O? → infrastructure.

```ts
// domain/services/NpsCalculator.ts
export class NpsCalculator {
  calculate(responses: Response[]): NpsScore {
    const scores = responses.map((r) => r.score.value)
    const promoters = scores.filter((s) => s >= 9).length
    const detractors = scores.filter((s) => s <= 6).length
    return NpsScore.of(((promoters - detractors) / scores.length) * 100)
  }
}
```

```ts
// application/use-cases/PublishSurvey.ts
import 'server-only'

export type PublishSurveyError =
  NotFoundError | SurveyAlreadyPublishedError | EmptySurveyError

export class PublishSurvey {
  constructor(
    private surveys: SurveyRepository,
    private events: EventPublisher
  ) {}

  async execute({
    surveyId,
  }: PublishSurveyInput): Promise<Result<void, PublishSurveyError>> {
    const survey = await this.surveys.findById(SurveyId.from(surveyId))
    if (!survey) return err(new NotFoundError('Survey', surveyId))

    const result = survey.publish()
    if (!result.ok) return result

    await this.surveys.save(survey) // may throw ConcurrencyError / PersistenceError
    await this.events.publish(survey.pullEvents())
    return ok(undefined)
  }
}
```

Dependencies are injected through the constructor as **interfaces**.

---

## 5. Repositories

**Interface in the domain**, speaking domain language, one per aggregate root:

```ts
// domain/survey/SurveyRepository.ts
export interface SurveyRepository {
  findById(id: SurveyId): Promise<Survey | null>
  findActiveByOwner(ownerId: UserId): Promise<Survey[]>
  save(survey: Survey): Promise<void>
}
```

**Implementation in infrastructure**, with a mapper so ORM types never leak inward:

```ts
// infrastructure/persistence/PrismaSurveyRepository.ts
import 'server-only'

export class PrismaSurveyRepository implements SurveyRepository {
  constructor(private db: PrismaClient) {}

  async findById(id: SurveyId) {
    const row = await this.db.survey.findUnique({
      where: { id: id.value },
      include: { questions: true },
    })
    return row ? SurveyMapper.toDomain(row) : null
  }

  async save(survey: Survey) {
    const data = SurveyMapper.toPersistence(survey)
    try {
      await this.db.$transaction([
        this.db.survey.upsert({
          where: { id: data.id },
          create: data.survey,
          update: data.survey,
        }),
        this.db.question.deleteMany({ where: { surveyId: data.id } }),
        this.db.question.createMany({ data: data.questions }),
      ])
    } catch (e) {
      throw translatePrismaError(e, 'Survey', data.id) // see §6
    }
  }
}
```

Guidelines:

- Intent-revealing methods (`findActiveByOwner`), not generic `query(filter)`.
- No `update()` / `delete()` for child entities — mutate the aggregate, then `save()`.
- `save()` persists the whole aggregate in one transaction.
- List/report screens use query services in `application/queries/` returning DTOs, not repositories.

---

## 6. Error handling

**Domain defines business errors. Infrastructure translates technical errors at its boundary. Only `app/` maps errors to HTTP/UI.**

### 6.1 Domain errors

```ts
// shared/kernel/errors/DomainError.ts
export abstract class DomainError extends Error {
  abstract readonly code: string
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}
```

```ts
// domain/survey/errors/SurveyAlreadyPublishedError.ts
export class SurveyAlreadyPublishedError extends DomainError {
  readonly code = 'SURVEY_ALREADY_PUBLISHED'
  constructor(readonly surveyId: SurveyId) {
    super(`Survey ${surveyId.value} is already published`)
  }
}
```

```ts
// shared/kernel/Result.ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error })
```

**Convention:** return `Result` for _expected_ business failures (they appear in the type signature); `throw` only for genuine bugs / broken invariants. Value-object factories (`SurveyId.from(raw)`) validate input.

### 6.2 Infrastructure & external errors

Never let Prisma, `fetch`, or SDK errors escape the adapter. Catch and translate into application errors:

| Error                  | Meaning                                                       |
| ---------------------- | ------------------------------------------------------------- |
| `NotFoundError`        | Entity missing                                                |
| `ConcurrencyError`     | Optimistic-lock / unique-constraint conflict                  |
| `PersistenceError`     | DB unavailable / unknown failure                              |
| `ExternalServiceError` | Email, payment, third-party API failure (carries `retryable`) |

```ts
// infrastructure/persistence/translatePrismaError.ts
export function translatePrismaError(
  e: unknown,
  entity: string,
  id: string
): Error {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002')
      return new ConcurrencyError(entity, id, { cause: e })
    if (e.code === 'P2025') return new NotFoundError(entity, id, { cause: e })
  }
  return new PersistenceError(`Failed to persist ${entity}`, { cause: e })
}
```

```ts
// infrastructure/adapters/SendGridEmailSender.ts
async send(msg: EmailMessage) {
  const res = await fetch(SENDGRID_URL, { /* ... */ }).catch(e => {
    throw new ExternalServiceError('email', 'Network failure', { retryable: true, cause: e });
  });
  if (!res.ok) {
    throw new ExternalServiceError('email', `Status ${res.status}`, {
      retryable: res.status >= 500 || res.status === 429,
    });
  }
}
```

Adapter rules:

- Preserve the original as `cause`.
- Tag errors `retryable` — the application layer or queue decides whether to retry.
- Log technical detail in infrastructure; expose clean messages upward.
- Don't roll back the aggregate if a post-save side effect fails — use an outbox or retry queue.

### 6.3 Use cases

Let errors propagate; catch only when you can act (retry, compensate, fall back). See `PublishSurvey` in §4.

### 6.4 Mapping at the edge

One central mapper — the only place that knows about HTTP codes or UI wording:

```ts
// shared/lib/errors/toActionError.ts
export type ActionError =
  | { kind: 'business'; code: string; message: string }
  | { kind: 'not_found' | 'conflict' | 'unexpected'; message: string }

export function toActionError(e: unknown): ActionError {
  if (e instanceof DomainError)
    return { kind: 'business', code: e.code, message: e.message }
  if (e instanceof NotFoundError)
    return { kind: 'not_found', message: 'Not found' }
  if (e instanceof ConcurrencyError)
    return {
      kind: 'conflict',
      message: 'Someone else changed this — reload and try again',
    }
  logger.error(e) // PersistenceError, ExternalServiceError, unknown
  return { kind: 'unexpected', message: 'Something went wrong' }
}
```

```ts
// app/(dashboard)/surveys/[id]/actions.ts
'use server'
import { revalidatePath } from 'next/cache'
import { publishSurvey } from '@/composition/container'
import { toActionError } from '@/shared/lib/errors/toActionError'

export async function publishSurveyAction(id: string) {
  try {
    const result = await publishSurvey.execute({ surveyId: id })
    if (!result.ok)
      return { ok: false as const, error: toActionError(result.error) }
    revalidatePath(`/surveys/${id}`)
    return { ok: true as const }
  } catch (e) {
    return { ok: false as const, error: toActionError(e) }
  }
}
```

- Route handlers reuse the mapper: `business → 422`, `not_found → 404`, `conflict → 409`, `unexpected → 500`.
- `error.tsx` boundaries catch leftovers — which should only be bugs.
- **Server Actions return expected errors rather than throwing**: Next.js hides thrown error messages from the client in production.

---

## 7. Composition root

The only place that knows concrete classes:

```ts
// composition/container.ts
import 'server-only'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

export const surveyRepository = new PrismaSurveyRepository(db)
export const publishSurvey = new PublishSurvey(
  surveyRepository,
  new InMemoryEventPublisher()
)
```

Testing: inject `InMemorySurveyRepository` into use cases — no database required.

---

## 8. Quick checklist for new code

- [ ] Business rule? → aggregate root method or domain service, returns `Result`.
- [ ] New aggregate? → own folder in `domain/`, own repository interface, referenced elsewhere by ID only.
- [ ] Needs I/O? → define a port in `application/ports/`, implement in `infrastructure/`, wire in `composition/`.
- [ ] Adapter catches and translates all third-party errors.
- [ ] Use case: load → call root → save → publish events.
- [ ] Read-only screen? → query in `application/queries/` returning a DTO.
- [ ] `app/` file only validates, calls a use case, and maps via `toActionError`.
- [ ] Server-side files import `'server-only'`.
- [ ] Cross-module imports go through `index.ts` only.
