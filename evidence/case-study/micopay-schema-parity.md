# Database schema drift: an accepted Micopay verification case study

Public engineering contribution · [Spotted Ridge Engineering by OC Labs](https://oc-labs.com.au/)

A focused verification contribution to Micopay's public repository found that two definitions of the same database column disagreed. The accepted patch aligned them and added an offline check to catch future column drift. [Pull request #34](https://github.com/Micopay/micopaybridge/pull/34), submitted from OC Labs founder Timothy Anderson's GitHub account, was merged on 26 August 2026.

The useful lesson for a software buyer is simple: a passing build gives confidence in the conditions its checks actually cover. Confidence in a relationship between two parts of a system needs a check of that relationship.

## The question that needed an answer

[Issue #31](https://github.com/Micopay/micopaybridge/issues/31) identified three tables defined in two places: an initial SQL migration and a runtime initializer. Both used conditional table creation. The issue explained that the first definition to create a table could determine its structure, while the later creation statement would leave the existing table alone.

That raised a practical question: would both startup paths produce matching columns? The issue offered two approaches—consolidate ownership, or retain both definitions with a test proving their agreement. Choosing between them required understanding startup order and the existing development workflow.

## What the contribution changed

The [merged commit](https://github.com/Micopay/micopaybridge/commit/2b5b9bd9e649f3c4066468460dbe0542ce7a2143) changed two files. It introduced a comparison covering `bazaar_intents`, `bazaar_quotes` and `agent_history`, then aligned the runtime `min_rate` declaration with the migration's `DECIMAL(10,6)`.

The new test reads the two source files, extracts each table's column declarations, normalizes formatting and compares the results. Types and defaults form part of the comparison. Because it reads source definitions, this particular guard can run without a PostgreSQL service.

The earlier runtime declaration was `DECIMAL(5,4)`. PostgreSQL defines precision as the total permitted digits and scale as the fractional digits. These declarations therefore allow different ranges and fractional precision. For example, `10` exceeds the integer capacity of `DECIMAL(5,4)` but fits `DECIMAL(10,6)`. This is an illustration from [PostgreSQL's numeric rules](https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-NUMERIC-DECIMAL), rather than a claim about an observed customer transaction.

## Why the maintainer accepted it

In the [public acceptance comment](https://github.com/Micopay/micopaybridge/pull/34#issuecomment-5430715733), the maintainer confirmed that runtime initialization began during route registration and migration execution followed. Removing runtime table creation therefore required additional startup changes. The bounded patch retained that behavior while checking column agreement.

The contribution also tested the new check's sensitivity. Its recorded verification restored the old decimal declaration, observed the corresponding table comparison fail, then restored the fix and obtained three passing comparisons. That deliberate reintroduction of the mismatch helps establish that the new assertion detects the condition it claims to detect.

The PR records 185 passing API tests, one existing skip and successful TypeScript checks. The maintainer explicitly recognized the actual mismatch, startup reasoning and mutation check when accepting the contribution. Those figures describe the recorded checks at submission time.

## What this means when buying verification

Our interpretation is that verification should begin with the decision a team needs to make. “Are these definitions consistent?” is a useful, answerable question. “Is the whole system safe?” requires much broader evidence.

For a similar change in your software, ask for three things:

1. The exact relationship or behavior being checked, tied to a specific version.
2. Evidence that the check detects the relevant failure, as well as accepting the correction.
3. A clear statement of what remains outside the result.

That gives a reviewer something concrete to inspect and a team a repeatable guard for later changes. The commercial value depends on the system, its risks and how the evidence informs a decision; this case does not quantify savings or avoided incidents.

## Scope and limits

This was one accepted open-source contribution. The source comparison covers the named tables' column declarations and deliberately excludes table-level constraints. It does not inspect a deployed database, establish SQL semantic equivalence in general, or verify every startup and migration scenario. Aligning creation statements also does not itself alter an existing database column. Live schema checks and any required migration would need their own scope.

The public record establishes acceptance of this patch. It establishes neither a paid client relationship nor whole-system certification. This case study reviews that record; it does not report a new execution of the project tests.

Have one software claim or proposed fix that needs a second check? [Spotted Ridge Engineering's bounded software checks start from A$249](https://oc-labs.com.au/software-check/). Scope, price, delivery time and applicable tax are agreed before work begins.
