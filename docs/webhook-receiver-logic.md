# Webhook Receiver Request-Response Logic Review

This document summarizes the request-response process logic found in `workers/webhook-receiver/src/index.ts`.

## Overview

The `webhook-receiver` worker acts as a public-facing entry point, specifically designed to handle incoming HTTP POST requests, likely from webhooks (e.g., TradingView). Its main responsibilities are:
1.  Authenticating incoming requests.
2.  Parsing the request payload.
3.  Generating a unique tracking ID (`requestId`).
4.  Delegating specific tasks (trading and notification) to other internal workers based on the payload.
5.  Returning a consolidated response indicating the overall success or failure of the processed tasks.

## Detailed Process Flow

1.  **Entry Point:**
    *   The `fetch` function in the default export handles all incoming requests.
    *   It passes the request and environment variables (`env`) to the `handleRequest` function.

2.  **Request Handling (`handleRequest` function):**
    *   **Method Check:** Verifies if the request method is `POST`. If not, returns a `405 Method Not Allowed` response.
    *   **JSON Parsing:** Parses the request body as JSON, expecting a `WebhookData` structure.
    *   **Authentication:**
        *   Extracts an `apiKey` from the request payload.
        *   Calls `validateApiKey` to compare the provided key against the `API_SECRET_KEY` environment variable.
        *   If validation fails, returns a `403 Forbidden` response immediately.
    *   **Request ID:** Generates a unique `requestId` using `crypto.randomUUID()` for tracking purposes.
    *   **Task Delegation:**
        *   **Trade Processing:** If the payload contains required fields (`exchange`, `action`, `symbol`, `quantity`), it calls `processTrade` with the relevant data and the `requestId`.
        *   **Notification Processing:** If the payload contains a `notify` object, it calls `processNotification` with the notification details (message, chatId) and the `requestId`. It uses `createDefaultMessage` if a specific message isn't provided.
    *   **Response Aggregation:**
        *   Tracks the success/failure status of both `processTrade` and `processNotification`.
        *   If *all* delegated tasks succeed, returns a `200 OK` JSON response containing `{ success: true, requestId, tradeResult, notificationResult }`.
        *   If *any* delegated task fails, returns a `500 Internal Server Error` JSON response containing `{ success: false, requestId, error: "...", tradeResult, notificationResult }`, including details about the failure(s).
    *   **Error Handling:** A `try...catch` block wraps the main logic. If any unexpected error occurs during processing, it returns a `500 Internal Server Error` JSON response with `{ success: false, error: "..." }`.

3.  **Authentication (`validateApiKey` function):**
    *   Performs a simple, direct string comparison between the `apiKey` from the request and the `API_SECRET_KEY` from the environment variables.
    *   Logs the validation result. Returns `false` if the `API_SECRET_KEY` is not configured.

4.  **Trade Processing (`processTrade` function):**
    *   Retrieves an internal authentication key from an environment binding (`INTERNAL_KEY_BINDING`). Throws an error if the binding is missing.
    *   Constructs a standardized JSON body including the `internalAuthKey`, `requestId`, and the specific trade `payload`.
    *   Sends a `POST` request to the `TRADE_WORKER_URL` (defined in environment variables) with the standardized body.
    *   Handles the response from the `trade-worker`, checking if the request was successful (`response.ok`) and parsing the JSON result.
    *   Returns a `ServiceResponse` object indicating success/failure and potentially containing results or errors from the trade worker.

5.  **Notification Processing (`processNotification` function):**
    *   (Structure inferred from outline and similarity to `processTrade`)
    *   Likely retrieves the internal authentication key similar to `processTrade`.
    *   Constructs a request body for the notification service.
    *   Sends a `POST` request to the `TELEGRAM_WORKER_URL` (defined in environment variables).
    *   Handles the response from the notification worker.
    *   Returns a `ServiceResponse` object.

6.  **Default Message (`createDefaultMessage` function):**
    *   Creates a default notification message string based on the data received in the original webhook payload if a custom message is not provided.

## Summary

This worker acts as a secure gateway and orchestrator. It validates incoming requests and then forwards the relevant data to specialized backend workers (`trade-worker`, `telegram-worker`) using an internal authentication key for inter-service communication. It then aggregates the results to provide a single response to the original caller. 