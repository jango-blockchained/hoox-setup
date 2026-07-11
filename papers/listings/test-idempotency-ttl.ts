// Source: workers/hoox/test/idempotencyStore.test.ts (lines 138-148)
// Listing id: test-idempotency-ttl
// Caption: Unit test: duplicate key rejected within TTL window
    test("checkAndStore() returns false for duplicate within TTL window", async () => {
      // Arrange -- store a key at t=0
      await store.checkAndStore("dup-key");

      // Act -- re-submit well before the 5-minute TTL elapses
      advanceTime(60_000);
      const result = await store.checkAndStore("dup-key");

      // Assert
      expect(result).toBe(false);
    });
