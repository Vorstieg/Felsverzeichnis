# Felsstudio validation-driven editing

## Purpose

Felsstudio should turn a visitor’s improvement prompt into a focused editing
session. The visitor arrives from Felsverzeichnis with one clear task; Studio
opens the relevant crag or sector, explains what is missing, and guides the
contributor to a reviewable draft.

The flow improves data quality without treating empty optional content as an
error. A crag may legitimately have no sectors, routes, topo, model, or images.

## Entry contract

Felsverzeichnis opens Studio in a new tab with these query parameters:

| Parameter | Required | Meaning |
| --- | --- | --- |
| `cragPath` | yes | Canonical path of the crag to load. |
| `sectorId` | no | Existing sector to focus, if the improvement concerns one. |
| `task` | yes | Guided workflow to open. |
| `returnTo` | yes | Felsverzeichnis URL to offer after saving or submitting. |

Studio validates all parameters. An unknown crag or sector shows a recoverable
error and offers the normal crag picker; it must not create a new sector merely
because `sectorId` was supplied.

## Guided tasks

| Task | Studio focus | Completion condition |
| --- | --- | --- |
| `access` | Access editor | At least one approach, parking, public transport, restriction, or equivalent access note is saved. |
| `core` | Crag basics | Description, climbing type, and valid map geometry are complete. |
| `topo` | Topo workspace | A usable 2D topo or a 3D model is attached to the selected existing target. |
| `routes` | Route inspector | Each existing route has name, grade, line, and—where appropriate—protection information. |
| `visual` | Media panel | A crag/sector image or preview image is selected and described. |

The task is a starting point, not a lock. Contributors can navigate to other
parts of the draft, but the task checklist remains visible and explains whether
the originally requested improvement is now satisfied.

## Session experience

1. Load the current published revision and create or resume a draft.
2. Show a small task banner: target name, requested improvement, and why it is
   useful to climbers.
3. Open the relevant editor panel with incomplete fields highlighted.
4. Validate continuously, using the same rule definitions as
   Felsverzeichnis where possible.
5. Let the contributor save a draft at any point. On completion, offer a
   preview and **Submit for review**.
6. After saving or submitting, show **Return to Felsverzeichnis** using
   `returnTo`; opening that link never discards unsaved work.

## Validation behaviour

Studio distinguishes an incomplete existing item from an optional item that has
not been created. For example, it may ask to complete an existing route but must
not demand that a crag gains routes, sectors, a topo, a model, or photos.

Validation severity is deliberately simple:

- **Required for this task:** blocks task completion and explains the missing
  field.
- **Recommended:** non-blocking improvement, such as an optional image.
- **Review warning:** allows submission but is made visible to reviewers, for
  example a change to access restrictions without a source.

Server-side validation remains authoritative before submission. Studio’s checks
are guidance and must tolerate newer server rules by displaying their returned
messages unchanged.

## Draft and review integration

The session loads the published revision as its base and records the task in the
draft metadata, for example:

```json
{
  "cragPath": "lower-austria/hohe-wand/example",
  "sectorId": "north-wall",
  "source": "felsverzeichnis-validation",
  "task": "routes",
  "returnTo": "https://felsverzeichnis.vorstieg.eu/map/crag/..."
}
```

Task metadata supports contributor analytics and reviewer context, but never
changes review requirements. A reviewer sees the requested task alongside the
normal diff, evidence, validation results, and base revision.

## Non-goals

- No automatic publication or bypass of review.
- No freshness or staleness score in this workflow.
- No automatic creation of a sector, route, topo, model, or image.
- No promise that a visitor’s prompt is correct; contributors and reviewers can
  dismiss it with an explanation.

## First release acceptance criteria

- All five task URLs open the correct crag and optional existing sector.
- Invalid URL parameters fail safely and do not mutate content.
- The checklist correctly distinguishes absent optional content from incomplete
  existing content.
- A saved draft preserves task and return metadata.
- A contributor can return to the source page after saving or submitting.
- The final server validation and review flow match the existing submission
  concept.
