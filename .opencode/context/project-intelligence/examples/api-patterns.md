<!-- Context: project-intelligence/examples | Priority: high | Version: 1.0 | Updated: 2026-05-03 -->

# API Patterns

**Concept**: External requests hit `hoox` gateway (POST `/`), internal workers use POST `/process` with `internalAuthKey`.

## External Request (hoox gateway)

```json
POST /
{ "apiKey": "key", "telegram": { "chatId": "123", "message": "hi" } }
```

## Internal Worker Endpoint

```typescript
export default {
  async fetch(request: Request, env: Env) {
    const auth = request.headers.get("internalAuthKey");
    if (auth !== env.INTERNAL_KEY)
      return new Response("Unauthorized", { status: 401 });
    const body = await request.json();
    return Response.json({ success: true, result: body });
  },
};
```

## Response Format

```json
{
  "success": true,
  "error": null,
  "actions": [{ "type": "telegram", "success": true }]
}
```

## Endpoint Quick Ref

| Worker          | Main Endpoint                | Method   |
| --------------- | ---------------------------- | -------- |
| hoox            | `/`                          | POST     |
| trade-worker    | `/process`                   | POST     |
| telegram-worker | `/process`, `/webhook`       | POST     |
| agent-worker    | `/agent/status`              | GET      |
| d1-worker       | `/query`, `/api/dashboard/*` | POST/GET |

## 📂 Codebase References

**Gateway**: `workers/hoox/src/index.ts:94` - fetch handler
**Endpoints doc**: `docs/api/endpoints.md`
