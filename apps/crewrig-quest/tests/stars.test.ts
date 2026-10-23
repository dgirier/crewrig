import assert from "node:assert/strict";
import { test } from "node:test";
import { computeStars } from "../src/stars.ts";

test("star rule table (spec 0278 R6)", () => {
  const table: [number, number, number][] = [
    [0, 10, 0],
    [1, 10, 1],
    [2, 10, 1],
    [3, 10, 2],
    [4, 10, 2],
    [5, 10, 3],
    [7, 10, 4],
    [9, 10, 4],
    [10, 10, 5],
    [49, 50, 4],
    [199, 200, 4],
    [1, 100, 0],
    [8, 8, 5],
    [0, 1, 0],
    [1, 1, 5],
  ];
  for (const [correct, total, expected] of table) {
    assert.equal(computeStars(correct, total), expected, `${correct}/${total}`);
  }
});

test("five stars if and only if every answer is correct", () => {
  for (let total = 1; total <= 40; total++) {
    for (let correct = 0; correct <= total; correct++) {
      assert.equal(computeStars(correct, total) === 5, correct === total, `${correct}/${total}`);
    }
  }
});

test("invalid input yields zero stars", () => {
  assert.equal(computeStars(1, 0), 0);
  assert.equal(computeStars(-1, 5), 0);
  assert.equal(computeStars(1.5, 5), 0);
});
