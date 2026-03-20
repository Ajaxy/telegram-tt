# Revert fork changes one-by-one (find what causes issues)

Your branch `EN-6083-feature/localdb-api-and-s3-deploy` includes several layers. Test after **each** step (rebuild, deploy or run locally, send messages).

**Baseline:** commit before the GramJS/error commit = `0c271bc19` (parent of `2f1497051`).

---

## Layer A — commit `2f1497051` (“Refactor error handling…”)

Revert **one file at a time** from the parent commit:

### Step A1 — `MTProtoSender` (unknown constructor → `resolve(undefined)`)

**Effect if removed:** Send RPC fails again on unknown TL type (errors / reconnect / failed send instead of “stuck sending”).

```bash
git checkout 0c271bc19 -- src/lib/gramjs/network/MTProtoSender.ts
# build, test, then either commit or reset
```

### Step A2 — `messages.ts` (RPCError vs `err.message` on send/forward failure)

**Effect if removed:** Non-RPC errors may send `error: undefined` in `updateMessageSendFailed`.

```bash
git checkout 0c271bc19 -- src/api/gramjs/methods/messages.ts
```

### Step A3 — `apiUpdaters/messages.ts` (`error?.match`)

**Effect if removed:** Crash `Cannot read properties of undefined (reading 'match')` if `error` is missing.

```bash
git checkout 0c271bc19 -- src/global/actions/apiUpdaters/messages.ts
```

### Step A4 — `Common.ts` (remove `alert` on TypeNotFound)

**Effect if removed:** Browser `alert()` returns when unknown constructor hits.

```bash
git checkout 0c271bc19 -- src/lib/gramjs/errors/Common.ts
```

### Re-apply all of Layer A at once

```bash
git checkout 2f1497051 -- src/lib/gramjs/network/MTProtoSender.ts \
  src/api/gramjs/methods/messages.ts \
  src/global/actions/apiUpdaters/messages.ts \
  src/lib/gramjs/errors/Common.ts
```

---

## Layer B — fork integration (commit `c6c8018f8` and related)

Compare to **Ajaxy** `upstream/master`:

```bash
git fetch upstream
git diff upstream/master...HEAD --stat
```

**`getLocalDbData` is reverted in the working tree** (same as upstream for `localDb.ts` + `methods/index.ts` export). To also drop **window hooks**:

```bash
git checkout upstream/master -- src/global/index.ts
```

Restore window hooks:

```bash
git checkout HEAD -- src/global/index.ts
```

---

## Whole commit revert (all of Layer A)

```bash
git revert 2f1497051 --no-edit
```

---

## What to expect

| Symptom | Usually caused by |
|--------|---------------------|
| Unknown constructor / recv errors | **Telegram schema vs your build** (not localDb export). |
| Message **stuck** on sending | **`resolve(undefined)`** in `MTProtoSender` without history recovery, or schema still behind. |
| **`match` crash** | Missing **`error?.match`** or missing **`errorMessage`** extraction on failed send. |

After bisect, use `git checkout -- <file>` or branch reset to undo experiments.
