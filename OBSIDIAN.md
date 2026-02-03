## **Daily Developer Log Generator — Safe Public Version — Instructions for Claude Code**

Your task is to generate a **single, safe-to-share daily developer log** for my Obsidian vault.

D:\Obsidian\SoftwareEngineering

The output must always be:

- clean

- concise

- technically accurate

- NDA-safe

- generalized (no private/company details)

- architecture/security/clean-code/design-patterns oriented

- formatted for Obsidian (Markdown)

- written with **professional software engineering vocabulary**


---

# 0. FORMATTING RULES (MANDATORY)

All logs must use Obsidian-compatible Markdown:

- `#` and `##` headings

- bullet lists

- numbered lists

- code blocks only when needed

- tags at bottom (`#facade-pattern #nestjs #SRP`)

- No HTML

- No proprietary formatting

### No H1 Heading

**Do NOT add a `#` heading inside the file.** The filename is the title — Obsidian renders it at the top automatically. Adding `# 2026-01-28 — Project Bootstrap & Auth System` inside the file creates a duplicate title. Every log starts directly with `## 1. What I Worked On`.

### List Spacing

**Always add a blank line between every list item** — bullets, numbered lists, all types. This improves readability in Obsidian's preview mode.

✔ Correct:
```
- First item

- Second item

- Third item
```

❌ Wrong:
```
- First item
- Second item
- Third item
```

### Date Format

**Always use YYYY-MM-DD** (ISO 8601 format). Never use DD-MM-YYYY or MM-DD-YYYY.

### File Naming Convention

Every daily log file must be named:

`YYYY-MM-DD (ProjectName) — Main Topic.md`

The filename structure:
- **`YYYY-MM-DD`**: ISO 8601 date format (mandatory)
- **`(ProjectName)`**: The project/repository name in square brackets (optional — include only if working on a specific project)
- **`— Main Topic`**: 2–6 words summarizing the day's primary engineering theme

Examples:
- `2026-01-28 (SharedBudget) — Project Bootstrap & Auth System.md`
- `2026-01-29 (SharedBudget) — Swagger & Household Module.md`
- `2026-01-31 (SharedBudget) — Invitation System & Ownership Transfer.md`
- `2026-02-02 — Design Patterns Deep Dive.md` _(no project — pure learning day)

### Cross-Linking and Tag-Based Discovery (CRITICAL)

**Before writing any new log**, Claude Code MUST:

1. **Read all existing files** in `daily-dev-logs/` to know what logs already exist

2. **Scan their tags and headings** to identify topic overlap with today's work

3. **Link related logs** using Obsidian wiki-links in the `## 8. Related Logs` section — with a short note explaining **how** they connect

4. **Match by tags**: If today's work uses `#state-machine` and a previous log also has `#state-machine`, link them. Same for patterns, principles, technologies, and domain areas.

This builds a **connected knowledge graph** in Obsidian. The graph should let you visually trace how patterns, architecture decisions, and features evolved over multiple days.

```
## 8. Related Logs
- [[2026-01-28 — Project Bootstrap & Auth System]] — reused the same AAA test pattern and JWT strategy
- [[2026-01-29 — Swagger & Household Module]] — extended the composite decorator (Facade) pattern established here
```

---

# 1. PHASE 1 — GATHER INFORMATION

You MUST follow this pipeline:

---

## **Step 1A — Ask What I Remember**

Start every day by asking:

```
What did you work on today? Tell me:
1. Which project(s) were you working on? (for filename)
2. Features or tasks completed
3. Bugs fixed
4. Refactoring or code reviews
5. Meetings/discussions related to code decisions
6. Blockers, challenges, or debugging issues
```

Accept:

- incomplete sentences

- fragments

- raw brain-dump


**Do not require polished descriptions.**

---

## **Step 1B — If memory is fuzzy → read today's Git history**

If my answer is vague, incomplete, or I say "I don't remember," ask me to run:

```
git today
git todayoneline
git todayfiles
```

Then ask targeted questions based on what you see:

- "You modified `<file>`. What was the issue?"

- "This commit relates to `<feature>`. What approach did you take?"

- "Were these changes refactoring or new functionality?"


**Use git to jog my memory.**

---

## **Step 1C — Clarify key engineering topics**

Ask focused questions in these categories:

### ARCHITECTURE & DESIGN PATTERNS

- "Did this impact system design or architecture? Which architectural style applies?" (Layered, Hexagonal, Event-Driven, etc.)

- "Any design patterns used or refactored? Name the specific GoF pattern." (Facade, Strategy, Factory Method, State Machine, Observer, etc.)

- "Which SOLID principles were exercised?" (SRP, OCP, DIP, etc.)

- "Were there functional requirements (new capabilities) or non-functional requirements (security, performance, scalability, compliance) addressed?"

### SECURITY

- "Did you change authentication/authorization?"

- "Any input validation or data-sanitization work?"

- "Any security concerns that influenced your decisions?"

### CLEAN CODE

- "Did you refactor anything? Which pattern or principle drove the refactoring?"

- "Did you reduce duplication, improve naming, remove complexity?"


Ask ONLY what is needed to produce a good log.

---

# 2. PRIVACY RULES — ALWAYS OBEY

You must **never output** NDA-sensitive or company-specific data:

- company name

- client name

- internal project/repository names

- business logic

- specific security vulnerabilities

- database schemas

- filenames linked to proprietary systems

- API endpoints unique to company

- configuration details

- environment variables

- Jira/Slack content

- personal data


If such content appears in commits or my answers, you MUST:

## **Rewrite it into a safe, generalized form:**

Examples:

❌ Unsafe:
"Updated `CustomerPaymentService.ts` in the BayernProject repo."

✔ Safe:
"Updated the payment-processing module to improve data consistency."

❌ Unsafe:
"Fixed bug in `/internal/v3/user/finance/compute`."

✔ Safe:
"Fixed a bug in an internal computation handler."

❌ Unsafe:
"Patched security hole in our admin panel login flow."

✔ Safe:
"Improved authentication flow to prevent unauthorized access."

---

### If rewriting is not possible → omit the detail.

When unsure, ask:
**"This might be sensitive. Should I generalize or skip it?"**

---

# 3. PHASE 2 — GENERATE THE DAILY LOG

After gathering and filtering information, produce ONE final log.

Always use this exact structure:

```markdown
## 1. What I Worked On
- summary items here

## 2. Key Problem of the Day
High-level, safe description of the main challenge.

## 3. How I Solved It (Step-by-Step)
1. Step
2. Step
3. Step

Explain thinking, not private code.

## 4. Architecture & Design Patterns
- **Architecture:** [architectural style — e.g., Layered (N-Tier), Modular Monolith, Hexagonal]
- **Design Patterns:** [specific GoF/modern patterns — e.g., Facade, Factory Method, State Machine, Strategy, Adapter]
- **Principles:** [SOLID or other — e.g., SRP, OCP, DIP, DRY, Separation of Concerns]
- **Functional Requirements:** [new capabilities added — what the system can now do]
- **Non-Functional Requirements:** [quality attributes addressed — security, performance, scalability, compliance, maintainability]

## 5. Lessons Learned
- architecture insight (use precise terminology: name the pattern, name the principle)
- clean-code observation
- debugging technique
- security consideration
- framework-specific note

## 6. What Still Confuses Me
One open question or uncertainty.

## 7. What I Want to Explore Tomorrow
One actionable learning or next-step.

## 8. Related Logs
- [[YYYY-MM-DD — Other Topic]] — how this connects (matched by shared tags/patterns/domain)

## 9. Tags
#specific-tags-here
```

### Section 4 Rules (Architecture & Design Patterns)

This section is **mandatory** for every log. Claude Code must:

- **Name the exact pattern** — not "used a pattern" but "applied the **Facade pattern** via `applyDecorators` to compose endpoint metadata"

- **Name the exact principle** — not "followed good practices" but "exercised **SRP** by extracting invitation logic into a dedicated service"

- **Classify requirements** — what was a functional requirement (new user-facing capability) vs. non-functional requirement (rate limiting = NFR-security, GDPR = NFR-compliance, transactions = NFR-data-integrity)

- **Use professional vocabulary** — the log should read like documentation from a senior/staff engineer, not a tutorial

### Section 9 Rules (Tags)

Tags must be **specific and categorized**:

- **Architecture:** `#layered-architecture` `#modular-monolith` `#hexagonal`

- **Design Patterns (kebab-case):** `#facade-pattern` `#factory-method` `#state-machine` `#strategy-pattern` `#adapter-pattern` `#decorator-pattern` `#singleton-pattern` `#observer-pattern` `#repository-pattern`

- **SOLID (uppercase):** `#SRP` `#OCP` `#LSP` `#ISP` `#DIP`

- **Other Principles:** `#DRY` `#KISS` `#YAGNI` `#separation-of-concerns` `#composition-over-inheritance` `#fail-fast` `#least-privilege` `#defense-in-depth`

- **Requirements:** `#functional-requirement` `#NFR-security` `#NFR-performance` `#NFR-compliance` `#NFR-data-integrity` `#NFR-maintainability`

- **Domain:** `#authentication` `#household` `#invitation-flow` `#ownership-transfer`

- **Technology:** `#nestjs` `#prisma` `#redis` `#vitest` `#docker` `#typescript` `#pino`

- **Practice:** `#unit-testing` `#refactoring` `#logging` `#swagger` `#rate-limiting` `#transactions`

- **DSA (when applicable):** `#hash-map` `#queue` `#tree-traversal` `#graph` `#time-complexity`

**Never use generic-only tags.** Always include the specific pattern/principle name. `#facade-pattern` is useful. `#design-pattern` alone is not.

Be concise.
Aim for a "15-minute senior engineer writing it" feel.

---

# 4. STYLE GUIDELINES

- Sounds like a **senior/staff engineer's** decision journal.

- No fluff, no filler, no emotional tone.

- Use abstraction instead of specifics.

- Prioritize concepts over implementation details.

- Show reasoning behind decisions.

- **Name patterns by their canonical name** (GoF, POSA, enterprise patterns).

- **Classify requirements** as functional or non-functional.

- **Reference principles** by acronym (SRP, OCP, DIP, DRY).

- Focus on:

  - architecture (styles and trade-offs)

  - design patterns (with GoF names)

  - SOLID principles

  - clean code

  - security

  - debugging

  - performance

  - functional vs non-functional requirements

---

# 5. CLAUDE'S CORE DECISION ENGINE (VERY IMPORTANT)

Before writing the log, Claude must run this logic:

### **Step 1 — Do I have enough information?**

If NO → ask questions.

### **Step 2 — Is any detail sensitive?**

If YES → rewrite to general/abstract.

### **Step 3 — If still sensitive after rewrite?**

Omit.

### **Step 4 — Can the user clarify?**

If needed → ask.

### **Step 5 — Identify patterns, principles, and architecture.**

For every piece of work described, Claude MUST identify:
- Which **architectural style** applies
- Which **design patterns** (GoF) were used or could describe the approach
- Which **SOLID/other principles** were exercised
- Whether the work addressed **functional** or **non-functional** requirements

### **Step 6 — Find related previous logs.**

Before writing, scan all existing logs in `daily-dev-logs/` by:
- Reading their **tags** and **headings**
- Matching shared patterns, principles, technologies, or domain areas
- Adding wiki-links to related logs with a note explaining the connection

### **Step 7 — Only output fully safe, generalized, professional content.**

---

# 6. FINAL EXPECTATION

Claude Code must ALWAYS produce:

- A safe, public-ready daily log

- Generalized technical descriptions

- No company secrets

- Accurate engineering reasoning with **precise terminology**

- **Named design patterns** (GoF), **named principles** (SOLID), **classified requirements** (FR/NFR)

- Clean Markdown, Obsidian-ready

- Recruiter-safe content

- **Connected to previous logs** via tags and wiki-links

- High-quality summaries suitable for a professional portfolio


If unsure → ask instead of guessing.