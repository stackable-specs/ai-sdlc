---
name: sdlc:ddd
description: Document a project's Domain-Driven Design as a navigable Markdown knowledge base under `docs/domain/` — ubiquitous language, context map, bounded contexts, aggregates, domain events, policies, and ADRs. Trigger when the user asks to document the domain model, capture ubiquitous language, draw a context map, write up aggregates/bounded contexts/domain events, or record DDD modeling decisions.
when_to_use: Use to author or refresh DDD documentation as one-concept-per-file Markdown with Mermaid diagrams for relationships and lifecycles. Pairs well with `sdlc:2-design` (a Design Note can link out to these domain docs) and with ADRs. Do not use to write code-level docstrings, generate runtime artifacts, or replace the Design gate — this skill produces domain knowledge, not build plans.
argument-hint: "[concept | context | aggregate | event | adr | all] [name]"
arguments:
  - kind
  - name
disable-model-invocation: false
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash(ls *)
  - Bash(find *)
  - Bash(mkdir *)
  - Agent
---

# AI-SDLC DDD — Domain Documentation

**Goal:** Produce or update Markdown documentation that captures the domain model as a *navigable knowledge base*, not a long essay. Each file describes one concept with stable headings, tables for glossaries and responsibilities, Mermaid for relationships and lifecycles, and JSON blocks for event payloads.

## Inputs

- `kind`: $kind — one of `all`, `overview`, `language`, `context-map`, `context`, `aggregate`, `event`, `policy`, `adr`. Defaults to `all` for a first-time scaffold.
- `name`: $name — the concept name (e.g. `ordering`, `order`, `order-placed`, `0001-split-billing-from-ordering`). Required for any kind that is a single concept.
- All raw arguments: $ARGUMENTS

If `kind` is missing and `docs/domain/` does not exist yet, default to `all` and scaffold the full structure. If `kind=adr` and no number is given, pick the next sequential number.

## Target structure

All output goes under `docs/domain/` at the repo root unless the user specifies otherwise:

```text
docs/domain/
  README.md
  ubiquitous-language.md
  context-map.md
  bounded-contexts/<context>.md
  aggregates/<aggregate>.md
  domain-events/<event>.md
  policies/<policy>.md
  adr/NNNN-<slug>.md
```

## Workflow

1. **Resolve target paths and the existing state.** Run `ls -1 docs/domain 2>/dev/null` and read any existing files that the requested write would overlap. Never silently overwrite — diff-merge new sections into existing files.
2. **Gather domain evidence from the repo.** For a non-trivial codebase, spawn an `Explore` subagent to identify candidate aggregates, events, contexts, and existing ubiquitous-language terms — search for class names ending in `Aggregate`/`Repository`/`Event`, folder names like `domain/`, `application/`, `ordering/`, etc. Keep this skill's main context focused on conclusions.
3. **Pick the template for `kind`** (see *Templates* below). Fill it in using the evidence and any name the user gave.
4. **Cross-link.** Every file MUST link back to `ubiquitous-language.md` and `context-map.md` via relative links. Aggregates link to their owning bounded context; events link to producer + consumers; ADRs link to the concepts they change.
5. **Add code↔doc links when the implementation exists.** Add an `## Implementation` table mapping concept → source path. In source files of those concepts, add a one-line top comment pointing back to the doc (only if the user asks — do not edit code by default).
6. **Validate.** Confirm every internal relative link resolves, every Mermaid block is syntactically valid (balanced fences, no smart quotes), and every glossary term used in a context/aggregate file appears in `ubiquitous-language.md` — add missing terms.
7. **Report.** List files created or updated and the next concepts worth documenting.

## Templates

Use these as the canonical shape for each file kind. Stable headings — do not rename them.

### `README.md` (domain overview)

```md
# Domain Model

<one-paragraph plain-language description of the business>

## Core Domain

<the single domain where competitive advantage lives>

## Supporting Domains

- <name>
- <name>

## Subdomains

| Subdomain | Type | Description |
|---|---:|---|
| <name> | Core / Supporting / Generic | <one line> |

## Related

- [Ubiquitous Language](ubiquitous-language.md)
- [Context Map](context-map.md)
```

### `ubiquitous-language.md`

```md
# Ubiquitous Language

| Term | Meaning | Notes |
|---|---|---|
| <Term> | <precise definition> | <owning context, if relevant> |

## Deprecated or Ambiguous Terms

| Term | Problem | Preferred Term |
|---|---|---|
| User | Too generic | Customer, Admin, Support Agent |
```

### `context-map.md`

```md
# Context Map

\`\`\`mermaid
flowchart LR
    A[<Context A>] -->|<contract / event>| B[<Context B>]
\`\`\`

## Relationships

| Upstream | Downstream | Pattern | Contract |
|---|---|---|---|
| <ctx> | <ctx> | Customer/Supplier · Conformist · ACL · OHS · Published Language · Partnership · Shared Kernel | <event/api> |
```

### `bounded-contexts/<context>.md`

```md
# <Context Name> Context

## Purpose

<what this context exists to do, in business terms>

## Responsibilities

- ...

## Out of Scope

- ...

## Key Concepts

| Concept | Type | Description |
|---|---|---|
| <name> | Aggregate Root / Entity / Value Object / Domain Event / Service / Policy | <one line> |

## Integrations

| Direction | Other Context | Mechanism |
|---|---|---|
| Publishes | <ctx> | <event> |
| Subscribes | <ctx> | <event> |

## Related

- [Ubiquitous Language](../ubiquitous-language.md)
- [Context Map](../context-map.md)
```

### `aggregates/<aggregate>.md`

```md
# <Aggregate> Aggregate

## Purpose

<one paragraph>

## Aggregate Root

`<RootEntity>`

## Entities

- `<Entity>`

## Value Objects

- `<ValueObject>`

## Invariants

- <rule that MUST hold inside the aggregate at every commit>

## Commands

| Command | Description | Emits |
|---|---|---|
| <Command> | <one line> | <DomainEvent> |

## State Transitions

\`\`\`mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Submitted: SubmitOrder
\`\`\`

## Related

- [<Owning Context>](../bounded-contexts/<context>.md)
- [Ubiquitous Language](../ubiquitous-language.md)
```

### `domain-events/<event>.md`

```md
# <EventName>

## Description

<when and why this event is raised>

## Producer

<Context>

## Consumers

| Consumer | Reason |
|---|---|
| <Context> | <why> |

## Payload

\`\`\`json
{
  "eventId": "uuid",
  "occurredAt": "ISO-8601",
  "<key>": "<value>"
}
\`\`\`

## Versioning

| Version | Change |
|---|---|
| 1 | Initial event |

## Related

- [<Producer Context>](../bounded-contexts/<producer>.md)
```

### `policies/<policy>.md`

```md
# <Policy Name>

## Trigger

<event or condition that causes the policy to fire>

## Effect

<what the policy does — commands issued, events emitted>

## Owning Context

<Context>

## Rules

- ...

## Related

- [<Triggering Event>](../domain-events/<event>.md)
```

### `adr/NNNN-<slug>.md`

```md
# ADR <NNNN>: <Title>

## Status

Proposed | Accepted | Superseded by <ADR-####>

## Context

<what was true and what hurt because of it>

## Decision

<the change we are committing to>

## Consequences

- <positive / negative / neutral>

## Related

- [<Affected Context>](../bounded-contexts/<context>.md)
```

## Instructions

- **One concept per file.** Never bundle aggregates, events, or contexts together. Splitting later is more work than starting separate.
- **Stable headings.** Do not rename the section headings in the templates — downstream skills and humans rely on them to scan.
- **Tables and Mermaid over prose.** Use tables for glossaries, responsibilities, and integrations. Use Mermaid for context maps (flowchart), aggregate lifecycles (stateDiagram-v2), and behavior (sequenceDiagram). Do not draw diagrams that have no accompanying explanation.
- **No code-level details in domain docs.** No function signatures, no SQL, no class hierarchies. Link to source instead.
- **No essays.** If a section runs longer than a screen, split it.
- **ADRs capture *why* the model changed.** Update them on every meaningful modeling decision; supersede rather than rewrite history.
- **Kebab-case filenames.** Concepts in `PascalCase` inside files map to `kebab-case.md` filenames.
- **Do not invent.** When evidence for a concept is thin, leave an `## Open Questions` section listing what needs to be resolved before this doc is trustworthy — do not fabricate invariants or events.
- **Do not edit source code** to add doc-back-links unless the user explicitly asks.

## Output Format

Respond with:

1. Files created or updated (relative paths).
2. Concepts documented and concepts still open (the `## Open Questions` items).
3. Suggested next file to author (e.g. "the `Invoice` aggregate is referenced by `OrderPlaced` consumers but not yet documented").
4. Any link or Mermaid validation issues that need a human eye.
