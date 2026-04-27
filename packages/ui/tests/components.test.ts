import { expect, test } from "bun:test";
import { Hero, FeatureGrid } from "../src";

test("Hero component is exported", () => {
  expect(Hero).toBeDefined();
});

test("FeatureGrid component is exported", () => {
  expect(FeatureGrid).toBeDefined();
});
