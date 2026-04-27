import { expect, test } from "bun:test";
import { Button } from "../src";

test("Button component is exported", () => {
  expect(Button).toBeDefined();
});
