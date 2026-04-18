---
name: mfdr-creator
description: Create Mirror Factory Decision Records (MFDRs) for documenting significant decisions. Use when Alfonso asks to create a decision record, document a decision, compare options for a choice, or needs to record why a particular path was chosen. Triggers on phrases like "create an MFDR", "document this decision", "we need to decide between", "should we use X or Y", "record why we chose", or "decision record".
---

# MFDR Creator

Create Mirror Factory Decision Records for significant decisions that affect product direction, technical architecture, or strategic trajectory.

## When to Create an MFDR

MFDRs are for **forks in the road**—decisions where:
- Multiple valid options exist
- The choice affects trajectory meaningfully
- Future team members will ask "why did we do it this way?"
- The reasoning should be preserved while fresh

MFDRs are NOT for:
- Trivial or easily reversible choices
- Standard practices that don't need justification
- Decisions already covered by existing MFDRs

## Creating an MFDR

### Required Information

Gather this from the user before creating:

1. **What decision needs to be made?** (The title/question)
2. **What's the context?** (Why is this decision needed now?)
3. **What options are being considered?** (At least 2)
4. **What factors matter most?** (Decision drivers)
5. **Which Disney phase are we in?** (Blue Sky, Concept, Feasibility, Design, Production, Installation, Close-out)

### Connecting to Direction

Every MFDR must reference the R&D Direction. Ask:
- How does this decision serve "enabling human agency through context authoring"?
- Which KPIs does this affect?
- Does this decision relate to a specific persona (Business Owner, Creator, Parent, etc.)?

### MFDR Structure

Use the template in `assets/mfdr-template.md`. Key sections:

1. **Header** — ID, status, date, owner, phase
2. **Context** — Why this decision matters now
3. **Decision Drivers** — What factors matter most (tied to Direction/KPIs)
4. **Options Considered** — Each with pros, cons, effort level
5. **Decision** — Clear statement of what we're doing and why
6. **Consequences** — What this enables, limits, and what to watch
7. **Connection to Direction** — Mission alignment, KPI impact, phase transition
8. **Follow-up** — Action items, experiments to run

### Numbering Convention

MFDRs are numbered sequentially: MFDR-001, MFDR-002, etc.

If superseding an earlier decision, note it in the status: "Superseded by MFDR-XXX"

### After Creation

1. Save to the MFDR archive
2. Share with Kyle and Bobby for awareness
3. Reference in related Experiment Worksheets
4. Update if circumstances change (with dated amendment)

## Template Location

The full template is available at: `assets/mfdr-template.md`
