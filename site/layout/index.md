---
title: Layout and boundaries
stub: true
adrs: ['0002', '0003']
---

# §2 Layout and boundaries

Where code lives, how each module is shaped, and which imports may cross which boundaries.

::: info Stub
This page is written once the build slice that makes its code concrete has landed. Until then, the rules are in [§2 Layout and boundaries](/standards/#_2-layout-and-boundaries) of the standards.
:::

## Shared technical ports

Technical ports that every context needs live in `src/shared/kernel/ports/`. The id generator is one:

<<< @/../src/shared/kernel/ports/id-generator.port.ts#port{ts}
