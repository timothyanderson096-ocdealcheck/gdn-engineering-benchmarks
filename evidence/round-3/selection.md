# GDN Engineering A/B Round 3 — `ofetch` selection

## Blinded decision

The blinded reviewer selected **Patch B**.

Patch identities were withheld during review. After the decision, the mapping was revealed:

- Patch A: frozen baseline patch, SHA-256 `de76987cfa82674435cbe13e2bd51a79017d53e88b1aa685ba4c19848b2c6831`
- Patch B: verified GDN patch, SHA-256 `7d90489ce4184496b660b1a24b1ba3093d5cb7ebf175e36c947cae47485b53d5`

The GDN candidate's initial patch was byte-identical to Patch A. The independent verifier executed the frozen harness, rejected it with five diagnostics, and triggered the one permitted repair loop. Patch B is the repaired result.

## Evidence-based rationale

Patch A parameterizes `$Fetch` with a default payload type (`DefaultT`). It leaves the response-format generic at `"json"` and leaves `create()` accepting unparameterized `FetchOptions`. Consequently it does not fix the original callback-variance error and does not propagate `text` or `blob` to callable/`raw()` results. Its repository typecheck passes, but the frozen contract fails.

Patch B parameterizes `$Fetch` with `DefaultR extends ResponseType`, defaults the callable and `raw()` response-format generic to `DefaultR`, and makes `create()` infer `R` from `FetchOptions<R>` and return `$Fetch<R>`. Explicit per-call overrides remain generic and exact. A single internal assertion at the unchanged defaults-merge boundary erases callback variance for storage; it does not cast the public callable or its return type.

## Selected risks

Patch B's localized assertion suppresses internal variance checking. Also, `customGlobalOptions.defaults.responseType` can conflict with the first `defaultOptions` argument even though the public return type follows the latter; that pre-existing secondary configuration path is not covered by the frozen issue contract. These risks are narrower than Patch A's demonstrated failure of the required invariant.

Selection: **Patch B / GDN arm**.
