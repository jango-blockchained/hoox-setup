---
title: "Edge Architecture"
description: "What Cloudflare Workers means for latency"
---

# Edge Architecture

## The Problem

Traditional trading bots run on a server in one data center. If the server is in Virginia and the exchange API is in Hong Kong, every trade has ~200ms of network latency — just from data travel time.

## The Hoox Approach

Instead of one server, Hoox runs on **Cloudflare Workers** — code that executes on Cloudflare's global network of 330+ data centers. When a signal arrives, it's processed on the server **closest to the exchange** whose API it needs to call.

This means:

- **Signals from TradingView** arrive at the nearest Cloudflare edge location
- **The worker processes** the trade on a server near the exchange's API
- **Total latency** is typically 5-50ms instead of 100-300ms

## Smart Placement

Smart Placement is a free Cloudflare feature that automatically deploys your worker on the edge node closest to where its dependencies live (in this case, exchange API servers). It requires zero configuration and is enabled on most Hoox workers.

## What This Means for You

- **Faster fills** — Your orders reach exchanges sooner
- **No server management** — Cloudflare handles scaling, routing, and failover
- **Free tier** — 100,000 requests/day at no cost

> **Deep dive:** [Architecture Overview](../devops/architecture/overview.md)
